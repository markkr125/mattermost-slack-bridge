# Environment Variables Reference

Complete reference for all environment variables used in the Mattermost-Slack Bridge.

## Table of Contents

- [Core Configuration](#core-configuration)
- [Channel Mapping](#channel-mapping)
- [Storage Backend](#storage-backend)
- [Logging](#logging)
- [User Mapping](#user-mapping)
- [Alerting & Monitoring](#alerting--monitoring)
- [Worker Pools](#worker-pools)
- [Presence Synchronization](#presence-synchronization)
- [Custom Emoji Synchronization](#custom-emoji-synchronization)
- [Sharding Configuration](#sharding-configuration)

---

## Core Configuration

### `SLACK_BOT_TOKEN`

**Description:** OAuth token for your Slack bot

**Type:** String (required)

**Format:** Starts with `xoxb-`

**Example:**
```env
SLACK_BOT_TOKEN=xoxb-XXXXXXXXXXXX-XXXXXXXXXXXXX-XXXXXXXXXXXXXXXXXXXXXXXX
```

**How to obtain:**
1. Go to [https://api.slack.com/apps](https://api.slack.com/apps)
2. Select your app → **OAuth & Permissions**
3. Install app to workspace
4. Copy the **Bot User OAuth Token**

---

### `SLACK_SIGNING_SECRET`

**Description:** Signing secret for verifying Slack requests

**Type:** String (required)

**Format:** 32-character hexadecimal string

**Example:**
```env
SLACK_SIGNING_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

**How to obtain:**
1. Go to your Slack app → **Basic Information**
2. Under **App Credentials**, find **Signing Secret**
3. Copy the value

---

### `MM_TOKEN`

**Description:** Mattermost personal access token for bot authentication

**Type:** String (required)

**Example:**
```env
MM_TOKEN=yourmattermostpersonalaccesstoken123456789
```

**How to obtain:**
1. Log in to Mattermost as System Admin
2. Enable **Personal Access Tokens** in System Console
3. Go to **Account Settings** → **Security** → **Personal Access Tokens**
4. Create new token with description "Slack Bridge"
5. Copy the token (shown only once)

---

### `MM_URL`

**Description:** Base URL of your Mattermost server

**Type:** String (required)

**Format:** URL without trailing slash

**Example:**
```env
MM_URL=https://mattermost.example.com
```

**Notes:**
- Do not include `/api/v4` or trailing slash
- Must include protocol (`http://` or `https://`)

---

### `PORT`

**Description:** Port number for the bridge HTTP server

**Type:** Integer (optional)

**Default:** `3000`

**Example:**
```env
PORT=3000
```

**Notes:**
- Used for Slack event subscriptions endpoint
- Used for health check endpoint (`/health`)
- Used for metrics endpoint (`/metrics`)
- Used for Mattermost slash commands endpoint (`/mattermost/commands`)

---

## Channel Mapping

### `CHANNEL_MAPPINGS`

**Description:** JSON array mapping Slack channels to Mattermost channels (modern approach)

**Type:** JSON Array (optional, but recommended for multiple channels)

**Format:**
```json
[
  {"slack": "SLACK_CHANNEL_ID", "mattermost": "MM_CHANNEL_ID"},
  {"slack": "SLACK_CHANNEL_ID", "mattermost": "MM_CHANNEL_ID"}
]
```

**Example:**
```env
CHANNEL_MAPPINGS=[{"slack":"C01ABC123","mattermost":"ch1def456"},{"slack":"C02GHI789","mattermost":"ch2jkl012"}]
```

**Notes:**
- Takes precedence over `SLACK_CHANNEL_ID` and `MM_CHANNEL_ID`
- Supports multiple channel pairs
- Each mapping must have both `slack` and `mattermost` fields
- Use this format for production deployments with multiple channels

**How to find channel IDs:**
- **Slack**: Right-click channel → View channel details → Copy Channel ID
- **Mattermost**: Open channel → Channel info → Channel ID in URL or info panel

---

### `SLACK_CHANNEL_ID` (Legacy)

**Description:** Single Slack channel ID to bridge (legacy single-channel mode)

**Type:** String (optional)

**Format:** Starts with `C`

**Example:**
```env
SLACK_CHANNEL_ID=C0123456789
```

**Notes:**
- Legacy configuration for backward compatibility
- Only used if `CHANNEL_MAPPINGS` is not set
- Must be used together with `MM_CHANNEL_ID`

---

### `MM_CHANNEL_ID` (Legacy)

**Description:** Single Mattermost channel ID to bridge (legacy single-channel mode)

**Type:** String (optional)

**Example:**
```env
MM_CHANNEL_ID=abcde12345fghij67890
```

**Notes:**
- Legacy configuration for backward compatibility
- Only used if `CHANNEL_MAPPINGS` is not set
- Must be used together with `SLACK_CHANNEL_ID`

---

## Storage Backend

### `STORAGE_BACKEND`

**Description:** Storage backend for message mappings

**Type:** String (optional)

**Default:** `redis`

**Options:**
- `redis` - Persistent storage (recommended for production)
- `memory` - In-memory storage (for development/testing only)

**Example:**
```env
STORAGE_BACKEND=redis
```

**Notes:**
- `memory` backend loses all mappings on restart
- `redis` backend persists mappings across restarts
- Choose `redis` for production to maintain message edit/delete functionality

---

### `REDIS_URL`

**Description:** Connection URL for Redis server

**Type:** String (optional)

**Default:** `redis://localhost:6379`

**Format:** `redis://[username:password@]host:port[/database]`

**Examples:**
```env
# Local Redis
REDIS_URL=redis://localhost:6379

# Redis with authentication
REDIS_URL=redis://:password@localhost:6379

# Redis with username and password
REDIS_URL=redis://username:password@redis-host:6379

# Redis Cloud
REDIS_URL=redis://username:password@redis-12345.cloud.redislabs.com:12345

# Redis with database selection
REDIS_URL=redis://localhost:6379/1
```

**Notes:**
- Only used when `STORAGE_BACKEND=redis`
- Default connects to local Redis on default port

---

### `REDIS_EXPIRY_DAYS`

**Description:** Number of days to keep message mappings in Redis

**Type:** Integer (optional)

**Default:** `180` (6 months)

**Example:**
```env
REDIS_EXPIRY_DAYS=180
```

**Notes:**
- Controls Time-To-Live (TTL) for message mappings
- Longer retention allows editing/deleting older messages
- Shorter retention reduces Redis memory usage
- Minimum recommended: 30 days
- Maximum practical: 365 days

---

## Logging

### `LOG_LEVEL`

**Description:** Logging verbosity level

**Type:** String (optional)

**Default:** `info`

**Options:**
- `error` - Only critical errors
- `warn` - Warnings and errors
- `info` - General information, warnings, and errors (recommended)
- `debug` - Detailed debugging information (all levels)

**Example:**
```env
LOG_LEVEL=info
```

**Notes:**
- Use `debug` for troubleshooting
- Use `info` for production
- Use `error` to minimize log output

---

## User Mapping

### `SLACK_USER_MAPPINGS`

**Description:** Custom display names and avatars for Slack users in Mattermost

**Type:** JSON Object (optional)

**Format:**
```json
{
  "SLACK_USER_ID": {
    "mm_user_id": "MM_USER_ID",
    "display_name": "Display Name",
    "avatar_url": "https://example.com/avatar.jpg"
  }
}
```

**Example:**
```env
SLACK_USER_MAPPINGS={"U12345":{"mm_user_id":"abc123","display_name":"John Doe","avatar_url":"https://example.com/avatar.jpg"}}
```

**Use cases:**
- Consistent usernames across platforms
- Custom avatars for bot accounts
- Override default username fetching
- Map service accounts to human-readable names

---

### `MM_USER_MAPPINGS`

**Description:** Custom display names and avatars for Mattermost users in Slack

**Type:** JSON Object (optional)

**Format:**
```json
{
  "MM_USER_ID": {
    "slack_user_id": "SLACK_USER_ID",
    "display_name": "Display Name",
    "avatar_url": "https://example.com/avatar.jpg"
  }
}
```

**Example:**
```env
MM_USER_MAPPINGS={"abc123":{"slack_user_id":"U12345","display_name":"Jane Smith","avatar_url":"https://example.com/avatar.jpg"}}
```

**Use cases:**
- Consistent usernames across platforms
- Custom avatars for bot accounts
- Override default username fetching

---

## Alerting & Monitoring

### `ALERT_CHANNEL`

**Description:** Channel to send critical alerts and periodic health status messages

**Type:** String (optional)

**Format:** `slack:CHANNEL_ID` or `mm:CHANNEL_ID`

**Examples:**
```env
# Send alerts to Slack channel
ALERT_CHANNEL=slack:C0123456789

# Send alerts to Mattermost channel
ALERT_CHANNEL=mm:abcde12345
```

**Alert types sent:**
- Critical errors (authentication failures, permanent errors)
- Reconnection failures
- Bridge initialization failures
- Periodic "Bridge healthy" status messages (if configured)

**Notes:**
- Omit to disable alerting
- Channel must exist and bot must have access
- Useful for monitoring bridge health in production

---

### `HEALTH_CHECK_INTERVAL_MINUTES`

**Description:** Interval for sending periodic health status messages

**Type:** Integer (optional)

**Default:** `60` (1 hour)

**Example:**
```env
HEALTH_CHECK_INTERVAL_MINUTES=60
```

**Notes:**
- Only active if `ALERT_CHANNEL` is configured
- Set to `0` to disable periodic health checks (only send critical alerts)
- Status messages confirm bridge is running and healthy

---

## Worker Pools

### `WORKER_POOL_SIZE`

**Description:** Number of concurrent workers for message processing

**Type:** Integer (optional)

**Default:** `10`

**Range:** 1-100 (recommended: 5-50)

**Example:**
```env
WORKER_POOL_SIZE=10
```

**Use cases:**
- **Low traffic** (< 100 messages/hour): `WORKER_POOL_SIZE=5`
- **Medium traffic** (100-1000 messages/hour): `WORKER_POOL_SIZE=10` (default)
- **High traffic** (> 1000 messages/hour): `WORKER_POOL_SIZE=20-50`

**Notes:**
- Higher values allow more concurrent message processing
- Too high may overwhelm APIs or system resources
- Too low may cause message queueing during traffic spikes
- Monitor with `/bridge perf` slash command or `/metrics` endpoint

---

## Presence Synchronization

### `PRESENCE_SYNC_ENABLED`

**Description:** Enable user presence/status synchronization between platforms

**Type:** Boolean (optional)

**Default:** `false`

**Options:**
- `true` - Enable presence sync
- `false` - Disable presence sync

**Example:**
```env
PRESENCE_SYNC_ENABLED=true
```

**Notes:**
- When enabled, syncs user online/away status from Slack to Mattermost
- Requires user mappings to function
- Due to Slack API limitations, Mattermost → Slack sync is not supported
- Has minimal performance impact

**Status mapping:**
- Slack `active` → Mattermost `online`
- Slack `away` → Mattermost `away`

---

### `PRESENCE_SYNC_INTERVAL_MINUTES`

**Description:** Interval for bulk presence synchronization

**Type:** Integer (optional)

**Default:** `5` (5 minutes)

**Range:** 1-60 (recommended: 3-15)

**Example:**
```env
PRESENCE_SYNC_INTERVAL_MINUTES=5
```

**Notes:**
- Only used when `PRESENCE_SYNC_ENABLED=true`
- Periodic sync ensures accuracy even if real-time events are missed
- Lower values = more API calls, higher accuracy
- Higher values = fewer API calls, potential staleness

**Recommendations:**
- **Real-time needs**: `3` minutes
- **Normal usage**: `5` minutes (default)
- **Light usage**: `10-15` minutes

---

## Configuration Examples

### Minimal Configuration (Single Channel)

```env
# Slack
SLACK_BOT_TOKEN=xoxb-your-token-here
SLACK_SIGNING_SECRET=your-signing-secret

# Mattermost
MM_TOKEN=your-mattermost-token
MM_URL=https://mattermost.example.com

# Channels (legacy mode)
SLACK_CHANNEL_ID=C0123456789
MM_CHANNEL_ID=abcde12345

# Storage
STORAGE_BACKEND=redis
REDIS_URL=redis://localhost:6379
```

### Production Configuration (Multiple Channels)

```env
# Slack
SLACK_BOT_TOKEN=xoxb-your-token-here
SLACK_SIGNING_SECRET=your-signing-secret

# Mattermost
MM_TOKEN=your-mattermost-token
MM_URL=https://mattermost.example.com

# Multiple channels
CHANNEL_MAPPINGS=[{"slack":"C01ABC","mattermost":"ch1def"},{"slack":"C02GHI","mattermost":"ch2jkl"}]

# Storage
STORAGE_BACKEND=redis
REDIS_URL=redis://username:password@redis.example.com:6379
REDIS_EXPIRY_DAYS=180

# Monitoring
LOG_LEVEL=info
ALERT_CHANNEL=slack:C0ALERTS
HEALTH_CHECK_INTERVAL_MINUTES=60

# Performance
WORKER_POOL_SIZE=20

# Presence
PRESENCE_SYNC_ENABLED=true
PRESENCE_SYNC_INTERVAL_MINUTES=5

# Server
PORT=3000
```

### Development Configuration

```env
# Slack
SLACK_BOT_TOKEN=xoxb-dev-token
SLACK_SIGNING_SECRET=dev-signing-secret

# Mattermost
MM_TOKEN=dev-mattermost-token
MM_URL=http://localhost:8065

# Single channel for testing
SLACK_CHANNEL_ID=C0TEST123
MM_CHANNEL_ID=testchannel

# In-memory storage (no Redis needed)
STORAGE_BACKEND=memory

# Verbose logging
LOG_LEVEL=debug

# Server
PORT=3000
```

---

## Custom Emoji Synchronization

### `CUSTOM_EMOJI_SYNC_ENABLED`

**Description:** Enable synchronization of Slack custom emojis

**Type:** Boolean (optional)

**Default:** `true`

**Example:**
```env
CUSTOM_EMOJI_SYNC_ENABLED=true
```

**Notes:**
- Fetches custom emojis from Slack workspace
- Caches emoji metadata for reaction handling
- See [Custom Emoji Documentation](custom-emoji.md) for details

---

### `CUSTOM_EMOJI_SYNC_INTERVAL_MINUTES`

**Description:** Interval in minutes between custom emoji cache updates

**Type:** Number (optional)

**Default:** `60`

**Range:** 1-1440 (1 minute to 24 hours)

**Example:**
```env
CUSTOM_EMOJI_SYNC_INTERVAL_MINUTES=60
```

**Recommendations:**
- **Small workspaces (<100 emojis):** 60 minutes
- **Large workspaces (>500 emojis):** 120-240 minutes
- **Frequently updated:** 30 minutes

---

## Sharding Configuration

### `SHARDING_ENABLED`

**Description:** Enable sharding for distributed deployments

**Type:** Boolean (optional)

**Default:** `false`

**Example:**
```env
SHARDING_ENABLED=true
```

**Notes:**
- Enables horizontal scaling across multiple instances
- All instances must use same Redis backend
- See [Sharding Documentation](sharding.md) for details

---

### `SHARD_ID`

**Description:** Current shard ID (0-based index)

**Type:** Number (optional)

**Default:** `0`

**Range:** 0 to `TOTAL_SHARDS - 1`

**Example:**
```env
SHARD_ID=0
```

**Notes:**
- Must be unique for each bridge instance
- Must be less than `TOTAL_SHARDS`
- Only relevant when `SHARDING_ENABLED=true`

---

### `TOTAL_SHARDS`

**Description:** Total number of shards in the deployment

**Type:** Number (optional)

**Default:** `1`

**Range:** 1 or higher

**Example:**
```env
TOTAL_SHARDS=3
```

**Notes:**
- Must be the same across all bridge instances
- Determines channel distribution
- Restart all instances when changing this value

---

## Validation

The bridge validates configuration on startup and will exit with clear error messages if:

- Required variables are missing (`SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `MM_TOKEN`, `MM_URL`)
- No channel mappings are configured (neither `CHANNEL_MAPPINGS` nor `SLACK_CHANNEL_ID`/`MM_CHANNEL_ID`)
- `CHANNEL_MAPPINGS` JSON is malformed
- `STORAGE_BACKEND` is invalid (not `redis` or `memory`)
- Redis connection fails (when using `redis` backend)
- Invalid sharding configuration (`SHARD_ID >= TOTAL_SHARDS` or `TOTAL_SHARDS < 1`)

Check the logs for specific error messages if the bridge fails to start.

---

## See Also

- [Configuration Guide in README](../README.md#-configuration)
- [Environment Setup in Development Guide](./development.md)
- [Deployment Guide](./deployment.md)
- [API Reference](./api.md)
- [Custom Emoji Documentation](custom-emoji.md)
- [Sharding Documentation](sharding.md)
