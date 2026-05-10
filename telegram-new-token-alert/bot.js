const https = require('https');
const CONFIG = { token: process.env.TELEGRAM_BOT_TOKEN || '', checkInterval: 120000, nearRpcUrl: 'https://rpc.mainnet.near.org' };
const knownTokens = new Set();
const subscribers = new Map();

async function nearRpc(method, params) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ jsonrpc: '2.0', id: 'token-bot', method, params });
    const url = new URL(CONFIG.nearRpcUrl);
    const req = https.request({ hostname: url.hostname, path: url.pathname, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d))); });
    req.on('error', reject); req.write(body); req.end();
  });
}

async function sendTelegram(chatId, text) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' });
    const url = new URL(`https://api.telegram.org/bot${CONFIG.token}/sendMessage`);
    const req = https.request({ hostname: url.hostname, path: url.pathname, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d))); });
    req.on('error', reject); req.write(body); req.end();
  });
}

async function checkNewTokens() {
  try {
    const res = await fetch('https://api.ref.finance/list-token-price', { headers: { 'Accept': 'application/json' } });
    const data = await res.json();
    const tokens = Object.values(data || {});
    for (const t of tokens) {
      const id = t.id || t.symbol;
      if (!id || knownTokens.has(id)) continue;
      knownTokens.add(id);
      const msg = `🪙 <b>New NEAR Token!</b>\n\n📛 Name: <b>${t.name || 'Unknown'}</b>\n🔤 Symbol: <code>${t.symbol || 'N/A'}</code>\n💰 Price: $${t.price || 'TBA'}\n🔗 <a href="https://ref.finance">View on Ref Finance</a>`;
      for (const [chatId] of subscribers) { await sendTelegram(chatId, msg).catch(() => {}); }
    }
  } catch (e) { console.error('[Token]', e.message); }
}

async function processMessage(msg) {
  const chatId = msg.chat.id;
  const text = msg.text || '';
  if (text === '/start') { subscribers.set(chatId, true); return sendTelegram(chatId, '🪙 <b>NEAR New Token Alert</b>\n\nMonitoring for new tokens on Ref Finance.\n\n/status — Status\n/stop — Stop alerts'); }
  if (text === '/stop') { subscribers.delete(chatId); return sendTelegram(chatId, '🔕 Alerts stopped.'); }
  if (text === '/status') { return sendTelegram(chatId, `🪙 <b>Status</b>\n\nStatus: ✅ Active\nKnown tokens: ${knownTokens.size}\nSubscribers: ${subscribers.size}`); }
}

async function startPolling() {
  if (!CONFIG.token) { console.log('Set TELEGRAM_BOT_TOKEN'); return; }
  console.log('New Token Alert started');
  setInterval(checkNewTokens, CONFIG.checkInterval);
  checkNewTokens();
  let offset = 0;
  while (true) {
    try {
      const res = await new Promise((resolve, reject) => { https.get(`https://api.telegram.org/bot${CONFIG.token}/getUpdates?offset=${offset}&timeout=30`, (r) => { let d = ''; r.on('data', c => d += c); r.on('end', () => resolve(JSON.parse(d))); }).on('error', reject); });
      if (res.ok && res.result) { for (const u of res.result) { offset = u.update_id + 1; if (u.message) await processMessage(u.message); } }
    } catch (e) { await new Promise(r => setTimeout(r, 5000)); }
  }
}
startPolling();
module.exports = { checkNewTokens, processMessage };
