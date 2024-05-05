const settings = require('../settings.json');
const crypto = require('crypto');
const axios = require('axios');
const bodyParser = require('body-parser');
const { default: ShortUniqueId } = require('short-unique-id');
const moment = require('moment');
const qs = require('querystring');
const config = {
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
    }
};

function generateCheckValue(params) {
    queryString = `ChoosePayment=${params.ChoosePayment}&EncryptType=${params.EncryptType}&ItemName=${params.ItemName}&MerchantID=${params.MerchantID}&MerchantTradeDate=${params.MerchantTradeDate}&MerchantTradeNo=${params.MerchantTradeNo}&PaymentType=${params.PaymentType}&ReturnURL=${params.ReturnURL}&TotalAmount=${params.TotalAmount}&TradeDesc=${params.TradeDesc}`
    checkValue = `HashKey=${settings.ecpay.hashkey}&${queryString}&HashIV=${settings.ecpay.hashiv}`;
    console.log(checkValue);
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
    console.log(checkValue);

    checkValue = crypto.createHash('sha256').update(checkValue).digest('hex');
    checkValue = checkValue.toUpperCase();
    return checkValue;
}

module.exports.load = async function (app, db) {
    app.use(bodyParser.urlencoded({ extended: false }));
    app.post("/process_payment", async (req, res) => {
        if (!req.session.pterodactyl) return res.redirect("/login");

        const uid = new ShortUniqueId({ length: 20 });
        const uuid = uid.rnd();

        let data = {
            MerchantID: settings.ecpay.merchantId,
            MerchantTradeNo: `${uuid}`,
            MerchantTradeDate: moment().format('YYYY/MM/DD HH:mm:ss'),
            PaymentType: 'aio',
            TotalAmount: parseInt(req.body.totalPrice),
            TradeDesc: 'MistHost Resources Buy',
            ItemName: 'MistHost Resources Buy',
            ReturnURL: `https://helia.misthost.net/process_payment`,
            ChoosePayment: 'CVS',
            EncryptType: 1,
        }
        data.CheckMacValue = generateCheckValue(data);

        const requestBody = qs.stringify(data);
        console.log(data);

        try {
            const response = await axios.post('https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5', requestBody, config);
            const result = response.data;

            console.log(response);

            res.redirect('https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5');
        } catch (error) {
            console.error("Error occurred while processing ECPay payment:", error);
            res.status(500).send("Error occurred during payment initiation.");
        }
    });
};