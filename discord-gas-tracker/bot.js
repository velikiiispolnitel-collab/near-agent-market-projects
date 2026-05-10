/**
 * Discord NEAR Gas Tracker Bot
 * Real-time NEAR gas price monitoring with alerts
 */

const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

const CONFIG = {
  token: process.env.DISCORD_BOT_TOKEN || '',
  channelId: process.env.ALERT_CHANNEL_ID || '',
  checkInterval: parseInt(process.env.CHECK_INTERVAL || '60000'),
  nearRpcUrl: 'https://rpc.mainnet.near.org',
};

// Gas price history for trends
const gasHistory = [];
const MAX_HISTORY = 1440; // 24 hours at 1 min intervals

async function fetchGasPrice() {
  try {
    const res = await fetch(CONFIG.nearRpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 'gas-tracker', method: 'gas_price', params: [null],
      }),
    });
    const data = await res.json();
    return data?.result?.gas_price || null;
  } catch (err) {
    console.error('[RPC] Gas price error:', err.message);
    return null;
  }
}

function formatGasPrice(yoctoNear) {
  const near = Number(BigInt(yoctoNear)) / 1e24;
  if (near >= 1) return `${near.toFixed(6)} NEAR`;
  if (near >= 0.001) return `${(near * 1000).toFixed(4)} mNEAR`;
  return `${yoctoNear} yoctoNEAR`;
}

function getTrend() {
  if (gasHistory.length < 2) return '→';
  const latest = Number(BigInt(gasHistory[gasHistory.length - 1])) / 1e24;
  const prev = Number(BigInt(gasHistory[gasHistory.length - 2])) / 1e24;
  const change = ((latest - prev) / prev) * 100;
  if (change > 5) return '📈';
  if (change < -5) return '📉';
  return '→';
}

function getAverageGas() {
  if (gasHistory.length === 0) return 'N/A';
  const sum = gasHistory.reduce((s, p) => s + Number(BigInt(p)), 0);
  return formatGasPrice(String(Math.floor(sum / gasHistory.length)));
}

async function checkGasPrice() {
  const price = await fetchGasPrice();
  if (!price) return;

  gasHistory.push(price);
  if (gasHistory.length > MAX_HISTORY) gasHistory.shift();

  console.log(`[Gas] ${formatGasPrice(price)} ${getTrend()}`);
}

// Commands
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const content = message.content.trim();

  if (content === '!gas') {
    const price = await fetchGasPrice();
    if (!price) return message.reply('❌ Error fetching gas price.');

    const trend = getTrend();
    const avg = getAverageGas();

    const embed = new EmbedBuilder()
      .setTitle('⛽ NEAR Gas Price')
      .setColor(0x00AAFF)
      .addFields(
        { name: 'Current', value: `**${formatGasPrice(price)}** ${trend}`, inline: true },
        { name: '24h Avg', value: avg, inline: true },
        { name: 'Samples', value: `${gasHistory.length}`, inline: true },
      )
      .setTimestamp()
      .setFooter({ text: 'NEAR Gas Tracker' });

    return message.reply({ embeds: [embed] });
  }

  if (content === '!gas status') {
    const embed = new EmbedBuilder()
      .setTitle('⛽ Gas Tracker Status')
      .setColor(0x00FF00)
      .addFields(
        { name: 'Status', value: '✅ Active', inline: true },
        { name: 'Check Interval', value: `${CONFIG.checkInterval / 1000}s`, inline: true },
        { name: 'History Size', value: `${gasHistory.length}`, inline: true },
      )
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }

  if (content === '!gas help') {
    const embed = new EmbedBuilder()
      .setTitle('⛽ NEAR Gas Tracker — Commands')
      .setColor(0x00AAFF)
      .addFields(
        { name: '!gas', value: 'Show current gas price with trend' },
        { name: '!gas status', value: 'Show bot status' },
        { name: '!gas help', value: 'Show this help' },
      );

    return message.reply({ embeds: [embed] });
  }
});

client.once('ready', () => {
  console.log(`✅ Gas Tracker online as ${client.user.tag}`);
  setInterval(checkGasPrice, CONFIG.checkInterval);
  checkGasPrice();
});

process.on('SIGINT', () => { client.destroy(); process.exit(0); });
process.on('SIGTERM', () => { client.destroy(); process.exit(0); });

if (CONFIG.token) {
  client.login(CONFIG.token);
} else {
  console.log('Set DISCORD_BOT_TOKEN to start');
}

module.exports = { client, CONFIG, fetchGasPrice, formatGasPrice };
