const settings = require('../settings.json');

const fetch = require('node-fetch');

/**
 * Log an action to Discord
 * @param {string} action 
 * @param {string} message 
 */
module.exports = (action, message) => {
    if (!settings.logging.status) return
    if (!settings.logging.actions.user[action] && !settings.logging.actions.admin[action]) return

    fetch(settings.logging.webhook, {
        method: 'POST',
        headers: {
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            embeds: [
                {
                    color: hexToDecimal('#00fff9'),
                    title: `事件: \`${action}\``,
                    description: message,
                    footer: {
                        text: 'MistHost．託管系統',
                        _comment: "Replace the url for the webhook image footer",
                        icon_url: 'https://i.imgur.com/kxyaCPd.png'
                    },
                    timestamp: new Date()
                }
            ]
        })
    })
    .catch(() => {})
}

function hexToDecimal(hex) {
    return parseInt(hex.replace("#", ""), 16)
}
