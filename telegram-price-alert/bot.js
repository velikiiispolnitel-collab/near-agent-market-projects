/**
 * Telegram NEAR Price Alert Bot
 * Set target prices and get notified when reached
 */

const https = require('https');

const CONFIG = {
  token: process.env.TELEGRAM_BOT_TOKEN || '',
  coingeckoApi: 'https://api.coingecko.com/api/v3',
  checkInterval: 60000, // 1 minute
};

// In-memory storage for alerts (use database in production)
const alerts = new Map(); // chatId -> [{targetPrice, direction, createdAt}]
const lastPrice = { near: 0 };

// Fetch NEAR price from CoinGecko
async function fetchNearPrice() {
  return new Promise((resolve, reject) => {
    const url = `${CONFIG.coingeckoApi}/simple/price?ids=near&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({
            price: json.near.usd,
            change24h: json.near.usd_24h_change,
            volume24h: json.near.usd_24h_vol,
            marketCap: json.near.usd_market_cap,
          });
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// Send message via Telegram API
async function sendTelegramMessage(chatId, text, options = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: options.parseMode || 'HTML',
      reply_markup: options.replyMarkup || undefined,
    });
    
    const url = new URL(`https://api.telegram.org/bot${CONFIG.token}/sendMessage`);
    
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Format price alert message
function formatAlertMessage(alert, currentPrice) {
  const direction = alert.direction === 'above' ? '📈' : '📉';
  return `${direction} <b>NEAR Price Alert!</b>\n\n` +
    `Target: $${alert.targetPrice}\n` +
    `Current: $${currentPrice.toFixed(2)}\n` +
    `Direction: ${alert.direction === 'above' ? 'Above' : 'Below'}\n` +
    `Set at: ${new Date(alert.createdAt).toLocaleString()}`;
}

// Format price info message
function formatPriceMessage(data) {
  const changeEmoji = data.change24h >= 0 ? '🟢' : '🔴';
  return `💰 <b>NEAR Price</b>\n\n` +
    `Price: <b>$${data.price.toFixed(4)}</b>\n` +
    `${changeEmoji} 24h Change: ${data.change24h >= 0 ? '+' : ''}${data.change24h.toFixed(2)}%\n` +
    `📊 24h Volume: $${(data.volume24h / 1e6).toFixed(1)}M\n` +
    `🏦 Market Cap: $${(data.marketCap / 1e6).toFixed(1)}M`;
}

// Check alerts
async function checkAlerts(currentPrice) {
  for (const [chatId, userAlerts] of alerts.entries()) {
    const triggered = [];
    
    for (let i = userAlerts.length - 1; i >= 0; i--) {
      const alert = userAlerts[i];
      const shouldTrigger = 
        (alert.direction === 'above' && currentPrice >= alert.targetPrice) ||
        (alert.direction === 'below' && currentPrice <= alert.targetPrice);
      
      if (shouldTrigger) {
        try {
          await sendTelegramMessage(chatId, formatAlertMessage(alert, currentPrice));
          triggered.push(i);
        } catch (e) {
          console.error('Error sending alert:', e.message);
        }
      }
    }
    
    // Remove triggered alerts
    for (const idx of triggered) {
      userAlerts.splice(idx, 1);
    }
  }
}

// Process incoming message
async function processMessage(msg) {
  const chatId = msg.chat.id;
  const text = msg.text || '';
  
  if (text === '/start') {
    return sendTelegramMessage(chatId,
      `🐋 <b>NEAR Price Alert Bot</b>\n\n` +
      `Set price alerts for NEAR token!\n\n` +
      `Commands:\n` +
      `/price - Current NEAR price\n` +
      `/alert <above|below> <price> - Set alert\n` +
      `/alerts - List your alerts\n` +
      `/remove <number> - Remove alert\n` +
      `/help - Show help`
    );
  }
  
  if (text === '/help') {
    return sendTelegramMessage(chatId,
      `📖 <b>Commands</b>\n\n` +
      `/price - Get current NEAR price\n` +
      `/alert above 5.0 - Alert when NEAR goes above $5\n` +
      `/alert below 3.0 - Alert when NEAR goes below $3\n` +
      `/alerts - List all your active alerts\n` +
      `/remove 1 - Remove alert #1\n` +
      `/help - Show this help`
    );
  }
  
  if (text === '/price') {
    try {
      const data = await fetchNearPrice();
      return sendTelegramMessage(chatId, formatPriceMessage(data));
    } catch (e) {
      return sendTelegramMessage(chatId, '❌ Error fetching price. Try again later.');
    }
  }
  
  if (text.startsWith('/alert ')) {
    const parts = text.split(' ');
    if (parts.length !== 3) {
      return sendTelegramMessage(chatId, '❌ Usage: /alert <above|below> <price>');
    }
    
    const direction = parts[1].toLowerCase();
    const targetPrice = parseFloat(parts[2]);
    
    if (!['above', 'below'].includes(direction)) {
      return sendTelegramMessage(chatId, '❌ Direction must be "above" or "below"');
    }
    
    if (isNaN(targetPrice) || targetPrice <= 0) {
      return sendTelegramMessage(chatId, '❌ Invalid price');
    }
    
    if (!alerts.has(chatId)) {
      alerts.set(chatId, []);
    }
    
    alerts.get(chatId).push({
      targetPrice,
      direction,
      createdAt: Date.now(),
    });
    
    return sendTelegramMessage(chatId,
      `✅ Alert set! You will be notified when NEAR goes ${direction} $${targetPrice}`
    );
  }
  
  if (text === '/alerts') {
    const userAlerts = alerts.get(chatId) || [];
    if (userAlerts.length === 0) {
      return sendTelegramMessage(chatId, '📭 No active alerts. Use /alert to set one.');
    }
    
    let msg = '📋 <b>Your Alerts</b>\n\n';
    userAlerts.forEach((a, i) => {
      msg += `${i + 1}. ${a.direction === 'above' ? '📈' : '📉'} $${a.targetPrice} (${a.direction})\n`;
    });
    
    return sendTelegramMessage(chatId, msg);
  }
  
  if (text.startsWith('/remove ')) {
    const idx = parseInt(text.split(' ')[1]) - 1;
    const userAlerts = alerts.get(chatId) || [];
    
    if (isNaN(idx) || idx < 0 || idx >= userAlerts.length) {
      return sendTelegramMessage(chatId, '❌ Invalid alert number. Use /alerts to see your alerts.');
    }
    
    userAlerts.splice(idx, 1);
    return sendTelegramMessage(chatId, '✅ Alert removed.');
  }
}

// Main polling loop
async function startPolling() {
  if (!CONFIG.token) {
    console.log('Set TELEGRAM_BOT_TOKEN environment variable');
    return;
  }
  
  console.log('Telegram Price Alert Bot started');
  
  // Check prices and alerts periodically
  setInterval(async () => {
    try {
      const data = await fetchNearPrice();
      lastPrice.near = data.price;
      await checkAlerts(data.price);
    } catch (e) {
      console.error('Price check error:', e.message);
    }
  }, CONFIG.checkInterval);
  
  // Simple polling for messages (use webhook in production)
  let offset = 0;
  while (true) {
    try {
      const response = await new Promise((resolve, reject) => {
        https.get(`https://api.telegram.org/bot${CONFIG.token}/getUpdates?offset=${offset}&timeout=30`, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
      });
      
      if (response.ok && response.result) {
        for (const update of response.result) {
          offset = update.update_id + 1;
          if (update.message) {
            await processMessage(update.message);
          }
        }
      }
    } catch (e) {
      console.error('Polling error:', e.message);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

startPolling();

module.exports = { fetchNearPrice, processMessage, alerts };
