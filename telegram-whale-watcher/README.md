# Telegram NEAR Whale Watcher Bot

Monitors large NEAR transactions and sends Telegram alerts.

## Features
- Real-time NEAR block monitoring
- Configurable whale threshold (default: 1000 NEAR)
- Large transaction alerts with explorer links
- Rate limiting

## Setup
```bash
npm install node-telegram-bot-api
TELEGRAM_BOT_TOKEN=xxx node bot.js
```

## Commands
- `/start` — Start monitoring
- `/stop` — Stop alerts
- `/status` — Bot status
- `/threshold <amount>` — Set alert threshold

## License
MIT
