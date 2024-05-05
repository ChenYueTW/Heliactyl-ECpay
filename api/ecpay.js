const settings = require('../settings.json');
const crypto = require('crypto');
const bodyParser = require('body-parser');
const { default: ShortUniqueId } = require('short-unique-id');
const moment = require('moment');

function generateCheckValue(params) {
    queryString = `ChoosePayment=${params.ChoosePayment}&EncryptType=${params.EncryptType}&ItemName=${params.ItemName}&MerchantID=${params.MerchantID}&MerchantTradeDate=${params.MerchantTradeDate}&MerchantTradeNo=${params.MerchantTradeNo}&PaymentType=${params.PaymentType}&ReturnURL=${params.ReturnURL}&TotalAmount=${params.TotalAmount}&TradeDesc=${params.TradeDesc}`
    checkValue = `HashKey=${settings.ecpay.hashkey}&${queryString}&HashIV=${settings.ecpay.hashiv}`;
    checkValue = encodeURIComponent(checkValue).toLowerCase();
    checkValue = checkValue
        .replace(/%2d/g, '-')
        .replace(/%5f/g, '_')
        .replace(/%2e/g, '.')
        .replace(/%21/g, '!')
        .replace(/%2a/g, '*')
        .replace(/%28/g, '(')
        .replace(/%29/g, ')')
        .replace(/%20/g, '+');

    checkValue = crypto.createHash('sha256').update(checkValue).digest('hex');
    checkValue = checkValue.toUpperCase();
    return checkValue;
}

module.exports.load = async function (app, db) {
    app.use(bodyParser.urlencoded({ extended: false }));
    app.post("/process_payment", async (req, res) => {
        if (!req.session.pterodactyl) return res.redirect("/login");

        const uid = new ShortUniqueId({ length: 15 });
        const uuid = uid.rnd();

        let data = {
            MerchantID: settings.ecpay.merchantId,
            MerchantTradeNo: `${uuid}`,
            MerchantTradeDate: moment().format('YYYY/MM/DD HH:mm:ss'),
            PaymentType: 'aio',
            TotalAmount: parseInt(req.body.totalPrice),
            TradeDesc: 'MistHost Resources Buy',
            ItemName: 'MistHost Resources Buy',
            ReturnURL: `https://helia.misthost.net/order/${uuid}`,
            ChoosePayment: 'CVS',
            EncryptType: 1,
        }
        data.CheckMacValue = generateCheckValue(data);

        const htmlForm = `
        <form id="ecpayForm" method="POST" action="https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5">
            <input type="hidden" name="MerchantID" value="${data.MerchantID}">
            <input type="hidden" name="MerchantTradeNo" value="${data.MerchantTradeNo}">
            <input type="hidden" name="MerchantTradeDate" value="${data.MerchantTradeDate}">
            <input type="hidden" name="PaymentType" value="${data.PaymentType}">
            <input type="hidden" name="TotalAmount" value="${data.TotalAmount}">
            <input type="hidden" name="TradeDesc" value="${data.TradeDesc}">
            <input type="hidden" name="ItemName" value="${data.ItemName}">
            <input type="hidden" name="ReturnURL" value="${data.ReturnURL}">
            <input type="hidden" name="ChoosePayment" value="${data.ChoosePayment}">
            <input type="hidden" name="EncryptType" value="${data.EncryptType}">
            <input type="hidden" name="CheckMacValue" value="${data.CheckMacValue}">
        </form>
        <div>
            <h2>訂單詳細信息</h2>
            <p><strong>訂單金額: </strong> ${data.TotalAmount}</p>
            <p><strong>訂單編號: </strong> ${data.MerchantTradeNo}</p>
            <p><strong>日期: </strong> ${data.MerchantTradeDate}</p>
        </div>
        <script>document.getElementById("ecpayForm").submit();</script>
        `;

        try {
            // console.log(htmlForm);
            res.send(htmlForm);
        } catch (error) {
            console.error("Error occurred while processing ECPay payment:", error);
            res.status(500).send("Error occurred during payment initiation.");
        }
    });
};