/**
 * Telegram NEAR Whale Watcher Bot
 * Monitors large NEAR transactions and sends Telegram alerts
 */

const https = require('https');

const CONFIG = {
  token: process.env.TELEGRAM_BOT_TOKEN || '',
  threshold: parseFloat(process.env.WHALE_THRESHOLD || '1000'),
  checkInterval: 60000,
  nearRpcUrl: 'https://rpc.mainnet.near.org',
};

const processedBlocks = new Set();
const alerts = new Map();

async function nearRpc(method, params) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ jsonrpc: '2.0', id: 'whale-bot', method, params });
    const url = new URL(CONFIG.nearRpcUrl);
    const req = https.request({
      hostname: url.hostname, path: url.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
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

async function sendTelegram(chatId, text) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' });
    const url = new URL(`https://api.telegram.org/bot${CONFIG.token}/sendMessage`);
    const req = https.request({
      hostname: url.hostname, path: url.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
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

function formatNear(yocto) {
  const n = Number(BigInt(yocto)) / 1e24;
  if (n >= 1000) return `${(n/1000).toFixed(1)}K NEAR`;
  return `${n.toFixed(2)} NEAR`;
}

async function checkWhales() {
  try {
    const block = await nearRpc('block', { finality: 'final' });
    if (!block?.result?.header) return;

    const height = block.result.header.height;
    const hash = block.result.header.hash;
    if (processedBlocks.has(hash)) return;
    processedBlocks.add(hash);

    if (processedBlocks.size > 5000) {
      const arr = [...processedBlocks];
      for (let i = 0; i < arr.length - 2500; i++) processedBlocks.delete(arr[i]);
    }

    for (const chunk of (block.result.chunks || [])) {
      try {
        const chunkData = await nearRpc('chunk', { chunk_id: chunk.chunk_hash });
        if (!chunkData?.result?.transactions) continue;

        for (const tx of chunkData.result.transactions) {
          for (const action of (tx.actions || [])) {
            if (action.Transfer) {
              const amount = Number(BigInt(action.Transfer.deposit)) / 1e24;
              if (amount >= CONFIG.threshold) {
                const msg = `🐋 <b>NEAR Whale Alert!</b>\n\n` +
                  `💰 Amount: <b>${formatNear(action.Transfer.deposit)}</b>\n` +
                  `📤 From: <code>${tx.signer_id || 'unknown'}</code>\n` +
                  `📥 To: <code>${tx.receiver_id || 'unknown'}</code>\n` +
                  `📦 Block: #${height}\n` +
                  `🔗 <a href="https://nearblocks.io/txns/${tx.hash}">View on Explorer</a>`;

                for (const [chatId] of alerts) {
                  await sendTelegram(chatId, msg).catch(() => {});
                }
              }
            }
          }
        }
      } catch (e) {}
    }
  } catch (e) {
    console.error('[Monitor]', e.message);
  }
}

async function processMessage(msg) {
  const chatId = msg.chat.id;
  const text = msg.text || '';

  if (text === '/start') {
    alerts.set(chatId, true);
    return sendTelegram(chatId,
      `🐋 <b>NEAR Whale Watcher</b>\n\n` +
      `Monitoring large NEAR transactions (>${CONFIG.threshold} NEAR)\n\n` +
      `Commands:\n` +
      `/status — Bot status\n` +
      `/threshold <amount> — Set alert threshold\n` +
      `/stop — Stop alerts`
    );
  }

  if (text === '/stop') {
    alerts.delete(chatId);
    return sendTelegram(chatId, '🔕 Alerts stopped. Use /start to resume.');
  }

  if (text === '/status') {
    return sendTelegram(chatId,
      `🐋 <b>Status</b>\n\n` +
      `Status: ✅ Active\n` +
      `Threshold: ${CONFIG.threshold} NEAR\n` +
      `Blocks scanned: ${processedBlocks.size}\n` +
      `Active subscribers: ${alerts.size}`
    );
  }

  if (text.startsWith('/threshold ')) {
    const newVal = parseFloat(text.split(' ')[1]);
    if (!isNaN(newVal) && newVal > 0) {
      CONFIG.threshold = newVal;
      return sendTelegram(chatId, `✅ Threshold updated to ${newVal} NEAR`);
    }
    return sendTelegram(chatId, '❌ Invalid threshold');
  }
}

async function startPolling() {
  if (!CONFIG.token) { console.log('Set TELEGRAM_BOT_TOKEN'); return; }
  console.log('Whale Watcher started');

  setInterval(checkWhales, CONFIG.checkInterval);
  checkWhales();

  let offset = 0;
  while (true) {
    try {
      const res = await new Promise((resolve, reject) => {
        https.get(`https://api.telegram.org/bot${CONFIG.token}/getUpdates?offset=${offset}&timeout=30`, (r) => {
          let d = ''; r.on('data', c => d += c); r.on('end', () => resolve(JSON.parse(d)));
        }).on('error', reject);
      });

      if (res.ok && res.result) {
        for (const update of res.result) {
          offset = update.update_id + 1;
          if (update.message) await processMessage(update.message);
        }
      }
    } catch (e) {
      console.error('Polling error:', e.message);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

startPolling();
module.exports = { checkWhales, processMessage, alerts };
