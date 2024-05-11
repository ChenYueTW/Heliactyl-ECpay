module.exports = (date) => {
    // 取得年月日時分秒
    let year = date.getFullYear();
    let month = (date.getMonth() + 1).toString().padStart(2, '0'); // 前面補零
    let day = date.getDate().toString().padStart(2, '0'); // 前面補零
    let hours = date.getHours().toString().padStart(2, '0'); // 前面補零
    let minutes = date.getMinutes().toString().padStart(2, '0'); // 前面補零
    let seconds = date.getSeconds().toString().padStart(2, '0'); // 前面補零

    // 返回格式化後的日期時間字符串
    return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
}