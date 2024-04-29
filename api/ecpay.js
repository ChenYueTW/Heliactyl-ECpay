const settings = require('../settings.json');
const crypto = require('crypto');
const axios = require('axios');
const bodyParser = require('body-parser');
const { default: ShortUniqueId } = require('short-unique-id');
const moment = require('moment');

function generateCheckValue(params) {
    const sortedParams = Object.entries(params).sort(([keyA], [keyB]) => keyA.localeCompare(keyB));
    const queryString = sortedParams.map(([key, value]) => `${key}=${value}`).join('&');

    let result =
      `HashKey=${settings.ecpay.hashkey}&` +
      `${queryString}` +
      `&HashIV=${settings.ecpay.hashiv}`;
    result = encodeURIComponent(result).toLowerCase();

    result = result
      .replace(/%2d/g, '-')
      .replace(/%5f/g, '_')
      .replace(/%2e/g, '.')
      .replace(/%21/g, '!')
      .replace(/%2a/g, '*')
      .replace(/%28/g, '(')
      .replace(/%29/g, ')')
      .replace(/%20/g, '+');

    result = crypto.createHash('sha256').update(result).digest('hex').toString();
    return result.toUpperCase();
}

module.exports.load = async function (app, db) {
    app.use(bodyParser.urlencoded({ extended: false }));
    app.post("/process_payment", async (req, res) => {
        if (!req.session.pterodactyl) return res.redirect("/login");
        
        const setting = settings.ecpay;
        const uid = new ShortUniqueId({ length: 20 });
        const uuid = uid.rnd();

        let base_param = {
            MerchantID: setting.merchantId,
            MerchantTradeNo: `${uuid}`,
            MerchantTradeDate: moment().format('YYYY/MM/DD HH:mm:ss'),
            PaymentType: 'aio',
            TotalAmount: req.body.totalPrice,
            TradeDesc: `MistHost Resources Buy`,
            ItemName: `MistHost Resources Buy`,
            ReturnURL: `https://heli.misthost.net/process_payment`,
            ChoosePayment: 'CVS',
            EncryptType: 1,
        }

        base_param.CheckMacValue = generateCheckValue(base_param);
        console.log(base_param);

        try {
            const response = await axios.post('https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5', base_param);
            const result = response.data;
            console.log(result);
            // Handle success case, such as storing transaction details in database, updating order status, etc.
            res.send(`Payment has been initiated.
Redirect URL: ${result.Url}`);
        } catch (error) {
            console.error("Error occurred while processing ECPay payment:", error);
            // Handle failure case by displaying proper message to the user
            res.status(500).send("Error occurred during payment initiation.");
        }
    });
};