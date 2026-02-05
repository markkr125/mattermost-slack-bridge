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
- **User mapping & identity spoofing** - map user IDs to custom display names and avatars
- **Thread support** - replies stay organized in threads
- **File sharing** - attachments sync between platforms
- **Message editing** - edits propagate to the other platform
- **Message deletion** - deletions sync bidirectionally
- **Reaction synchronization** - emoji reactions sync bidirectionally with automatic translation
- **Username & avatar preservation** - see who sent each message
- **Flexible storage backend** - Redis (default) or in-memory storage for development
- **Prometheus metrics** - `/metrics` endpoint for monitoring and observability
- **Exponential backoff reconnection** - smart reconnection with jitter to avoid thundering herd
- **Critical error alerting** - send alerts to configured Slack or Mattermost channel
- **Periodic health checks** - automatic status messages to monitor bridge health
- **Auto-reconnection** - WebSocket reconnects automatically on disconnect
- **Structured logging** - contextual logging with configurable log levels
- **Docker deployment** - ready-to-use Docker and docker-compose setup
- **Health monitoring** - built-in health check endpoint for container orchestration
- **Worker pools** - concurrent message processing for high-volume scenarios
- **Performance benchmarking** - built-in tools for performance analysis
- **Slash commands** - interactive bridge control and monitoring via `/bridge` command
- **User presence synchronization** - sync online/away/offline status between platforms

### Not Supported ❌
- Direct messages (DMs)
- Huddles/voice channels

---

## 🚀 Quick Start

### Option 1: Run with Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/markkr125/mattermost-slack-bridge.git
cd mattermost-slack-bridge

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Start with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f bridge-app
```

### Option 2: Run Locally

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

### Storage Backend Configuration

The bridge supports two storage backends for message mappings:

**Option 1: Redis (Recommended for Production)**

```env
STORAGE_BACKEND=redis
REDIS_URL=redis://localhost:6379
REDIS_EXPIRY_DAYS=180  # Default: 6 months
```

- **Pros**: Persistent storage, survives restarts, suitable for production
- **Cons**: Requires Redis server installation

**Option 2: In-Memory (Development/Testing)**

```env
STORAGE_BACKEND=memory
```

- **Pros**: No external dependencies, instant setup
- **Cons**: All mappings lost on restart, not suitable for production

**Configuration Options:**
- `STORAGE_BACKEND`: `redis` (default) or `memory`
- `REDIS_URL`: Connection string for your Redis instance (when using Redis backend)
- `REDIS_EXPIRY_DAYS`: How long to keep message mappings (default: 180 days)

---

### User Mapping Configuration

Override user identities for custom display names and avatars:

```env
# Map Slack users to custom Mattermost display names/avatars
SLACK_USER_MAPPINGS={"U12345":{"mm_user_id":"abc123","display_name":"John Doe","avatar_url":"https://example.com/avatar.jpg"}}

# Map Mattermost users to custom Slack display names/avatars  
MM_USER_MAPPINGS={"abc123":{"slack_user_id":"U12345","display_name":"John Doe","avatar_url":"https://example.com/avatar.jpg"}}
```

**Use Cases:**
- Consistent usernames across platforms
- Custom avatars for bots or service accounts
- Override default username/avatar fetching
- Fix mismatched identities

---

### Metrics & Monitoring

The bridge exposes Prometheus-compatible metrics at `/metrics` endpoint:

**Available Metrics:**
- `bridge_messages_total` - Counter of messages bridged per direction
- `bridge_message_latency_seconds` - Histogram of message processing latency
- `bridge_reconnections_total` - Counter of reconnection attempts
- `bridge_failed_events_total` - Counter of failed events
- `bridge_connection_status` - Gauge of connection status (1=connected, 0=disconnected)
- Plus default Node.js metrics (CPU, memory, etc.)

**Example Prometheus scrape config:**

```yaml
scrape_configs:
  - job_name: 'mattermost-slack-bridge'
    static_configs:
      - targets: ['localhost:3000']
```

---

### Error Alerting & Status Monitoring

Configure critical error alerts and periodic health checks:

```env
# Channel to send alerts (format: 'slack:CHANNEL_ID' or 'mm:CHANNEL_ID')
ALERT_CHANNEL=slack:C0123456789

# Periodic health check interval in minutes (default: 60)
HEALTH_CHECK_INTERVAL_MINUTES=60
```

**Alert Types:**
- **Critical alerts**: Authentication failures, permanent errors, reconnection failures
- **Status messages**: Periodic "Bridge healthy" messages
- **Error notifications**: WebSocket errors, initialization failures

The bridge uses exponential backoff with jitter for smart reconnections.

---

### Logging Configuration

Configure logging levels and behavior:

```env
LOG_LEVEL=info  # Options: error, warn, info, debug
```

**Log Levels:**
- `error`: Only critical errors
- `warn`: Warnings and errors
- `info`: General information, warnings, and errors (default)
- `debug`: Detailed debugging information (includes all levels)

The bridge uses structured logging with contextual information for better monitoring and troubleshooting.

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
   | `reactions:read` | Read emoji reactions |
   | `reactions:write` | Add/remove emoji reactions |

3. Click **Install to Workspace** at the top
4. **Copy the Bot User OAuth Token** (starts with `xoxb-`) → This is your `SLACK_BOT_TOKEN`

#### Step 3: Enable Event Subscriptions

1. Go to **Event Subscriptions** in the sidebar
2. Toggle **Enable Events** to **On**
3. Set **Request URL** to: `http://your-server:3000/slack/events`
   - For local development, use [ngrok](https://ngrok.com/): `ngrok http 3000`
   - For Docker deployment, ensure your container is accessible
   - Your server must be running for Slack to verify this URL
4. Under **Subscribe to bot events**, add:
   - `message.channels` - Listen for channel messages
   - `reaction_added` - Listen for reactions being added
   - `reaction_removed` - Listen for reactions being removed

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

**With Docker:**
```bash
docker-compose up -d
docker-compose logs -f bridge-app
```

**Locally:**
```bash
npm start
```

You should see:
```
[2026-02-05 10:30:00] INFO [redis]: Redis connected successfully
[2026-02-05 10:30:00] INFO [main]: Slack bot authenticated
[2026-02-05 10:30:00] INFO [main]: Mattermost bot authenticated
[2026-02-05 10:30:00] INFO [main]: Mattermost WebSocket connected
[2026-02-05 10:30:00] INFO [main]: Bridge server started
```

### Testing the Connection

1. Send a message in your Slack channel → should appear in Mattermost
2. Send a message in Mattermost → should appear in Slack
3. Edit a message on either platform → edit syncs to the other
4. Delete a message → deletion syncs bidirectionally
5. Add a reaction (emoji) → reaction syncs to the other platform
6. Remove a reaction → removal syncs bidirectionally

### Health Check

The bridge exposes a health check endpoint for monitoring:

```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "operational",
  "service": "mattermost-slack-bridge",
  "timestamp": "2026-02-05T10:30:00.000Z"
}
```

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

### Docker Issues

**Container won't start:**
```bash
# Check logs
docker-compose logs bridge-app

# Verify environment variables
docker-compose config

# Restart services
docker-compose restart
```

**Health check failing:**
```bash
# Test health endpoint
docker exec mattermost-slack-bridge wget -q -O- http://localhost:3000/health
```

---

## 🐳 Docker Deployment

### Using Docker Compose (Recommended)

1. **Configure environment:**
```bash
cp .env.example .env
# Edit .env with your actual credentials
```

2. **Start the services:**
```bash
docker-compose up -d
```

3. **View logs:**
```bash
docker-compose logs -f
```

4. **Stop the services:**
```bash
docker-compose down
```

### Using Docker Only

1. **Start Redis:**
```bash
docker run -d --name bridge-redis \
  -p 6379:6379 \
  redis:7-alpine
```

2. **Build the bridge image:**
```bash
docker build -t mattermost-slack-bridge .
```

3. **Run the bridge:**
```bash
docker run -d --name bridge-app \
  --link bridge-redis:redis \
  -p 3000:3000 \
  -e SLACK_BOT_TOKEN=xoxb-your-token \
  -e SLACK_SIGNING_SECRET=your-secret \
  -e MM_TOKEN=your-mm-token \
  -e MM_URL=https://your.mattermost.com \
  -e CHANNEL_MAPPINGS='[{"slack":"C123","mattermost":"mm123"}]' \
  -e REDIS_URL=redis://redis:6379 \
  -e LOG_LEVEL=info \
  mattermost-slack-bridge
```

### Environment Variables for Docker

All the same environment variables from `.env.example` can be passed to Docker:

- `SLACK_BOT_TOKEN` - Slack bot OAuth token
- `SLACK_SIGNING_SECRET` - Slack app signing secret
- `MM_TOKEN` - Mattermost personal access token
- `MM_URL` - Mattermost server URL
- `CHANNEL_MAPPINGS` - JSON array of channel mappings
- `REDIS_URL` - Redis connection URL
- `REDIS_EXPIRY_DAYS` - Message mapping expiry (default: 180)
- `LOG_LEVEL` - Logging level (error, warn, info, debug)
- `PORT` - Server port (default: 3000)

---

## 🚀 Advanced Features

### Worker Pools for High-Volume Scenarios

The bridge includes a concurrent message processor for handling high-volume message traffic efficiently.

**Configuration:**
```env
WORKER_POOL_SIZE=10  # Number of concurrent message processing workers (default: 10)
```

The worker pool automatically queues incoming messages and processes them concurrently up to the configured limit, preventing overload and ensuring smooth operation even during traffic spikes.

**Usage in Code:**
```javascript
const { MessageProcessor } = require('./src/utils/message-processor');

const processor = new MessageProcessor({ maxConcurrent: 10, name: 'messages' });

// Submit tasks for concurrent processing
await processor.submit(async () => {
  // Process message
});

// Get statistics
const stats = processor.snapshot();
console.log(`Completed: ${stats.completed}, Errors: ${stats.errors}`);
```

---

### Performance Benchmarking

Built-in performance monitoring and benchmarking tools help you measure and optimize bridge performance.

**Running Benchmarks:**
```bash
# Run all benchmarks
node tools/benchmark-cli.js --scenario all --iterations 100

# Run specific benchmark
node tools/benchmark-cli.js --scenario message-processing --iterations 50

# Test concurrent processing
node tools/benchmark-cli.js --scenario concurrent --pool-size 20 --iterations 200
```

**Available Scenarios:**
- `message-processing` - Message processing throughput
- `concurrent` - Concurrent message handling with worker pools
- `file-ops` - File operation simulation
- `all` - Run all benchmarks

**In-Application Monitoring:**
```javascript
const { perfMonitor } = require('./src/utils/perf-monitor');

// Track operation performance
const { output, measurement } = await perfMonitor.track('my-operation', async () => {
  // Your code here
  return result;
});

console.log(`Duration: ${measurement.durationMs}ms`);

// Generate report
console.log(perfMonitor.report());
```

---

### Slash Commands

Interactive bridge control and monitoring via slash commands in both Slack and Mattermost.

**Setup for Slack:**

1. Go to your Slack app configuration → **Slash Commands**
2. Click **Create New Command**
3. Configure the command:
   - Command: `/bridge`
   - Request URL: `https://your-server:3000/slack/events`
   - Short Description: `Control and monitor the Mattermost-Slack bridge`
   - Usage Hint: `[status|stats|perf|help]`
4. Save the command

**Setup for Mattermost:**

1. Go to **System Console** → **Integrations** → **Slash Commands**
2. Click **Add Slash Command**
3. Configure:
   - Command Trigger Word: `bridge`
   - Request URL: `https://your-server:3000/mattermost/commands`
   - Request Method: `POST`
   - Response Username: `Bridge Bot`
4. Save the command

**Available Commands:**

```bash
# Show bridge status and uptime
/bridge status

# Display connection statistics
/bridge stats

# View performance metrics
/bridge perf

# Show help message
/bridge help
```

All command responses are ephemeral (only visible to you).

---

### User Presence Synchronization

Synchronize user online/away/offline status between Slack and Mattermost.

**Configuration:**
```env
# Enable presence synchronization
PRESENCE_SYNC_ENABLED=true

# Sync interval in minutes (default: 5)
PRESENCE_SYNC_INTERVAL_MINUTES=5
```

**How It Works:**

1. **Slack → Mattermost**: When a Slack user's presence changes (active/away), their Mattermost status is updated
2. **Periodic Sync**: Every N minutes, all user presences are synchronized from Slack to Mattermost
3. **Status Mapping**:
   - Slack `active` → Mattermost `online`
   - Slack `away` → Mattermost `away`

**Note**: Due to Slack API limitations, bots cannot set user presence in Slack, so Mattermost → Slack presence sync is not fully supported.

**User Mapping:**

Presence sync requires user mappings to be configured. Users will be automatically mapped when they send messages, or you can configure explicit mappings in your user mappings configuration.

**Example:**
```javascript
const { registerPresenceMapping } = require('./src/handlers/presence');

// Register user mapping for presence sync
registerPresenceMapping('SLACK_USER_ID', 'MM_USER_ID');
```

---

## 🗺️ Roadmap

### Completed ✅
- ~~Better error handling~~
- ~~Persistent message storage with Redis~~
- ~~Edit/delete message support~~
- ~~Support multiple channel pairs~~
- ~~Advanced channel mapping configuration~~
- ~~Reaction synchronization~~
- ~~Better logging and monitoring~~
- ~~Docker deployment option~~
- ~~Flexible storage backends (Redis + in-memory)~~
- ~~User mapping and identity spoofing~~
- ~~Prometheus metrics and observability~~
- ~~Exponential backoff reconnections~~
- ~~Critical error alerting~~
- ~~Periodic health status monitoring~~
- ~~Worker pools for high-volume scenarios~~
- ~~Performance benchmarking tools~~
- ~~Slash commands support~~
- ~~User presence synchronization~~

### Planned 🚧
- Slack custom emoji support
- Optional sharding for distributed deployments

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

### Development Setup

**Local Development:**
```bash
git clone https://github.com/markkr125/mattermost-slack-bridge.git
cd mattermost-slack-bridge
npm install
cp .env.example .env
# Edit .env with your test credentials
npm start
```

**With Docker:**
```bash
docker-compose up --build
```

For detailed development instructions, see [Development Guide](docs/development.md).

### Running Tests

```bash
npm test                 # Run all tests
npm run test:watch      # Run tests in watch mode
npm run test:coverage   # Run tests with coverage report
```

### Continuous Integration

The project uses GitHub Actions for automated testing:
- Tests run automatically on pull requests to `main`
- Includes unit tests with 70%+ coverage requirement
- Tests run against Node.js 18 with Redis 7

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
