const bodyParser = require('body-parser');
const { default: ShortUniqueId } = require('short-unique-id');
const log = require('../misc/log');
const cvs = require('../ecpay_payment/cvs');
const timeoutInfo = require('../misc/timeoutInfo')
let userId;
let resources;

module.exports.load = async function (app, db) {
    app.use(bodyParser.urlencoded({ extended: false }));
    app.post("/process_payment", async (req, res) => {
        if (!req.session.pterodactyl) return res.redirect("/login");

        // 生成訂單編號 隨機15碼
        const uid = new ShortUniqueId({ length: 15 });
        const uuid = uid.rnd();

        // 處裡訂單
        const data = cvs.generateOrderDetails(req, uuid);
        const htmlForm = cvs.ecpayForm(data);

        // 購買的資源
        resources = cvs.getResource(req);

        // 取得使用者Discord ID
        userId = req.session.userinfo.id;

        try {
            res.send(htmlForm);
        } catch (error) {
            console.error("處理 ECPay 付款時發生錯誤: ", error);
            res.status(500).send("付款期間發生錯誤");
        }
    });
    app.post("/generate_code", async (req, res) => {
        const uuid = req.body.MerchantTradeNo;

        if (!await db.get(`order-${uuid}`)) {
            await db.set(`order-${uuid}`, {
                cpu: resources.cpu,
                ram: resources.ram,
                disk: resources.disk,
                servers: resources.servers,
                id: userId
            });
        }
        if (resources) log('訂單創建', `\`${userId}\` 創建了訂單\n編號為 \`order-${uuid}\`\n\`\`\`CPU: ${resources.cpu} 核心\nRam: ${resources.ram} GB\nDisk: ${resources.disk} GB\nServers: ${resources.servers} 個\`\`\``);
    })
    app.post("/order", async (req, res) => {
        const orderInfo = await db.get(`order-${req.body.MerchantTradeNo}`); // 有cpu、ran、disk、servers、userID
        const orderUser = await db.get(`extra-${orderInfo.id}`) // 讀取extra-ID資料表
        let extra = {
            ram: 0,
            disk: 0,
            cpu: 0,
            servers: 0
        }

        // 偵測是否有extra-資料 沒有的話創一個
        if (!orderUser) await db.set(`extra-${orderInfo.id}`, extra);

        // 把資源加起來
        const resources = await db.get(`extra-${orderInfo.id}`); // 原本資源

        // 檢測訂單<伺服器數量>是否為空格
        if (!orderInfo.servers) orderInfo.servers = 0;
        // 檢測原本資源<伺服器數量>是否為null
        if (!resources.servers) resources.servers = 0;

        const cpu = orderInfo.cpu * 100 + resources.cpu; // 核心轉%
        const ram = orderInfo.ram * 1024 + resources.ram; // GB轉MB
        const disk = orderInfo.disk * 1024 + resources.disk; // GB轉MB
        const servers = parseInt(orderInfo.servers) + parseInt(resources.servers);
        extra = {
            ram: ram,
            disk: disk,
            cpu: cpu,
            servers: servers
        }
        await db.set(`extra-${orderInfo.id}`, extra);
        log('訂單完成', `\`${orderInfo.id}\` 完成了訂單\n編號為 \`order-${req.body.MerchantTradeNo}\`\n\`\`\`CPU: ${orderInfo.cpu} 核心\nRam: ${orderInfo.ram} GB\nDisk: ${orderInfo.disk} GB\nServers: ${orderInfo.servers} 個\`\`\``);
        await db.delete(`order-${req.body.MerchantTradeNo}`);
        res.send('1|OK');
        timeoutInfo.orderCompleted(req.body.MerchantTradeNo, extra, orderInfo.id, req.body.PaymentDate);
    });
    
};