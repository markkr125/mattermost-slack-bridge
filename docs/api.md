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
