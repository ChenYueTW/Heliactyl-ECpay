const bodyParser = require('body-parser');
const dbHelper = require('../misc/dbHelper');
const cvs = require('../ecpay_payment/cvs');
const formateDateTime = require('../misc/formateDateTime');
const { default: ShortUniqueId } = require('short-unique-id');
const log = require('../misc/log');
let oldOrderId;
let newOrderId;

module.exports.load = async function (app, db, timeoutDB) {
    app.use(bodyParser.urlencoded({ extended: false }));

    app.get('/api/getAllOrders', async (req, res) => {
        if (!req.session.pterodactyl) return res.redirect("/login");

        const userId = req.session.userinfo.id;
        try {
            const orders = await dbHelper.getOrdersByUserId(timeoutDB, userId);
            res.json(orders);
        } catch (error) {
            console.error("Read history order error: ", error);
            res.status(500).send("獲取歷史訂單時發生錯誤");
        }
    });
    app.post('/renew-order', async (req, res) => {
        const { orderId, data } = req.body;
        // 生成訂單編號 隨機15碼
        const uid = new ShortUniqueId({ length: 15 });
        newOrderId = uid.rnd();

        oldOrderId = orderId;
        let resources = JSON.parse(data).orderInfo;
        const originalOrder = await dbHelper.get(timeoutDB, orderId);

        if (!originalOrder) return res.status(404).json({ error: 'Order not found' });
        const htmlForm = cvs.renewOrder(newOrderId, resources);

        try {
            res.send(htmlForm);
        } catch (error) {
            console.error("處理 ECPay 付款時發生錯誤: ", error);
            res.status(500).send("付款期間發生錯誤");
        }
    });
    app.post("/renew_generate_code", async (req, res) => {
        const value = await dbHelper.get(timeoutDB, oldOrderId);
        if (!value) return;
        const userId = value.userId;
        const resources = {
            cpu: value.orderInfo.cpu,
            ram: value.orderInfo.ram,
            disk: value.orderInfo.disk,
            servers: value.orderInfo.servers
        }

        // 改變訂單
        try {
            // status更改為UNPAID
            await dbHelper.updateValue(timeoutDB, oldOrderId, 'status', 'UNPAID');
            // isRemind更改為false
            await dbHelper.updateValue(timeoutDB, oldOrderId, 'isRemind', false);
            // 生成newOrderId
            await dbHelper.addNewOrderIdValue(timeoutDB, oldOrderId, newOrderId);

            if (oldOrderId) log('訂單創建', `\`${userId}\` 創建了訂單（續約）\n新的訂單編號為 \`order-${newOrderId}\`\n\`\`\`CPU: ${resources.cpu} 核心\nRam: ${resources.ram} GB\nDisk: ${resources.disk} GB\nServers: ${resources.servers} 個\`\`\``);

            res.send('1|OK');
        } catch (error) {
            console.error("變更訂單時發生錯誤", error);
        }
    });
    app.post("/renew_order", async (req, res) => {
        const orderInfo = await dbHelper.get(timeoutDB, oldOrderId);

        const date = new Date(orderInfo.timeout);
        date.setDate(date.getDate() + 30);
        const newDate = formateDateTime(date);

        try {
            // 從value中移除newOrderId
            await dbHelper.removeNewOrderId(timeoutDB, oldOrderId);
            // 更改狀態
            await dbHelper.updateValue(timeoutDB, oldOrderId, 'status', 'ISPAID');
            // 更新日期
            await dbHelper.updateValue(timeoutDB, oldOrderId, 'timeout', newDate);

            log('訂單完成', `\`${orderInfo.userId}\` 完成了訂單（續約）\n新的訂單編號為 \`${req.body.MerchantTradeNo}\`\n舊的訂單編號為 \`order-${oldOrderId}\`\n\`\`\`CPU: ${orderInfo.orderInfo.cpu} 核心\nRam: ${orderInfo.orderInfo.ram} GB\nDisk: ${orderInfo.orderInfo.disk} GB\nServers: ${orderInfo.orderInfo.servers} 個\`\`\``);

            res.send('1|OK');
        } catch (error) {
            console.error('結束訂單時發生錯誤: ', error);
        }
    });
};