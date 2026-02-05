# Slack Custom Emoji Support

The Mattermost-Slack Bridge includes automatic synchronization of Slack custom emojis, making it easier to maintain consistent emoji reactions across both platforms.

## Overview

When users add reactions using custom Slack emojis (workspace-specific emojis), the bridge:
1. Detects the custom emoji usage
2. Fetches emoji metadata from Slack
3. Logs the custom emoji information
4. Attempts to sync the reaction to Mattermost

## Features

- **Automatic Discovery**: Fetches all custom emojis from your Slack workspace
- **Periodic Sync**: Keeps the emoji cache up-to-date with regular syncs
- **Caching**: In-memory caching for fast emoji lookups
- **Transparent Operation**: Works seamlessly with existing reaction synchronization

## Configuration

Custom emoji synchronization is enabled by default but can be configured through environment variables:

```env
# Enable/disable custom emoji sync (default: true)
CUSTOM_EMOJI_SYNC_ENABLED=true

# How often to sync emoji list from Slack in minutes (default: 60)
CUSTOM_EMOJI_SYNC_INTERVAL_MINUTES=60
```

### Configuration Options

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `CUSTOM_EMOJI_SYNC_ENABLED` | boolean | `true` | Enable or disable custom emoji synchronization |
| `CUSTOM_EMOJI_SYNC_INTERVAL_MINUTES` | number | `60` | Interval in minutes between emoji cache updates |

## How It Works

### 1. Initial Sync

When the bridge starts, it immediately fetches the complete list of custom emojis from your Slack workspace using the `emoji.list` API endpoint.

### 2. Periodic Updates

The bridge automatically refreshes the emoji cache at the configured interval (default: 60 minutes) to pick up any newly added custom emojis.

### 3. Reaction Handling

When a user adds a reaction with a custom emoji:
1. The bridge checks if the emoji is in the custom emoji cache
2. If found, it logs the emoji name and URL
3. The reaction is synced to Mattermost using the emoji name
4. Mattermost will display the emoji if it has a matching custom emoji, or fall back to the emoji name

### 4. Cache Management

- **In-Memory Cache**: Emojis are stored in memory for fast lookups
- **Automatic Refresh**: Cache is updated periodically without manual intervention
- **Statistics**: Cache statistics are available via the `/health` endpoint

## API Reference

### Emoji Sync Functions

The bridge provides the following functions in `src/utils/emoji-sync.js`:

#### `syncCustomEmojis(slackClient)`
Fetches and caches all custom emojis from Slack.

**Parameters:**
- `slackClient` - Slack API client instance

**Returns:**
- `Promise<boolean>` - `true` if sync was successful

**Example:**
```javascript
const success = await syncCustomEmojis(slackClient);
console.log(`Emoji sync ${success ? 'succeeded' : 'failed'}`);
```

#### `getCustomEmojiUrl(emojiName)`
Get the URL for a custom emoji by name.

**Parameters:**
- `emojiName` - Name of the emoji (without colons)

**Returns:**
- `string|null` - URL of the emoji or `null` if not found

**Example:**
```javascript
const url = getCustomEmojiUrl('party_parrot');
if (url) {
  console.log(`Emoji URL: ${url}`);
}
```

#### `isCustomEmoji(emojiName)`
Check if an emoji is a custom emoji.

**Parameters:**
- `emojiName` - Name of the emoji (without colons)

**Returns:**
- `boolean` - `true` if emoji is custom

**Example:**
```javascript
if (isCustomEmoji('party_parrot')) {
  console.log('This is a custom emoji!');
}
```

#### `getCacheStats()`
Get statistics about the emoji cache.

**Returns:**
- `Object` - Cache statistics

**Example:**
```javascript
const stats = getCacheStats();
console.log(`Cache has ${stats.size} emojis`);
console.log(`Last synced: ${stats.lastSyncTime}`);
console.log(`Cache age: ${stats.ageMinutes} minutes`);
```

## Monitoring

### Health Check Endpoint

The bridge health endpoint includes emoji cache information:

```bash
curl http://localhost:3000/health
```

Response includes:
```json
{
  "status": "operational",
  "service": "mattermost-slack-bridge",
  "timestamp": "2026-02-05T10:30:00.000Z",
  "shard": { ... }
}
```

### Logs

The bridge logs custom emoji operations:

```
[emoji-sync] INFO: Fetching custom emojis from Slack
[emoji-sync] INFO: Successfully fetched custom emojis {"count":42}
[emoji-sync] INFO: Custom emoji cache updated {"count":42,"timestamp":"2026-02-05T10:30:00.000Z"}
[reactions] INFO: Processing custom Slack emoji reaction {"emojiName":"party_parrot","emojiUrl":"https://..."}
```

## Limitations

### Current Limitations

1. **Read-Only**: The bridge can detect and log custom emoji usage but cannot automatically create custom emojis in Mattermost
2. **Name Matching**: For reactions to display correctly in Mattermost, both platforms must have custom emojis with matching names
3. **Aliases**: Slack emoji aliases (emojis that point to other emojis) are not synchronized
4. **File Upload**: Automatically uploading custom emoji images to Mattermost is not currently supported

### Workarounds

**For full custom emoji support across platforms:**

1. **Manual Upload**: Manually create matching custom emojis in Mattermost
   - Go to Mattermost → Main Menu → Custom Emoji
   - Upload the same emoji image with the same name as in Slack

2. **Emoji Name Standardization**: Use consistent emoji names across both platforms

3. **Standard Emojis**: Use Unicode standard emojis when possible for guaranteed cross-platform compatibility

## Troubleshooting

### Custom Emoji Not Syncing

**Problem:** Custom emoji reactions aren't appearing in Mattermost

**Solutions:**
1. Check that `CUSTOM_EMOJI_SYNC_ENABLED=true` in your `.env`
2. Verify the Slack bot has the `emoji:read` scope
3. Check logs for emoji sync errors
4. Ensure Mattermost has a matching custom emoji with the same name

### Cache Not Updating

**Problem:** Newly added Slack emojis aren't being detected

**Solutions:**
1. Wait for the next sync interval (default: 60 minutes)
2. Restart the bridge to force an immediate sync
3. Reduce `CUSTOM_EMOJI_SYNC_INTERVAL_MINUTES` for more frequent updates
4. Check Slack API rate limits

### Memory Usage

**Problem:** High memory usage with many custom emojis

**Solutions:**
1. The cache stores emoji names and URLs only (minimal memory)
2. For workspaces with 1000+ custom emojis, monitor memory usage
3. Consider increasing the sync interval to reduce API calls

## Best Practices

### Emoji Management

1. **Consistent Naming**: Use the same emoji names in both Slack and Mattermost
2. **Regular Cleanup**: Remove unused custom emojis from both platforms
3. **Documentation**: Document custom emoji usage for your team

### Performance

1. **Sync Interval**: Balance between freshness and API rate limits
   - Default 60 minutes is suitable for most workspaces
   - Increase for large workspaces (500+ custom emojis)
   - Decrease if emojis are frequently added

2. **Monitoring**: Watch the logs for sync errors or performance issues

### Security

1. **API Permissions**: Ensure the Slack bot only has necessary permissions
2. **URL Validation**: Custom emoji URLs are from Slack CDN and are safe
3. **Rate Limits**: The bridge respects Slack API rate limits

## Future Enhancements

Potential future improvements:

1. **Automatic Upload**: Automatically create matching custom emojis in Mattermost
2. **Bidirectional Sync**: Sync custom emojis from Mattermost to Slack
3. **Alias Support**: Handle Slack emoji aliases
4. **Cache Persistence**: Store emoji cache in Redis for faster restarts
5. **Webhook Updates**: React to emoji creation/deletion events instead of polling

## Related Documentation

- [API Reference](api.md) - Complete module documentation
- [Environment Variables](environment-variables.md) - All configuration options
- [Usage Examples](usage-examples.md) - Practical examples

---

**Note**: Custom emoji support requires the Slack app to have the `emoji:read` scope. This is not included in the default bot scopes and must be added manually in your Slack app configuration.
