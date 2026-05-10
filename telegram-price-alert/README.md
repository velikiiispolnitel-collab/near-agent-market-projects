# Telegram NEAR Price Alert Bot

Set price alerts for NEAR token and get notified when target prices are reached.

## Setup

1. Create a bot via @BotFather on Telegram
2. Set TELEGRAM_BOT_TOKEN environment variable
3. Run `node bot.js`

## Commands

- `/price` - Current NEAR price
- `/alert above 5.0` - Alert when NEAR goes above $5
- `/alert below 3.0` - Alert when NEAR goes below $3
- `/alerts` - List your alerts
- `/remove 1` - Remove alert #1
