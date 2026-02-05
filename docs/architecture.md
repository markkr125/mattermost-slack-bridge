# Architecture Documentation

## Overview

The Mattermost-Slack Bridge is a bidirectional messaging bridge that synchronizes messages, files, and threads between Mattermost and Slack channels.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Bridge Application                      │
│                                                               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Slack      │    │   Message    │    │  Mattermost  │  │
│  │   Handler    │◄──►│  Processing  │◄──►│   Handler    │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                    │                    │          │
│         ▼                    ▼                    ▼          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Redis Storage (Message IDs)              │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         │                                          │
         ▼                                          ▼
   ┌──────────┐                              ┌─────────────┐
   │  Slack   │                              │ Mattermost  │
   │   API    │                              │  WebSocket  │
   └──────────┘                              └─────────────┘
```

## Components

### 1. Configuration (`src/config/environment.js`)

**Purpose**: Centralized configuration management

**Responsibilities**:
- Load environment variables
- Parse channel mappings (JSON or legacy format)
- Create bidirectional channel lookup maps
- Validate configuration

**Key Functions**:
- `parseChannelMappings()`: Parse and validate channel mappings
- `createChannelMaps()`: Create efficient lookup maps for routing

### 2. Storage Layer (`src/storage/redis.js`)

**Purpose**: Persistent message ID mapping

**Responsibilities**:
- Store Slack ↔ Mattermost message ID mappings
- Handle thread relationships
- Manage TTL for stored mappings
- Provide graceful error handling

**Key Functions**:
- `setSlackToMm(channelId, slackTs, mmId)`: Store Slack → Mattermost mapping
- `getSlackToMm(channelId, slackTs)`: Retrieve Mattermost ID
- `setMmToSlack(channelId, mmId, slackTs)`: Store Mattermost → Slack mapping
- `getMmToSlack(channelId, mmId)`: Retrieve Slack timestamp

**Storage Keys**:
- Slack → MM: `slack:{channelId}:{timestamp}`
- MM → Slack: `mm:{channelId}:{postId}`

### 3. Utilities (`src/utils/markdown.js`)

**Purpose**: Markdown format conversion

**Responsibilities**:
- Convert Mattermost markdown to Slack format
- Convert Slack markdown to Mattermost format
- Handle formatting differences (bold, italic, links, etc.)

**Key Functions**:
- `convertMattermostToSlack(text)`: Convert MM → Slack markdown
- `convertSlackToMattermost(text)`: Convert Slack → MM markdown

**Conversion Rules**:

| Element | Mattermost | Slack |
|---------|------------|-------|
| Bold | `**text**` | `*text*` |
| Italic | `*text*` | `_text_` |
| Strikethrough | `~~text~~` | `~text~` |
| Link | `[text](url)` | `<url\|text>` |
| User mention | `@username` | `<@USER_ID>` |
| Channel mention | `~channel` | `<#CHANNEL_ID\|name>` |

### 4. Message Handlers

#### Slack Handler (`src/handlers/slack.js`)

**Purpose**: Handle incoming Slack messages and events

**Responsibilities**:
- Process new Slack messages
- Handle message edits and deletions
- Convert markdown format
- Upload files to Mattermost
- Manage thread relationships
- Filter bot messages

**Key Functions**:
- `handleSlackMessage()`: Process new messages
- `handleSlackMessageEdit()`: Handle message edits
- `handleSlackMessageDelete()`: Handle message deletions

#### Mattermost Handler (`src/handlers/mattermost.js`)

**Purpose**: Handle incoming Mattermost messages and events

**Responsibilities**:
- Process new Mattermost posts
- Handle post edits and deletions
- Convert markdown format
- Upload files to Slack
- Manage thread relationships
- Filter bot messages

**Key Functions**:
- `handleMattermostPost()`: Process new posts
- `handleMattermostPostEdit()`: Handle post edits
- `handleMattermostPostDelete()`: Handle post deletions

### 5. Main Application (`src/index.js`)

**Purpose**: Application entry point and coordination

**Responsibilities**:
- Initialize Slack and Mattermost clients
- Set up WebSocket connections
- Register event handlers
- Coordinate message flow
- Handle reconnection logic

## Data Flow

### Message Flow: Slack → Mattermost

1. User posts message in Slack
2. Slack Bot receives message via Events API
3. `handleSlackMessage()` is invoked
4. Message is filtered (check channel mapping, skip bot messages)
5. User info fetched from Slack API
6. Markdown converted (Slack → Mattermost format)
7. Files downloaded from Slack and uploaded to Mattermost
8. Post created in Mattermost via REST API
9. Message IDs stored in Redis for future reference

### Message Flow: Mattermost → Slack

1. User posts message in Mattermost
2. Bridge receives message via WebSocket
3. `handleMattermostPost()` is invoked
4. Message is filtered (check channel mapping, skip bot messages)
5. User info fetched from Mattermost API
6. Markdown converted (Mattermost → Slack format)
7. Files downloaded from Mattermost and uploaded to Slack
8. Message posted to Slack via Web API
9. Message IDs stored in Redis for future reference

### Edit Flow

1. User edits message on either platform
2. Edit event received via Events API (Slack) or WebSocket (Mattermost)
3. Original message ID retrieved from Redis
4. Updated message posted to other platform
5. Markdown converted appropriately

### Delete Flow

1. User deletes message on either platform
2. Delete event received via Events API (Slack) or WebSocket (Mattermost)
3. Original message ID retrieved from Redis
4. Message deleted on other platform

## Thread Handling

**Thread Detection**:
- Slack: Uses `thread_ts` field
- Mattermost: Uses `root_id` field

**Thread Mapping**:
- Root messages stored in Redis
- Reply messages lookup parent via Redis
- Flat thread structure maintained in Mattermost

## Channel Mapping

**Configuration Formats**:

1. **Single Channel (Legacy)**:
   ```env
   SLACK_CHANNEL_ID=C0123456789
   MM_CHANNEL_ID=abcde12345
   ```

2. **Multiple Channels (JSON)**:
   ```env
   CHANNEL_MAPPINGS=[{"slack":"C01","mattermost":"mm01"},{"slack":"C02","mattermost":"mm02"}]
   ```

**Routing Logic**:
- Uses `Map` objects for O(1) lookup
- Separate maps for each direction
- Messages are only processed if channel is in mapping

## Error Handling

**Principles**:
- Graceful degradation
- Log errors without crashing
- Continue processing other messages
- Retry connections automatically

**Redis Errors**:
- Logged but not fatal
- Operations continue without message mapping
- Retry strategy built into Redis client

**API Errors**:
- Logged with context
- Individual message failures don't stop bridge
- WebSocket reconnects automatically

## Security Considerations

1. **Credentials**: Stored in environment variables, never in code
2. **File Transfer**: Files proxied through bridge (not direct links)
3. **Bot Filtering**: Prevents infinite message loops
4. **Channel Isolation**: Only configured channels are bridged
5. **Redis Keys**: Namespaced to prevent collisions

## Performance Considerations

1. **Redis TTL**: Default 180 days prevents indefinite growth
2. **Concurrent Processing**: Node.js event loop handles multiple messages
3. **Efficient Lookups**: Map objects provide O(1) channel routing
4. **WebSocket**: Low-latency Mattermost connection
5. **Bulk Operations**: File transfers optimized per message

## Scalability

**Current Limitations**:
- Single instance (no horizontal scaling)
- In-memory channel maps
- All channels share same Redis instance

**Future Improvements**:
- Redis Pub/Sub for multiple instances
- Database for channel configuration
- Separate worker processes for file transfers
- Load balancing support

## Monitoring and Observability

**Current Logging**:
- Console logging for all major events
- Error logging with stack traces
- Channel mapping on startup
- Connection status updates

**Metrics to Monitor**:
- Message processing latency
- Redis connection health
- WebSocket connection status
- API error rates
- File transfer success rates

## Dependencies

**Core Dependencies**:
- `@slack/bolt`: Slack Bot framework
- `axios`: HTTP client for APIs
- `ws`: WebSocket client for Mattermost
- `ioredis`: Redis client with clustering support
- `form-data`: File upload handling
- `dotenv`: Environment variable management

## Configuration Reference

See [Configuration Guide](./configuration.md) for detailed setup instructions.

## Deployment Guide

See [Deployment Guide](./deployment.md) for production deployment instructions.

## Development Guide

See [Development Guide](./development.md) for local development setup and testing.
