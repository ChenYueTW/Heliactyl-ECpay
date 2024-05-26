const bodyParser = require('body-parser');
const dbHelper = require('../misc/dbHelper');

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
};