const bodyParser = require('body-parser');
const { default: ShortUniqueId } = require('short-unique-id');
const log = require('../misc/log');
const cvs = require('../ecpay_payment/cvs');
const dbHelper = require('../misc/dbHelper');
let userId;
let resources;

module.exports.load = async function (app, db, timeoutDB) {
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
        if (!resources) return;

        const cpu = resources.cpu * 50;
        const ram = resources.ram * 20;
        const disk = resources.disk * 10;
        const servers = resources.servers * 30;
        const total = cpu + ram + disk + servers;

        (async () => {
            try {
                const isValue = await dbHelper.get(timeoutDB, uuid);
                if (!await isValue) {
                    await dbHelper.set(timeoutDB, uuid, {
                        orderInfo: {
                            cpu: resources.cpu,
                            ram: resources.ram,
                            disk: resources.disk,
                            servers: resources.servers,
                        },
                        userId: userId,
                        timeout: null,
                        price: total,
                        isRemind: false,
                        status: 'UNPAID'
                    });
                }
            } catch (error) {
                console.log(error);
            }
        })();

        if (resources) log('訂單創建', `\`${userId}\` 創建了訂單\n編號為 \`order-${uuid}\`\n\`\`\`CPU: ${resources.cpu} 核心\nRam: ${resources.ram} GB\nDisk: ${resources.disk} GB\nServers: ${resources.servers} 個\`\`\``);

        res.send('1|OK');
    });
    app.post("/order", async (req, res) => {
        const orderInfo = await dbHelper.get(timeoutDB, req.body.MerchantTradeNo); // 有cpu、ran、disk、servers、userID
        let extra = {
            ram: 0,
            disk: 0,
            cpu: 0,
            servers: 0
        }
        let orderExtra = {
            ram: orderInfo.orderInfo.ram * 1024,
            disk: orderInfo.orderInfo.disk * 1024,
            cpu: orderInfo.orderInfo.cpu * 100,
            servers: orderInfo.orderInfo.servers
        }

        // 偵測是否有extra-資料 沒有的話創一個
        if (!await db.get(`extra-${orderInfo.userId}`)) await db.set(`extra-${orderInfo.userId}`, extra);
        else await db.get(`extra-${orderInfo.userId}`);

        const orderUser = await db.get(`extra-${orderInfo.userId}`); // 讀取extra-ID資料表

        // 測試有沒有偵測到orderInfo
        if (!orderInfo) return;

        // 檢測訂單<伺服器數量>是否為空格
        if (!orderInfo.orderInfo.servers) orderInfo.orderInfo.servers = 0;
        // 檢測原本資源<伺服器數量>是否為null
        if (!orderUser.servers) orderUser.servers = 0;

        // orderUser 單位MB
        // orderInfo 單位GB
        const cpu = orderUser.cpu + orderInfo.orderInfo.cpu * 100; // 核心轉%
        const ram = orderUser.ram + orderInfo.orderInfo.ram * 1024; // GB轉MB
        const disk = orderUser.disk + orderInfo.orderInfo.disk * 1024; // GB轉MB
        const servers = parseInt(orderUser.servers) + parseInt(orderInfo.orderInfo.servers);
        extra = {
            ram: ram,
            disk: disk,
            cpu: cpu,
            servers: servers
        }
        await db.set(`extra-${orderInfo.userId}`, extra);
        log('訂單完成', `\`${orderInfo.userId}\` 完成了訂單\n編號為 \`order-${req.body.MerchantTradeNo}\`\n\`\`\`CPU: ${orderInfo.orderInfo.cpu} 核心\nRam: ${orderInfo.orderInfo.ram} GB\nDisk: ${orderInfo.orderInfo.disk} GB\nServers: ${orderInfo.orderInfo.servers} 個\`\`\``);
        await dbHelper.remove(timeoutDB, req.body.MerchantTradeNo);
        res.send('1|OK');
        await dbHelper.orderCompleted(timeoutDB, req.body.MerchantTradeNo, orderExtra, orderInfo.userId, req.body.PaymentDate);
    });
};