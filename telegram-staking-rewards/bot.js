const https = require('https');
const CONFIG = { token: process.env.TELEGRAM_BOT_TOKEN || '', checkInterval: 3600000, nearRpcUrl: 'https://rpc.mainnet.near.org' };
const subscribers = new Map();

async function nearRpc(method, params) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ jsonrpc: '2.0', id: 'staking-bot', method, params });
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

async function checkStaking() {
  try {
    const data = await nearRpc('validators', [null]);
    const epoch = data?.result;
    if (!epoch) return;
    const validators = epoch.current_validators || [];
    const totalStaked = validators.reduce((s, v) => s + BigInt(v.staked || '0'), BigInt(0));
    const avgApY = validators.length > 0 ? (validators.reduce((s, v) => s + (v.kyc_fee || 0), 0) / validators.length).toFixed(2) : 'N/A';
    const msg = `🏦 <b>NEAR Staking Rewards</b>\n\nEpoch: #${epoch.epoch_height || 'N/A'}\nValidators: ${validators.length}\nTotal Staked: ${(Number(totalStaked) / 1e24).toFixed(0)} NEAR\nAvg APY: ~${avgApY}%`;
    for (const [chatId] of subscribers) { await sendTelegram(chatId, msg).catch(() => {}); }
  } catch (e) { console.error('[Staking]', e.message); }
}

async function processMessage(msg) {
  const chatId = msg.chat.id;
  const text = msg.text || '';
  if (text === '/start') { subscribers.set(chatId, true); return sendTelegram(chatId, '🏦 <b>NEAR Staking Rewards</b>\n\nHourly staking updates.\n\n/staking — Current stats\n/status — Status\n/stop — Stop'); }
  if (text === '/stop') { subscribers.delete(chatId); return sendTelegram(chatId, '🔕 Alerts stopped.'); }
  if (text === '/staking') { await checkStaking(); }
  if (text === '/status') { return sendTelegram(chatId, `🏦 <b>Status</b>\n\nStatus: ✅ Active\nSubscribers: ${subscribers.size}`); }
}

async function startPolling() {
  if (!CONFIG.token) { console.log('Set TELEGRAM_BOT_TOKEN'); return; }
  console.log('Staking Rewards started');
  setInterval(checkStaking, CONFIG.checkInterval);
  checkStaking();
  let offset = 0;
  while (true) {
    try {
      const res = await new Promise((resolve, reject) => { https.get(`https://api.telegram.org/bot${CONFIG.token}/getUpdates?offset=${offset}&timeout=30`, (r) => { let d = ''; r.on('data', c => d += c); r.on('end', () => resolve(JSON.parse(d))); }).on('error', reject); });
      if (res.ok && res.result) { for (const u of res.result) { offset = u.update_id + 1; if (u.message) await processMessage(u.message); } }
    } catch (e) { await new Promise(r => setTimeout(r, 5000)); }
  }
}
startPolling();
module.exports = { checkStaking, processMessage };
