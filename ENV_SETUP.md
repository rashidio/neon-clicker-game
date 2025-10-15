# Environment Setup

## Required Environment Variables

### Backend (.env or environment variables)

```bash
# Telegram Bot Token for authentication
# Get this from @BotFather on Telegram
TELEGRAM_BOT_TOKEN=your_bot_token_here

# Redis connection address (optional, defaults to localhost:6379)
REDIS_ADDR=localhost:6379
```

### Frontend (.env.local or environment variables)

```bash
# For local development - bypasses Telegram authentication
VITE_FORCE_USER_ID=1234567
```

## Setup Instructions

1. **Create a Telegram Bot:**
   - Message @BotFather on Telegram
   - Use `/newbot` command
   - Follow instructions to get your bot token
   - Set the bot token as `TELEGRAM_BOT_TOKEN` environment variable

2. **Configure your Mini App:**
   - In BotFather, use `/setmenubutton` command
   - Set the web app URL to your deployed frontend URL
   - The bot will now show a "Menu" button that opens your game

3. **Local Development:**
   - Set `VITE_FORCE_USER_ID=1234567` to enable local development mode
   - This creates mock Telegram init data for testing
   - No real Telegram bot token needed for local development
   - Console will show "🔧 Local dev mode: Using mock Telegram init data"

## Security Features

- **Telegram HMAC Validation:** All requests are validated using Telegram's signature
- **Session Management:** Sessions are stored in Redis with 24-hour expiration
- **Local Development Mode:** User ID 1234567 bypasses authentication for testing
- **Automatic Session Creation:** Sessions are created on first authenticated request

## API Authentication

The API supports two authentication methods:

1. **Telegram Init Data:** `Authorization: tma <init_data>`
2. **Session Token:** `Authorization: Bearer <session_id>`

For local development, requests with `user_id=1234567` query parameter are automatically authenticated.

