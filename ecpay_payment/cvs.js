const settings = require('../settings.json');
const moment = require('moment');
const crypto = require('crypto');
const { default: ShortUniqueId } = require('short-unique-id');

// 生成 CheckValue
function generateCheckValue(params) {
    queryString = `ChoosePayment=${params.ChoosePayment}&EncryptType=${params.EncryptType}&ItemName=${params.ItemName}&MerchantID=${params.MerchantID}&MerchantTradeDate=${params.MerchantTradeDate}&MerchantTradeNo=${params.MerchantTradeNo}&PaymentInfoURL=${params.PaymentInfoURL}&PaymentType=${params.PaymentType}&ReturnURL=${params.ReturnURL}&StoreExpireDate=${params.StoreExpireDate}&TotalAmount=${params.TotalAmount}&TradeDesc=${params.TradeDesc}`
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

function generateOrderDetails(req, uuid) {
    const resources = getResource(req);
    const cpu = resources.cpu;
    const ram = resources.ram;
    const disk = resources.disk;
    const servers = resources.servers;

    let data = {
        MerchantID: settings.ecpay.merchantId,
        MerchantTradeNo: `${uuid}`,
        MerchantTradeDate: moment().format('YYYY/MM/DD HH:mm:ss'),
        PaymentType: 'aio',
        TotalAmount: parseInt(req.body.totalPrice),
        TradeDesc: `購買資訊： CPU ${cpu} 核、RAM ${ram} GB、DISK ${disk} GB、伺服器數量 ${servers} 個`,
        ItemName: 'MistHost資源購買',
        ReturnURL: `https://helia.misthost.net/order`,
        ChoosePayment: 'CVS',
        EncryptType: 1,
        StoreExpireDate: 4320,
        PaymentInfoURL: 'https://helia.misthost.net/generate_code',
    }
    data.CheckMacValue = generateCheckValue(data);
    return data;
}

function renewOrder(uuid, resources) {
    if (!resources) return;

    const cpu = resources.cpu / 100;
    const ram = resources.ram / 1024;
    const disk = resources.disk / 1024;
    const servers = resources.servers;
    const total = (cpu * 50) + (ram * 20) + (disk * 10) + (servers * 30);

    let data = {
        MerchantID: settings.ecpay.merchantId,
        MerchantTradeNo: `${uuid}`,
        MerchantTradeDate: moment().format('YYYY/MM/DD HH:mm:ss'),
        PaymentType: 'aio',
        TotalAmount: total,
        TradeDesc: `購買資訊： CPU ${cpu} 核、RAM ${ram} GB、DISK ${disk} GB、伺服器數量 ${servers} 個`,
        ItemName: 'MistHost資源購買',
        ReturnURL: `https://helia.misthost.net/renew_order`,
        ChoosePayment: 'CVS',
        EncryptType: 1,
        StoreExpireDate: 4320,
        PaymentInfoURL: 'https://helia.misthost.net/renew_generate_code',
    }
    data.CheckMacValue = generateCheckValue(data);

    return ecpayForm(data);
}

function ecpayForm(data) {
    // 產生丟給綠界的表單
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
            <input type="hidden" name="StoreExpireDate" value="${data.StoreExpireDate}">
            <input type="hidden" name="PaymentInfoURL" value="${data.PaymentInfoURL}">
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
    return htmlForm;
}

function getResource(req) {
    // 接收購買的配置
    let cpu = req.body.cpu;
    let ram = req.body.ram;
    let disk = req.body.disk;
    let servers = req.body.servers;

    // 判斷是否為空值
    if (!cpu) cpu = 0;
    if (!ram) ram = 0;
    if (!disk) disk = 0;
    if (!servers) servers = 0;

    return {
        cpu: cpu,
        ram: ram,
        disk: disk,
        servers: servers
    }
}

module.exports = {
    generateOrderDetails,
    ecpayForm,
    getResource,
    renewOrder
}