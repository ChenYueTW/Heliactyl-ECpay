const renewDays = require('../settings.json').renewals.days;
const formateDateTime = require('./formateDateTime');

async function get(timeoutDB, orderId) {
    return new Promise((resolve, reject) => {
        const sqlCmd = 'SELECT value FROM key_value WHERE key = ?';
        timeoutDB.get(sqlCmd, [orderId], (err, row) => {
            if (err) return reject(err);
            if (row) resolve(JSON.parse(row.value));
            else resolve(null);
        })
    })
}

async function getAllKey(timeoutDB) {
    return new Promise((resolve, reject) => {
        const sqlCmd = 'SELECT * FROM key_value';
        timeoutDB.all(sqlCmd, [], (err, rows) => {
            if (err) return reject(err);
            const data = {};
            rows.forEach((row) => {
                data[row.key] = JSON.parse(row.value);
            });
            resolve(data);
        });
    });
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

    const cpu = orderInfo.cpu * (50 / 100);
    const ram = orderInfo.ram * (20 / 1024);
    const disk = orderInfo.disk * (10 / 1024);
    const servers = orderInfo.servers * 30;
    const total = cpu + ram + disk + servers;

    const timeoutData = {
        orderInfo: orderInfo,
        userId: userId,
        timeout: futureTime,
        price: total,
        isRemind: false,
        status: 'ISPAID'
    };
    set(timeoutDB, orderId, timeoutData);
}

async function updateValue(timeoutDB, key, field, newValue) {
    const data = await get(timeoutDB, key);
    if (data) {
        data[field] = newValue;  // 更新特定字段
        return new Promise((resolve, reject) => {
            const sqlCmd = 'UPDATE key_value SET value = ? WHERE key = ?';
            timeoutDB.run(sqlCmd, [JSON.stringify(data), key], function (err) {
                if (err) return reject(err);
                resolve(true);
            });
        });
    } else {
        return null;  // 如果没有找到该key，返回null
    }
}

async function addNewOrderIdValue(timeoutDB, orderId, newOrderId) {
    const value = await get(timeoutDB, orderId);
    value.newOrderId = newOrderId;
    const updatedValue = JSON.stringify(value);

    try {
        timeoutDB.run("UPDATE key_value SET value = ? WHERE key = ?", [updatedValue, orderId], function (updateErr) {
            if (updateErr) return console.error('Error updating value: ', updateErr.message);
        })
    } catch (error) {
        console.log('Update Value err: ', error);
    }
}

async function searchValue(timeoutDB, searchOrderId) {
    timeoutDB.all("SELECT key, value FROM key_value", [], (err, rows) => {
        if (err) return console.error('Error retriving records: ', err.message);

        let foundKey = null;

        for (const row of rows) {
            try {
                let valueObj = JSON.parse(row.value);

                if (valueObj.newOrderId === searchOrderId) {
                    foundKey = row.key;
                    break;
                }
            } catch (parseErr) {
                console.error('Error parsing JSON:', parseErr.message);
            }
        }

        return foundKey ? foundKey : null;
    })
}

async function getOrderTotal(timeoutDB, orderId) {
    let orderInfo;
    try {
        orderInfo = await get(timeoutDB, orderId);
        orderInfo = orderInfo.orderInfo;

        const cpu = orderInfo.cpu * (50 / 100);
        const ram = orderInfo.ram * (20 / 1024);
        const disk = orderInfo.disk * (10 / 1024);
        const servers = orderInfo.servers * 30;

        // total price
        return cpu + ram + disk + servers;
    } catch (error) {
        return 0;
    }
}

const getOrdersByUserId = async (timeoutDB, userId) => {
    return new Promise((resolve, reject) => {
        const sqlCmd = 'SELECT * FROM key_value WHERE value LIKE ?';
        timeoutDB.all(sqlCmd, [`%"userId":"${userId}"%`], (err, rows) => {
            if (err) return reject(err);
            const orders = rows.map(row => ({
                key: row.key,
                value: JSON.parse(row.value)
            }));
            resolve(orders);
        });
    });
}

async function removeNewOrderId(timeoutDB, orderId) {
    let value = await get(timeoutDB, orderId);
    delete value.newOrderId;

    const newValue = JSON.stringify(value);

    timeoutDB.run("UPDATE key_value SET value = ? WHERE key = ?", [newValue, orderId], function (err) {
        if (err) return console.error(err.message);
    });
}

module.exports = {
    get,
    set,
    remove,
    orderCompleted,
    getAllKey,
    updateValue,
    getOrderTotal,
    getOrdersByUserId,
    addNewOrderIdValue,
    searchValue,
    removeNewOrderId
}