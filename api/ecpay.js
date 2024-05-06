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
        const cpu = req.body.cpu;
        const ram = req.body.ram;
        const disk = req.body.disk;
        const servers = req.body.servers;

        let data = {
            MerchantID: settings.ecpay.merchantId,
            MerchantTradeNo: `${uuid}`,
            MerchantTradeDate: moment().format('YYYY/MM/DD HH:mm:ss'),
            PaymentType: 'aio',
            TotalAmount: parseInt(req.body.totalPrice),
            TradeDesc: 'MistHost Resources Buy',
            ItemName: 'MistHost Resources Buy',
            ReturnURL: `https://helia.misthost.net/order`,
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
            await db.set(`order-${uuid}`, {
                cpu: cpu,
                ram: ram,
                disk: disk,
                servers: servers
            });
            res.send(htmlForm);
        } catch (error) {
            console.error("處理 ECPay 付款時發生錯誤: ", error);
            res.status(500).send("付款期間發生錯誤");
        }
    });
    app.post("/order", async (req, res) => {
        const orderUser = await db.get(`extra-${req.body.id}`)
        const orderInfo = await db.get(`order-${req.body.MerchantTradeNo}`);
        let extra = {
            ram: 0,
            disk: 0,
            cpu: 0,
            servers: 0
        }

        // 偵測是否有extra-資料 沒有的話創一個
        if (orderUser == undefined) {
            await db.set(`extra-${req.body.id}`, extra);
        }
        // 把資源加起來
        const resources = await db.get(`extra-${req.body.id}`);
        const cpu = orderInfo.cpu * 100 + resources.cpu; // 核心轉%
        const ram = orderInfo.ram * 1024 + resources.ram; // GB轉MB
        const disk = orderInfo.disk * 1024 + resources.disk; // GB轉MB
        const servers = orderInfo.servers + resources.servers;
        extra = {
            ram: ram,
            disk: disk,
            cpu: cpu,
            servers: servers
        }
        
        await db.set(`extra-${req.body.id}`, extra);

        console.log(orderInfo);
        res.send('1|OK');
    });
};