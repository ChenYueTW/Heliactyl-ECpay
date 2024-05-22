const renewDays = require('../settings.json').renewals.days;
const formateDateTime = require('./formateDateTime');

async function get(timeoutDB, orderId) {
    return new Promise((resolve, reject) => {
        const sqlCmd = 'SELECT value FROM key_value WHERE key = ?';
        timeoutDB.get(sqlCmd, [orderId], (err, row) => {
            if (err) return reject(err);
            if (row) resolve(row.value);
            else resolve(null);
        })
    })
}

async function set(timeoutDB, orderId, data) {
    timeoutDB.run('INSERT INTO key_value (key, value) VALUES (?, ?)', [orderId, JSON.stringify(data)]);
}

async function remove(timeoutDB, orderId) {
    timeoutDB.run('DELETE FROM key_value WHERE key = ?', [orderId]);
}

async function orderCompleted(timeoutDB, orderId, orderInfo, userId, timeout) {
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
    set(timeoutDB, orderId, timeoutData);
}

module.exports = {
    get,
    set,
    remove,
    orderCompleted
}