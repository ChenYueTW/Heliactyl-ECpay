const fs = require('fs');
const cron = require('cron');
const formateDateTime = require('./formateDateTime');
const renewDays = require('../settings.json').renewals.days;

// 初始化時偵測是否存在 timeout.json，如果不存在，創建一個空的
function checkJsonExistence() {
    if (!fs.existsSync('timeout.json')) {
        fs.writeFileSync('timeout.json', '{}');
    }
}

// 讀取 timeout.json 的函數
function readJson() {
    if (fs.existsSync('timeout.json')) {
        const timeoutJsonString = fs.readFileSync('timeout.json', 'utf8');
        return JSON.parse(timeoutJsonString);
    } else {
        return {};
    }
}

// 初始化時讀取 timeout.json 中的所有訂單信息，並設置計時器
function initTimers() {
    const timeoutJson = readJson();
    Object.values(timeoutJson).forEach(data => {
        setCheckTimer(data);
    });
}

// 模擬訂單完成後寫入 timeout.json 的函數
function orderCompleted(orderId, orderInfo, userId, timeout) {
    // 計算時間
    const orderCompletedTime = new Date(timeout);
    let futureTime = new Date(orderCompletedTime.getTime() + (renewDays * 24 * 60 * 60 * 1000));
    futureTime = formateDateTime(futureTime);

    const timeoutData = {
        orderInfo: orderInfo,
        userId: userId,
        timeout: futureTime,
        isRemind: false
    };
    writeToJson(orderId, timeoutData);
}


// 寫入 timeout.json 的函數
function writeToJson(orderId, data) {
    let timeoutJson = readJson();

    // 將新的 timeoutData 添加到 timeoutJson 中
    timeoutJson[orderId] = data;

    // 寫入 timeout.json 檔案
    fs.writeFileSync('timeout.json', JSON.stringify(timeoutJson, null, 2));

    // 設置定時器來檢查 timeout
    setCheckTimer(data);
}

// 設置定時器來檢查 timeout
function setCheckTimer(data) {
    // 解析 timeout 字符串為 Date 對象
    let timeoutDate = new Date(data.timeout);
    let currentDate = new Date();

    // 計算差值，以毫秒為單位
    let diff = timeoutDate.getTime() - currentDate.getTime();

    // 確保時間差為正數，避免定時器錯誤
    let diffPositive = Math.max(diff, 0);

    // 設定定時器
    let timer = new cron.CronJob({
        // 定義時間格式，這裡使用每秒執行一次的格式
        cronTime: '* * * * * *',
        // 定義要執行的函數
        onTick: function () {
            // 如果時間差小於等於 0，表示已經超時
            if (diffPositive <= 0) {
                // 執行特定動作，例如發送提醒
                console.log("Order timeout: ", data);
                // 在這裡添加您的特定動作代碼

                timer.stop();

                removeFromJson(data.orderId);
            } else {
                // 如果還未超時，則將時間差減少 1 秒
                diffPositive -= 1000;
            }

        },
        // 開始定時器
        start: true
    });
}

// 從 timeout.json 中刪除特定的訂單信息
function removeFromJson(orderId) {
    // 讀取 timeout.json 的內容
    const timeoutJson = readJson();

    // 刪除指定 orderId 的訂單信息
    delete timeoutJson[orderId];

    // 更新 timeout.json 檔案
    fs.writeFileSync('timeout.json', JSON.stringify(timeoutJson, null, 2));
}

module.exports = {
    checkJsonExistence,
    initTimers,
    orderCompleted,
    readJson
}