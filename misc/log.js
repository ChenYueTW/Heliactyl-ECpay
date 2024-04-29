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
                    color: hexToDecimal('#191c24'),
                    title: `Event: \`${action}\``,
                    description: message,
                    thumbnail: {
                        _comment: "Replace the url for the webhook image",
                        url: 'https://cdn.discordapp.com/attachments/881207010417315861/949595064554913812/Copy_of_H_35.png?ex=661a4c52&is=6607d752&hm=8a9503adcddb8537ce1875cef66fd3e8364e466cfa5fbeabe363b6db08722138&'
                    },
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
