/**
 * Discord NEAR NFT Drop Alert Bot
 * Monitors NEAR NFT marketplaces for new drops and alerts Discord channels
 */

const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

const CONFIG = {
  token: process.env.DISCORD_BOT_TOKEN || '',
  channelId: process.env.ALERT_CHANNEL_ID || '',
  checkInterval: parseInt(process.env.CHECK_INTERVAL || '120000'),
};

const knownCollections = new Set();
let totalAlerts = 0;

// Fetch recent NFT contracts on NEAR
async function fetchNewNFTs() {
  try {
    const res = await fetch('https://api.mintbase.xyz/v1/mainnet/contracts?limit=20&offset=0', {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data?.data || data?.contracts || data || [];
  } catch (err) {
    console.error('[NFT] Fetch error:', err.message);
    return [];
  }
}

async function checkNewDrops() {
  const nfts = await fetchNewNFTs();
  const newDrops = [];

  for (const nft of nfts) {
    const id = nft.contract_id || nft.id || nft.name;
    if (!id || knownCollections.has(id)) continue;
    knownCollections.add(id);
    newDrops.push(nft);
  }

  if (newDrops.length > 0 && CONFIG.channelId) {
    try {
      const channel = await client.channels.fetch(CONFIG.channelId);
      for (const drop of newDrops.slice(0, 5)) {
        const name = drop.name || drop.title || drop.contract_id || 'Unknown';
        const creator = drop.owner_id || drop.creator || 'Unknown';
        const price = drop.price ? `${drop.price} NEAR` : 'TBA';

        const embed = new EmbedBuilder()
          .setTitle('🎨 New NEAR NFT Drop!')
          .setColor(0xFF6B00)
          .addFields(
            { name: 'Collection', value: name, inline: true },
            { name: 'Creator', value: `\`${creator}\``, inline: true },
            { name: 'Price', value: price, inline: true },
          )
          .setTimestamp()
          .setFooter({ text: 'NEAR NFT Alert Bot' });

        await channel.send({ embeds: [embed] });
        totalAlerts++;
      }
    } catch (err) {
      console.error('[Alert] Send error:', err.message);
    }
  }

  console.log(`[NFT] Checked: ${nfts.length} total, ${newDrops.length} new`);
}

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const content = message.content.trim();

  if (content === '!nft') {
    const embed = new EmbedBuilder()
      .setTitle('🎨 NEAR NFT Alert Status')
      .setColor(0x00FF00)
      .addFields(
        { name: 'Status', value: '✅ Active', inline: true },
        { name: 'Known Collections', value: `${knownCollections.size}`, inline: true },
        { name: 'Total Alerts', value: `${totalAlerts}`, inline: true },
      )
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }

  if (content === '!nft help') {
    const embed = new EmbedBuilder()
      .setTitle('🎨 NEAR NFT Alert — Commands')
      .setColor(0xFF6B00)
      .addFields(
        { name: '!nft', value: 'Show bot status' },
        { name: '!nft help', value: 'Show this help' },
      );
    return message.reply({ embeds: [embed] });
  }
});

client.once('ready', () => {
  console.log(`✅ NFT Alert bot online as ${client.user.tag}`);
  setInterval(checkNewDrops, CONFIG.checkInterval);
  checkNewDrops();
});

process.on('SIGINT', () => { client.destroy(); process.exit(0); });
process.on('SIGTERM', () => { client.destroy(); process.exit(0); });

if (CONFIG.token) client.login(CONFIG.token);
else console.log('Set DISCORD_BOT_TOKEN to start');

module.exports = { client, CONFIG, checkNewDrops };
