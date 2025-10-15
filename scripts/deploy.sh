#!/usr/bin/env bash
set -e

VPS=${VPS:-eu}

ssh "$VPS" bash <<'EOF'
set -e
cd ~/neon

# Load environment variables from .env file if it exists
if [ -f .env ]; then
    echo "📋 Loading environment from .env file..."
    export $(grep -v '^#' .env | xargs)
    echo "✅ Loaded TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN:0:10}..."
else
    echo "⚠️  No .env file found. Run 'make setup-env' first."
    exit 1
fi

docker network create emoji-net 2>/dev/null || true
docker volume create redis-data 2>/dev/null || true

echo "🧹 Cleaning old containers..."
docker rm -f redis backend frontend 2>/dev/null || true

echo "🚀 Starting redis..."
docker run -d \
  --network emoji-net \
  --name redis \
  -v redis-data:/data \
  redis:7-alpine \
  redis-server --save 60 1 --loglevel warning

echo "🚀 Starting backend..."
docker run -d \
  --network emoji-net \
  --name backend \
  -e REDIS_ADDR=redis:6379 \
  -e TELEGRAM_BOT_TOKEN="$TELEGRAM_BOT_TOKEN" \
  -p 8080:8080 \
  emoji-backend

echo "🚀 Starting frontend..."
docker run -d \
  --name frontend \
  --network emoji-net \
  -p 8081:80 \
  emoji-frontend

echo "✅ Deployed successfully!"
EOF
