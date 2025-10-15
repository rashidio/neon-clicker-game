#!/usr/bin/env bash
set -e

VPS=${VPS:-eu}

# Check if TELEGRAM_BOT_TOKEN is set locally
if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
    echo "❌ TELEGRAM_BOT_TOKEN not set locally. Please set it first:"
    echo "export TELEGRAM_BOT_TOKEN=your_bot_token_here"
    exit 1
fi

echo "🔧 Setting up environment on VPS..."

# Store the bot token in a .env file on the VPS
ssh "$VPS" bash <<EOF
set -e
cd ~/neon

# Create .env file with the bot token
cat > .env << 'ENVEOF'
# Telegram Bot Token for authentication
TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN

# Redis connection address
REDIS_ADDR=redis:6379
ENVEOF

echo "✅ Created .env file on VPS with bot token"
echo "TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN:0:10}..."
echo "REDIS_ADDR: redis:6379"
echo ""
echo "🚀 You can now run: make deploy"
EOF
