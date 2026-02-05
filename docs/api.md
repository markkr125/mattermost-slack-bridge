# API Documentation

## Module API Reference

### Configuration Module (`src/config/environment.js`)

#### Exports

```javascript
const {
  config,
  channelMappings,
  slackToMmChannelMap,
  mmToSlackChannelMap,
} = require('./config/environment');
```

#### `config`

Configuration object containing all application settings.

**Type**: `Object`

**Properties**:
```javascript
{
  slack: {
    signingSecret: string,  // Slack app signing secret
    botToken: string,       // Slack bot OAuth token
  },
  mattermost: {
    token: string,          // Mattermost personal access token
    url: string,            // Mattermost server URL
  },
  redis: {
    url: string,            // Redis connection URL
    expiryDays: number,     // Message mapping TTL in days
  },
  port: number | string,    // Server port
}
```

#### `channelMappings`

Array of channel mapping configurations.

**Type**: `Array<{ slack: string, mattermost: string }>`

**Example**:
```javascript
[
  { slack: 'C0123456789', mattermost: 'abcde12345' },
  { slack: 'C9876543210', mattermost: 'zyxwv98765' }
]
```

#### `slackToMmChannelMap`

Map for looking up Mattermost channel from Slack channel.

**Type**: `Map<string, string>`

**Usage**:
```javascript
const mmChannelId = slackToMmChannelMap.get(slackChannelId);
```

#### `mmToSlackChannelMap`

Map for looking up Slack channel from Mattermost channel.

**Type**: `Map<string, string>`

**Usage**:
```javascript
const slackChannelId = mmToSlackChannelMap.get(mmChannelId);
```

---

### Storage Module (`src/storage/redis.js`)

#### Exports

```javascript
const {
  redis,
  setSlackToMm,
  getSlackToMm,
  setMmToSlack,
  getMmToSlack,
} = require('./storage/redis');
```

#### `redis`

Redis client instance. Use for direct Redis operations if needed.

**Type**: `Redis` (ioredis instance)

#### `setSlackToMm(slackChannelId, slackTs, mmId)`

Store a Slack message to Mattermost post mapping.

**Parameters**:
- `slackChannelId` (string): Slack channel ID
- `slackTs` (string): Slack message timestamp
- `mmId` (string): Mattermost post ID

**Returns**: `Promise<void>`

**Example**:
```javascript
await setSlackToMm('C12345', '1234567890.123456', 'mm_post_123');
```

#### `getSlackToMm(slackChannelId, slackTs)`

Retrieve Mattermost post ID from Slack message timestamp.

**Parameters**:
- `slackChannelId` (string): Slack channel ID
- `slackTs` (string): Slack message timestamp

**Returns**: `Promise<string | null>`

**Example**:
```javascript
const mmPostId = await getSlackToMm('C12345', '1234567890.123456');
if (mmPostId) {
  // Post exists
}
```

#### `setMmToSlack(mmChannelId, mmId, slackTs)`

Store a Mattermost post to Slack message mapping.

**Parameters**:
- `mmChannelId` (string): Mattermost channel ID
- `mmId` (string): Mattermost post ID
- `slackTs` (string): Slack message timestamp

**Returns**: `Promise<void>`

**Example**:
```javascript
await setMmToSlack('mm_channel_123', 'mm_post_123', '1234567890.123456');
```

#### `getMmToSlack(mmChannelId, mmId)`

Retrieve Slack message timestamp from Mattermost post ID.

**Parameters**:
- `mmChannelId` (string): Mattermost channel ID
- `mmId` (string): Mattermost post ID

**Returns**: `Promise<string | null>`

**Example**:
```javascript
const slackTs = await getMmToSlack('mm_channel_123', 'mm_post_123');
if (slackTs) {
  // Message exists
}
```

---

### Markdown Utilities (`src/utils/markdown.js`)

#### Exports

```javascript
const {
  convertMattermostToSlack,
  convertSlackToMattermost,
} = require('./utils/markdown');
```

#### `convertMattermostToSlack(text)`

Convert Mattermost markdown format to Slack markdown format.

**Parameters**:
- `text` (string | null | undefined): Text to convert

**Returns**: `string | null | undefined`

**Conversion Rules**:
- `~~text~~` → `~text~` (strikethrough)
- `**text**` → `*text*` (bold)
- `*text*` → `_text_` (italic)
- `[text](url)` → `<url|text>` (links)

**Example**:
```javascript
const slackText = convertMattermostToSlack('**bold** and *italic*');
// Result: '*bold* and _italic_'
```

#### `convertSlackToMattermost(text)`

Convert Slack markdown format to Mattermost markdown format.

**Parameters**:
- `text` (string | null | undefined): Text to convert

**Returns**: `string | null | undefined`

**Conversion Rules**:
- `~text~` → `~~text~~` (strikethrough)
- `*text*` → `**text**` (bold)
- `_text_` → `*text*` (italic)
- `<url|text>` → `[text](url)` (links)
- `<@USER_ID>` → `@USER_ID` (mentions)
- `<#CHANNEL_ID|name>` → `~name` (channel mentions)

**Example**:
```javascript
const mmText = convertSlackToMattermost('*bold* and _italic_');
// Result: '**bold** and *italic*'
```

---

### Slack Handler (`src/handlers/slack.js`)

#### Exports

```javascript
const {
  setSlackBotUserId,
  getSlackBotUserId,
  handleSlackMessage,
  handleSlackMessageEdit,
  handleSlackMessageDelete,
} = require('./handlers/slack');
```

#### `setSlackBotUserId(userId)`

Set the Slack bot user ID (used to filter bot's own messages).

**Parameters**:
- `userId` (string): Slack bot user ID

**Returns**: `void`

#### `getSlackBotUserId()`

Get the current Slack bot user ID.

**Returns**: `string | null`

#### `handleSlackMessage(slackApp, mmApi, message)`

Process a new Slack message and forward to Mattermost.

**Parameters**:
- `slackApp` (App): Slack Bolt app instance
- `mmApi` (AxiosInstance): Mattermost API client
- `message` (Object): Slack message object

**Message Object Properties**:
```javascript
{
  channel: string,      // Slack channel ID
  user: string,         // User ID
  text: string,         // Message text
  ts: string,           // Message timestamp
  thread_ts?: string,   // Thread parent timestamp
  files?: Array,        // Attached files
  subtype?: string,     // Message subtype
}
```

**Returns**: `Promise<void>`

**Behavior**:
- Filters messages from unmapped channels
- Skips bot's own messages
- Converts markdown format
- Handles file attachments
- Maintains thread relationships
- Stores message mapping in Redis

#### `handleSlackMessageEdit(mmApi, event)`

Process a Slack message edit and update in Mattermost.

**Parameters**:
- `mmApi` (AxiosInstance): Mattermost API client
- `event` (Object): Slack message_changed event

**Returns**: `Promise<void>`

#### `handleSlackMessageDelete(mmApi, event)`

Process a Slack message deletion and delete from Mattermost.

**Parameters**:
- `mmApi` (AxiosInstance): Mattermost API client
- `event` (Object): Slack message_deleted event

**Returns**: `Promise<void>`

---

### Mattermost Handler (`src/handlers/mattermost.js`)

#### Exports

```javascript
const {
  setMmBotUserId,
  getMmBotUserId,
  handleMattermostPost,
  handleMattermostPostEdit,
  handleMattermostPostDelete,
} = require('./handlers/mattermost');
```

#### `setMmBotUserId(userId)`

Set the Mattermost bot user ID (used to filter bot's own messages).

**Parameters**:
- `userId` (string): Mattermost bot user ID

**Returns**: `void`

#### `getMmBotUserId()`

Get the current Mattermost bot user ID.

**Returns**: `string | null`

#### `handleMattermostPost(slackApp, mmApi, event)`

Process a new Mattermost post and forward to Slack.

**Parameters**:
- `slackApp` (App): Slack Bolt app instance
- `mmApi` (AxiosInstance): Mattermost API client
- `event` (Object): Mattermost WebSocket event

**Event Object Properties**:
```javascript
{
  event: 'posted',
  data: {
    post: string,        // JSON string of post object
    sender_name: string, // Post author's name
  }
}
```

**Post Object Properties** (parsed from `event.data.post`):
```javascript
{
  id: string,           // Post ID
  channel_id: string,   // Channel ID
  user_id: string,      // User ID
  message: string,      // Post text
  root_id?: string,     // Thread root ID
  file_ids?: string[],  // Attached file IDs
}
```

**Returns**: `Promise<void>`

**Behavior**:
- Filters posts from unmapped channels
- Skips bot's own posts
- Converts markdown format
- Handles file attachments
- Maintains thread relationships
- Stores message mapping in Redis

#### `handleMattermostPostEdit(slackApp, event)`

Process a Mattermost post edit and update in Slack.

**Parameters**:
- `slackApp` (App): Slack Bolt app instance
- `event` (Object): Mattermost post_edited event

**Returns**: `Promise<void>`

#### `handleMattermostPostDelete(slackApp, event)`

Process a Mattermost post deletion and delete from Slack.

**Parameters**:
- `slackApp` (App): Slack Bolt app instance
- `event` (Object): Mattermost post_deleted event

**Returns**: `Promise<void>`

---

## Error Handling

All async functions handle errors internally and log them without throwing. This ensures that a single message failure doesn't crash the bridge.

**Example Error Handling Pattern**:
```javascript
try {
  // Perform operation
  await someOperation();
} catch (err) {
  console.error('Error performing operation:', err.message);
  // Continue execution, don't throw
}
```

## Usage Examples

### Basic Message Flow

```javascript
const { App } = require('@slack/bolt');
const axios = require('axios');
const { handleSlackMessage } = require('./handlers/slack');
const { config } = require('./config/environment');

// Initialize clients
const slackApp = new App({
  token: config.slack.botToken,
  signingSecret: config.slack.signingSecret
});

const mmApi = axios.create({
  baseURL: `${config.mattermost.url}/api/v4`,
  headers: { 'Authorization': `Bearer ${config.mattermost.token}` }
});

// Register Slack message handler
slackApp.message(async ({ message }) => {
  await handleSlackMessage(slackApp, mmApi, message);
});
```

### Testing with Mocks

```javascript
jest.mock('./storage/redis');
jest.mock('./utils/markdown');

const { handleSlackMessage } = require('./handlers/slack');
const { convertSlackToMattermost } = require('./utils/markdown');
const { setSlackToMm, setMmToSlack } = require('./storage/redis');

// Setup mocks
convertSlackToMattermost.mockImplementation(text => text);

// Test
test('should handle message', async () => {
  const mockSlackApp = { /* ... */ };
  const mockMmApi = { /* ... */ };
  const message = { /* ... */ };
  
  await handleSlackMessage(mockSlackApp, mockMmApi, message);
  
  expect(setSlackToMm).toHaveBeenCalled();
});
```

## Environment Variables

All configuration is loaded from environment variables. See [Configuration Guide](./configuration.md) for details.

## Redis Key Patterns

- Slack to Mattermost: `slack:{channel_id}:{timestamp}`
- Mattermost to Slack: `mm:{channel_id}:{post_id}`

All keys expire after the configured TTL (default: 180 days).

---

## New Feature Modules

### Worker Pool Module (`src/utils/message-processor.js`)

Concurrent message processor for high-volume scenarios.

#### Class: `MessageProcessor`

**Constructor:**
```javascript
new MessageProcessor(options)
```

**Parameters:**
- `options.maxConcurrent` (number): Maximum concurrent operations (default: 10)
- `options.name` (string): Processor name for logging (default: 'default')

**Methods:**

##### `submit(operation)`

Submit an async operation for processing.

**Parameters:**
- `operation` (Function): Async function to execute

**Returns:** `Promise` - Resolves with operation result

**Example:**
```javascript
const processor = new MessageProcessor({ maxConcurrent: 10 });

const result = await processor.submit(async () => {
  // Process message
  return processedData;
});
```

##### `snapshot()`

Get current processor metrics.

**Returns:** `Object` containing:
- `completed` (number): Total completed tasks
- `errors` (number): Total failed tasks  
- `totalDurationMs` (number): Cumulative processing time
- `currentlyRunning` (number): Currently executing tasks
- `currentlyWaiting` (number): Queued tasks
- `averageDurationMs` (number): Average task duration
- `peakWaiting` (number): Maximum queue depth reached

##### `awaitCompletion()`

Wait for all pending operations to complete.

**Returns:** `Promise` - Resolves when queue is empty

##### `clearMetrics()`

Reset all metrics to zero.

---

### Performance Monitor Module (`src/utils/perf-monitor.js`)

Performance measurement and benchmarking.

#### Class: `PerformanceMonitor`

**Methods:**

##### `begin(label)`

Start a performance measurement.

**Parameters:**
- `label` (string): Measurement label

**Returns:** `string` - Measurement ID

##### `complete(measurementId)`

Complete a performance measurement.

**Parameters:**
- `measurementId` (string): ID from `begin()`

**Returns:** `Object` - Measurement data

##### `track(label, asyncFn)`

Measure an async function execution.

**Parameters:**
- `label` (string): Measurement label
- `asyncFn` (Function): Async function to measure

**Returns:** `Promise<Object>` - `{ output, measurement }`

**Example:**
```javascript
const { perfMonitor } = require('./src/utils/perf-monitor');

const { output, measurement } = await perfMonitor.track('process-message', async () => {
  return await processMessage();
});

console.log(`Took ${measurement.durationMs}ms`);
```

##### `analyze(label)`

Get statistics for measurements with a specific label.

**Returns:** `Object` containing:
- `sampleCount` (number): Number of measurements
- `timing` (Object): Timing statistics (min, max, mean, median, p90, p95, p99)
- `memory` (Object): Memory delta statistics

##### `report()`

Generate formatted text report of all measurements.

**Returns:** `string` - Formatted report

##### `reset()`

Clear all measurement data.

---

### Slash Commands Module (`src/handlers/slash-commands.js`)

Interactive bridge control via slash commands.

#### Functions

##### `handleSlackSlashCommand(slackApp, mmApi, command)`

Process Slack slash command.

**Parameters:**
- `slackApp` (Object): Slack app instance
- `mmApi` (Object): Mattermost API client
- `command` (Object): Slack command payload

**Returns:** `Promise<Object>` - Response object

##### `handleMattermostSlashCommand(slackApp, mmApi, payload)`

Process Mattermost slash command.

**Parameters:**
- `slackApp` (Object): Slack app instance
- `mmApi` (Object): Mattermost API client
- `payload` (Object): Mattermost command payload

**Returns:** `Promise<Object>` - Status object

**Supported Commands:**
- `/bridge status` - Show bridge status
- `/bridge stats` - Display statistics
- `/bridge perf` - View performance metrics
- `/bridge help` - Show help

---

### Presence Sync Module (`src/handlers/presence.js`)

User presence/status synchronization between platforms.

#### Functions

##### `initializePresence(config)`

Initialize presence synchronization.

**Parameters:**
- `config.enabled` (boolean): Enable presence sync
- `config.syncIntervalMs` (number): Sync interval in milliseconds

##### `handleSlackPresenceChange(slackClient, mmApi, event)`

Handle Slack user presence change event.

**Parameters:**
- `slackClient` (Object): Slack client
- `mmApi` (Object): Mattermost API client
- `event` (Object): Slack presence_change event

**Returns:** `Promise<void>`

##### `handleMattermostStatusChange(slackClient, event)`

Handle Mattermost user status change event.

**Parameters:**
- `slackClient` (Object): Slack client
- `event` (Object): Mattermost status_change event

**Returns:** `Promise<void>`

##### `registerPresenceMapping(slackUserId, mmUserId)`

Register user mapping for presence sync.

**Parameters:**
- `slackUserId` (string): Slack user ID
- `mmUserId` (string): Mattermost user ID

##### `startPeriodicSync(slackClient, mmApi)`

Start periodic presence synchronization.

**Parameters:**
- `slackClient` (Object): Slack client
- `mmApi` (Object): Mattermost API client

**Returns:** `NodeJS.Timeout` - Interval timer

##### `getPresenceStats()`

Get presence sync statistics.

**Returns:** `Object` containing:
- `enabled` (boolean): Whether presence sync is enabled
- `syncIntervalMs` (number): Sync interval
- `mappedUsers` (number): Number of mapped users

---

## Benchmark CLI Tool

### Usage

```bash
node tools/benchmark-cli.js [options]
```

### Options

- `--scenario <name>` - Benchmark scenario to run (default: 'all')
  - `message-processing` - Message processing throughput
  - `concurrent` - Concurrent processing with worker pools
  - `file-ops` - File operation simulation
  - `all` - Run all benchmarks

- `--iterations <n>` - Number of iterations (default: 100)

- `--pool-size <n>` - Worker pool size for concurrent tests (default: 10)

### Examples

```bash
# Run all benchmarks with 100 iterations
node tools/benchmark-cli.js

# Test message processing with 200 iterations
node tools/benchmark-cli.js --scenario message-processing --iterations 200

# Test concurrent processing with pool size of 20
node tools/benchmark-cli.js --scenario concurrent --pool-size 20 --iterations 150
```

### Output

The tool generates detailed performance reports including:
- Sample count
- Timing statistics (min, max, mean, median, P90, P95, P99)
- Memory usage statistics
- Full performance report

---

## Additional Environment Variables

```env
# Worker pool configuration
WORKER_POOL_SIZE=10

# Presence synchronization
PRESENCE_SYNC_ENABLED=false
PRESENCE_SYNC_INTERVAL_MINUTES=5
```
