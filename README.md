# Mattermost-Slack Bridge

> An experimental bidirectional bridge connecting Mattermost and Slack channels. Not affiliated with Mattermost or Slack.

## 📚 Documentation

- **[Architecture](docs/architecture.md)** - System design and component overview
- **[API Reference](docs/api.md)** - Module and function documentation
- **[Development Guide](docs/development.md)** - Local setup and testing
- **[Deployment Guide](docs/deployment.md)** - Production deployment strategies

---

## 📋 Table of Contents

- [Features](#-features)
- [Quick Start](#-quick-start)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Configuration](#-configuration)
  - [Redis Setup](#redis-setup)
  - [Slack App Configuration](#slack-app-configuration)
  - [Mattermost Bot Configuration](#mattermost-bot-configuration)
- [Usage](#-usage)
- [Troubleshooting](#-troubleshooting)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)

---

## ✨ Features

### Supported ✅
- **Bidirectional messaging** between Slack and Mattermost channels
- **Multiple channel pairs** - bridge multiple Slack-Mattermost channel pairs simultaneously
- **Advanced channel mapping** - flexible JSON-based configuration for channel routing
- **Thread support** - replies stay organized in threads
- **File sharing** - attachments sync between platforms
- **Message editing** - edits propagate to the other platform
- **Message deletion** - deletions sync bidirectionally
- **Username & avatar preservation** - see who sent each message
- **Persistent message mapping** - using Redis with configurable expiry (default: 6 months)
- **Auto-reconnection** - WebSocket reconnects automatically on disconnect

### Not Supported ❌
- Direct messages (DMs)
- Huddles/voice channels

---

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/markkr125/mattermost-slack-bridge.git
cd mattermost-slack-bridge

# Install dependencies
npm install

# Set up Redis (required)
# On macOS: brew install redis && brew services start redis
# On Ubuntu: sudo apt-get install redis-server && sudo service redis start
# On Docker: docker run -d -p 6379:6379 redis:alpine

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Start the bridge
npm start
```

---

## 📦 Prerequisites

- **Node.js** 14 or higher (required for ES6 features and regex lookbehinds)
- **Redis** server (for persistent message mapping)
- **Slack** workspace admin access to create an app
- **Mattermost** instance with admin access

---

## 🔧 Installation

### 1. Clone & Install

```bash
git clone https://github.com/markkr125/mattermost-slack-bridge.git
cd mattermost-slack-bridge
npm install
```

### 2. Set Up Redis

The bridge requires Redis to store message mappings persistently.

**Option A: Local Redis**
```bash
# macOS
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt-get install redis-server
sudo service redis start

# Verify it's running
redis-cli ping  # Should return "PONG"
```

**Option B: Docker**
```bash
docker run -d --name redis -p 6379:6379 redis:alpine
```

**Option C: Cloud Redis** (RedisLabs, AWS ElastiCache, etc.)
- Use the connection URL provided by your service

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials (see [Configuration](#-configuration) section below).

---

## ⚙️ Configuration

### Channel Mapping Configuration

The bridge supports two configuration modes:

#### 1. Single Channel Pair (Legacy Mode)

For a simple single channel pair, use environment variables:

```env
SLACK_CHANNEL_ID=C0123456789
MM_CHANNEL_ID=abcde12345
```

#### 2. Multiple Channel Pairs (Advanced Mode)

For multiple channel pairs, use the `CHANNEL_MAPPINGS` environment variable with JSON format:

```env
CHANNEL_MAPPINGS=[{"slack":"C0123456789","mattermost":"abcde12345"},{"slack":"C9876543210","mattermost":"zyxwv98765"}]
```

**Configuration Examples:**

**Two channel pairs:**
```env
CHANNEL_MAPPINGS=[{"slack":"C01ABC123","mattermost":"ch1abc123"},{"slack":"C02DEF456","mattermost":"ch2def456"}]
```

**Three channel pairs:**
```env
# Note: Multi-line formatting shown below is for readability only.
# The actual .env value must be on a single line or properly escaped for your shell.
CHANNEL_MAPPINGS=[{"slack":"C01ABC123","mattermost":"ch1abc123"},{"slack":"C02DEF456","mattermost":"ch2def456"},{"slack":"C03GHI789","mattermost":"ch3ghi789"}]
```

**Notes:**
- If `CHANNEL_MAPPINGS` is set, it takes precedence over `SLACK_CHANNEL_ID` and `MM_CHANNEL_ID`
- Each mapping requires both `slack` and `mattermost` fields
- The bridge will log all configured channel mappings on startup
- Thread mappings are kept separate per channel pair (no cross-channel thread confusion)

---

### Redis Setup

Add Redis connection details to your `.env` file:

```env
REDIS_URL=redis://localhost:6379
REDIS_EXPIRY_DAYS=180  # Default: 6 months
```

**Configuration Options:**
- `REDIS_URL`: Connection string for your Redis instance
- `REDIS_EXPIRY_DAYS`: How long to keep message mappings (default: 180 days)

---

### Slack App Configuration

#### Step 1: Create a Slack App

1. Go to [https://api.slack.com/apps](https://api.slack.com/apps)
2. Click **Create New App** → **From scratch**
3. Name your app (e.g., "Mattermost Bridge") and select your workspace

#### Step 2: Configure OAuth & Permissions

1. Navigate to **OAuth & Permissions** in the sidebar
2. Scroll to **Bot Token Scopes** and add these scopes:

   | Scope | Purpose |
   |-------|---------|
   | `chat:write` | Send messages |
   | `chat:write.customize` | Use custom usernames and avatars |
   | `files:read` | Access shared files |
   | `channels:history` | Read channel messages |
   | `channels:read` | View channel info |
   | `users:read` | Get user profiles |

3. Click **Install to Workspace** at the top
4. **Copy the Bot User OAuth Token** (starts with `xoxb-`) → This is your `SLACK_BOT_TOKEN`

#### Step 3: Enable Event Subscriptions

1. Go to **Event Subscriptions** in the sidebar
2. Toggle **Enable Events** to **On**
3. Set **Request URL** to: `http://your-server:3000/slack/events`
   - For local development, use [ngrok](https://ngrok.com/): `ngrok http 3000`
   - Your server must be running for Slack to verify this URL
4. Under **Subscribe to bot events**, add:
   - `message.channels` - Listen for channel messages

5. **Save Changes**

#### Step 4: Get Additional Credentials

- **Signing Secret**: Go to **Basic Information** → **App Credentials** → Copy the **Signing Secret**
- **Channel ID**: 
  1. Open Slack, right-click your target channel
  2. Select **View channel details**
  3. Scroll to the bottom and copy the **Channel ID** (e.g., `C0123456789`)

Add these to your `.env`:
```env
SLACK_BOT_TOKEN=xoxb-your-token-here
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_CHANNEL_ID=C0123456789
```

---

### Mattermost Bot Configuration

#### Step 1: Enable Bot Accounts & Integrations

1. Log in to Mattermost as **System Admin**
2. Go to **System Console** → **Integrations** → **Integration Management**
3. Enable the following settings:
   - ✅ **Enable Bot Accounts**
   - ✅ **Enable Personal Access Tokens**
   - ✅ **Enable integrations to override usernames**
   - ✅ **Enable integrations to override profile picture icons**

#### Step 2: Create a Bot Account

1. Exit System Console and go to **Main Menu** → **Integrations**
2. Select **Bot Accounts** → **Add Bot Account**
3. Configure the bot:
   - **Username**: e.g., `slack-bridge`
   - **Display Name**: e.g., `Slack Bridge`
   - **Role**: Enable **post:all** permission
4. Click **Create Bot Account**
5. **Copy the Access Token** → This is your `MM_TOKEN`

#### Step 3: Get Channel ID

1. Open the channel you want to bridge
2. Click the channel name → **View Info**
3. The URL will show the channel ID (e.g., `abcde12345`)
   - Example: `https://your.mattermost.com/team/channels/abcde12345`

Add these to your `.env`:
```env
MM_TOKEN=your-mattermost-token
MM_URL=https://your.mattermost.com
MM_CHANNEL_ID=abcde12345
```

---

## 🎯 Usage

### Starting the Bridge

```bash
npm start
```

You should see:
```
Redis connected
Mattermost WebSocket connected
Bridge running on port 3000
```

### Testing the Connection

1. Send a message in your Slack channel → should appear in Mattermost
2. Send a message in Mattermost → should appear in Slack
3. Edit a message on either platform → edit syncs to the other
4. Delete a message → deletion syncs bidirectionally

---

## 🔍 Troubleshooting

### Redis Connection Issues

**Error: `Redis connection refused`**
```bash
# Check if Redis is running
redis-cli ping

# If not running:
# macOS: brew services start redis
# Linux: sudo service redis-server start
# Docker: docker start redis
```

### Slack Event Subscriptions Failing

**Error: `url_verification failed`**
- Ensure your bridge is running before setting up the Request URL
- For local development, use ngrok: `ngrok http 3000`
- Check that PORT in `.env` matches your server port

### Messages Not Syncing

1. **Check logs** for error messages
2. **Verify bot permissions**:
   - Slack bot is added to the channel
   - Mattermost bot has access to the channel
3. **Check Redis**:
   ```bash
   redis-cli
   > KEYS *  # Should show stored message mappings
   ```

### WebSocket Disconnects

The bridge automatically reconnects after 5 seconds. If it keeps disconnecting:
- Check your Mattermost server status
- Verify `MM_TOKEN` is valid and hasn't expired
- Check firewall settings

---

## 🗺️ Roadmap

### Completed ✅
- ~~Better error handling~~
- ~~Persistent message storage with Redis~~
- ~~Edit/delete message support~~
- ~~Support multiple channel pairs~~
- ~~Advanced channel mapping configuration~~

### Planned 🚧
- Reaction synchronization
- Better logging and monitoring
- Docker deployment option

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

### Development Setup

```bash
git clone https://github.com/markkr125/mattermost-slack-bridge.git
cd mattermost-slack-bridge
npm install
cp .env.example .env
# Edit .env with your test credentials
npm start
```

For detailed development instructions, see [Development Guide](docs/development.md).

### Running Tests

```bash
npm test                 # Run all tests
npm run test:watch      # Run tests in watch mode
npm run test:coverage   # Run tests with coverage report
```

### Project Structure

The project has been refactored into a modular structure:

```
src/
├── config/          # Configuration management
├── handlers/        # Message handlers for Slack and Mattermost
├── storage/         # Redis storage layer
├── utils/           # Utility functions (markdown conversion)
└── index.js         # Main application entry point

__tests__/           # Jest unit tests
docs/                # Documentation
```

See [Architecture Documentation](docs/architecture.md) for more details.

---

## 🙋 Support

If you encounter issues:
1. Check the [Troubleshooting](#-troubleshooting) section
2. Review existing [GitHub Issues](https://github.com/markkr125/mattermost-slack-bridge/issues)
3. Open a new issue with:
   - Bridge version
   - Node.js version
   - Error logs
   - Steps to reproduce

---

**Note**: This is an experimental project and not officially supported by Mattermost or Slack.
