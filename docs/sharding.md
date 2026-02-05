# Sharding for Distributed Deployments

The Mattermost-Slack Bridge supports optional sharding to enable horizontal scaling across multiple instances, allowing you to handle high-volume message traffic and distribute the load across multiple servers.

## Overview

Sharding allows you to run multiple bridge instances simultaneously, with each instance handling a subset of channel pairs. This is useful for:

- **High-Volume Workspaces**: Distributing load across multiple servers
- **High Availability**: Running redundant instances for fault tolerance
- **Resource Optimization**: Dedicating specific resources to specific channel groups
- **Geographic Distribution**: Running instances closer to users or data centers

## Architecture

### How Sharding Works

1. **Consistent Hashing**: Channels are assigned to shards using MD5 hash-based consistent hashing
2. **Channel-Based Partitioning**: Each channel pair is assigned to exactly one shard
3. **Independent Instances**: Each shard runs as an independent bridge instance
4. **Automatic Filtering**: Channel mappings are automatically filtered based on shard assignment

### Shard Assignment

The bridge uses the Slack channel ID as the primary key for shard assignment:

```
shard_id = hash(slack_channel_id) % total_shards
```

This ensures:
- **Consistency**: The same channel always maps to the same shard
- **Even Distribution**: Channels are distributed relatively evenly across shards
- **Deterministic**: Shard assignment is predictable and repeatable

## Configuration

### Environment Variables

Sharding is configured using three environment variables:

```env
# Enable sharding (default: false)
SHARDING_ENABLED=true

# Current shard ID (0-based, default: 0)
SHARD_ID=0

# Total number of shards (default: 1)
TOTAL_SHARDS=3
```

### Configuration Options

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `SHARDING_ENABLED` | boolean | `false` | Enable or disable sharding |
| `SHARD_ID` | number | `0` | Current shard ID (0-based index) |
| `TOTAL_SHARDS` | number | `1` | Total number of shards in the deployment |

### Validation

The bridge validates shard configuration on startup:
- `SHARD_ID` must be less than `TOTAL_SHARDS`
- `TOTAL_SHARDS` must be at least 1
- Invalid configuration will cause the bridge to exit with an error

## Deployment Guide

### Single Instance (No Sharding)

Default configuration - no changes needed:

```env
# Sharding disabled by default
SHARDING_ENABLED=false
```

The bridge handles all channel pairs in a single instance.

### Three-Shard Deployment

Deploy three instances of the bridge with these configurations:

**Instance 1 (Shard 0):**
```env
SHARDING_ENABLED=true
SHARD_ID=0
TOTAL_SHARDS=3
CHANNEL_MAPPINGS=[...]  # Same for all instances
```

**Instance 2 (Shard 1):**
```env
SHARDING_ENABLED=true
SHARD_ID=1
TOTAL_SHARDS=3
CHANNEL_MAPPINGS=[...]  # Same for all instances
```

**Instance 3 (Shard 2):**
```env
SHARDING_ENABLED=true
SHARD_ID=2
TOTAL_SHARDS=3
CHANNEL_MAPPINGS=[...]  # Same for all instances
```

Each instance will automatically handle its assigned subset of channels.

### Docker Compose Example

```yaml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  bridge-shard-0:
    build: .
    environment:
      - SHARDING_ENABLED=true
      - SHARD_ID=0
      - TOTAL_SHARDS=3
      - REDIS_URL=redis://redis:6379
      - CHANNEL_MAPPINGS=${CHANNEL_MAPPINGS}
      - SLACK_BOT_TOKEN=${SLACK_BOT_TOKEN}
      - SLACK_SIGNING_SECRET=${SLACK_SIGNING_SECRET}
      - MM_TOKEN=${MM_TOKEN}
      - MM_URL=${MM_URL}
    depends_on:
      - redis
    ports:
      - "3000:3000"

  bridge-shard-1:
    build: .
    environment:
      - SHARDING_ENABLED=true
      - SHARD_ID=1
      - TOTAL_SHARDS=3
      - REDIS_URL=redis://redis:6379
      - CHANNEL_MAPPINGS=${CHANNEL_MAPPINGS}
      - SLACK_BOT_TOKEN=${SLACK_BOT_TOKEN}
      - SLACK_SIGNING_SECRET=${SLACK_SIGNING_SECRET}
      - MM_TOKEN=${MM_TOKEN}
      - MM_URL=${MM_URL}
    depends_on:
      - redis
    ports:
      - "3001:3000"

  bridge-shard-2:
    build: .
    environment:
      - SHARDING_ENABLED=true
      - SHARD_ID=2
      - TOTAL_SHARDS=3
      - REDIS_URL=redis://redis:6379
      - CHANNEL_MAPPINGS=${CHANNEL_MAPPINGS}
      - SLACK_BOT_TOKEN=${SLACK_BOT_TOKEN}
      - SLACK_SIGNING_SECRET=${SLACK_SIGNING_SECRET}
      - MM_TOKEN=${MM_TOKEN}
      - MM_URL=${MM_URL}
    depends_on:
      - redis
    ports:
      - "3002:3000"
```

### Kubernetes Example

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mattermost-slack-bridge
spec:
  serviceName: bridge
  replicas: 3
  selector:
    matchLabels:
      app: mattermost-slack-bridge
  template:
    metadata:
      labels:
        app: mattermost-slack-bridge
    spec:
      containers:
      - name: bridge
        image: mattermost-slack-bridge:latest
        env:
        - name: SHARDING_ENABLED
          value: "true"
        - name: TOTAL_SHARDS
          value: "3"
        - name: SHARD_ID
          valueFrom:
            fieldRef:
              fieldPath: metadata.name
        - name: REDIS_URL
          value: "redis://redis-service:6379"
        # Add other environment variables...
        ports:
        - containerPort: 3000
          name: http
```

## Monitoring

### Health Check

Each shard exposes its configuration in the health endpoint:

```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "operational",
  "service": "mattermost-slack-bridge",
  "timestamp": "2026-02-05T10:30:00.000Z",
  "shard": {
    "shardId": 0,
    "totalShards": 3,
    "enabled": true,
    "channelsHandled": 15,
    "status": "healthy"
  }
}
```

### Logs

Sharding information is logged on startup:

```
[sharding] INFO: Sharding initialized {"shardId":0,"totalShards":3}
[config] INFO: Filtered channel mappings for shard {"totalMappings":45,"shardMappings":15,"shardId":0,"totalShards":3}
```

### Channel Distribution

To see which channels each shard handles:

```bash
# Check each shard
curl http://localhost:3000/health | jq '.shard'
curl http://localhost:3001/health | jq '.shard'
curl http://localhost:3002/health | jq '.shard'
```

## Operations

### Adding a New Shard

To scale from 3 shards to 4 shards:

1. **Deploy new instance** with `SHARD_ID=3` and `TOTAL_SHARDS=4`
2. **Update existing instances** to `TOTAL_SHARDS=4`
3. **Restart all instances** for new shard assignments to take effect

⚠️ **Important**: All instances must have the same `TOTAL_SHARDS` value.

### Removing a Shard

To scale from 4 shards to 3 shards:

1. **Stop the shard** you want to remove (e.g., shard 3)
2. **Update remaining instances** to `TOTAL_SHARDS=3`
3. **Restart remaining instances** for channel redistribution

### Rebalancing

Shards are automatically rebalanced when `TOTAL_SHARDS` changes:
- Channels are reassigned using consistent hashing
- No manual intervention needed
- Restart all instances to apply changes

## Best Practices

### Shared Infrastructure

1. **Redis**: All shards must share the same Redis instance
   - Message mappings are shared across shards
   - Ensures bidirectional message sync works correctly

2. **Slack/Mattermost**: All shards use the same bot accounts
   - Use the same `SLACK_BOT_TOKEN` for all shards
   - Use the same `MM_TOKEN` for all shards

3. **Configuration**: Keep configuration consistent
   - Same `CHANNEL_MAPPINGS` across all shards
   - Same `TOTAL_SHARDS` value
   - Only `SHARD_ID` differs between instances

### Scaling Guidelines

| Channels | Recommended Shards | Notes |
|----------|-------------------|-------|
| 1-10 | 1 | No sharding needed |
| 10-50 | 2-3 | Light sharding for redundancy |
| 50-200 | 3-5 | Moderate load distribution |
| 200+ | 5-10 | Heavy load distribution |

**Factors to consider:**
- Message volume per channel
- Available resources (CPU, memory, network)
- Geographic distribution
- Redundancy requirements

### High Availability

For high availability:

1. **Multiple Shards**: Use at least 3 shards for redundancy
2. **Health Monitoring**: Monitor all shards with health checks
3. **Auto-Restart**: Configure automatic restart on failure
4. **Load Balancing**: Distribute Slack webhook traffic across shards

## Troubleshooting

### Issue: Channel Not Processing Messages

**Symptoms:** Messages from a specific channel aren't being bridged

**Diagnosis:**
1. Check which shard should handle the channel:
   ```javascript
   const hash = require('crypto').createHash('md5').update('C12345').digest();
   const shardId = hash.readUInt32BE(0) % TOTAL_SHARDS;
   console.log(`Channel C12345 should be handled by shard ${shardId}`);
   ```

2. Verify the correct shard is running
3. Check that shard's health endpoint

**Solutions:**
- Ensure the assigned shard is running
- Verify shard configuration matches across all instances
- Check shard logs for errors

### Issue: Duplicate Messages

**Symptoms:** Messages appear twice in the destination

**Causes:**
- Multiple shards configured with same `SHARD_ID`
- Inconsistent `TOTAL_SHARDS` across instances
- Sharding disabled on some instances

**Solutions:**
- Verify each shard has unique `SHARD_ID`
- Ensure all instances have same `TOTAL_SHARDS`
- Check all instances have `SHARDING_ENABLED=true`

### Issue: Uneven Load Distribution

**Symptoms:** One shard handles significantly more channels than others

**Explanation:**
- Consistent hashing doesn't guarantee perfect distribution
- Small number of channels may be unevenly distributed
- Expected variance: ±20% with 10+ channels

**Solutions:**
- Acceptable with small channel counts
- Add more channels for better distribution
- Use more shards to reduce variance

## API Reference

### Sharding Functions

The bridge provides sharding functions in `src/utils/sharding.js`:

#### `initializeSharding(options)`
Initialize sharding configuration.

**Parameters:**
- `options.enabled` - Enable sharding
- `options.shardId` - Current shard ID (0-based)
- `options.totalShards` - Total number of shards

#### `shouldHandleChannel(channelId)`
Check if this shard should handle a channel.

**Returns:** `boolean`

#### `getShardConfig()`
Get current shard configuration.

**Returns:** `{ enabled, shardId, totalShards }`

#### `getShardHealth()`
Get shard health information.

**Returns:** `{ shardId, totalShards, enabled, channelsHandled, status }`

## Limitations

1. **Restart Required**: Changing `TOTAL_SHARDS` requires restarting all instances
2. **Channel Stickiness**: Channels cannot be manually assigned to specific shards
3. **No Dynamic Rebalancing**: Automatic rebalancing on shard failure is not supported
4. **Shared Redis**: All shards must use the same Redis instance

## Future Enhancements

Potential future improvements:

1. **Dynamic Sharding**: Add/remove shards without restart
2. **Manual Assignment**: Allow manual channel-to-shard mapping
3. **Auto-Recovery**: Automatic failover when a shard goes down
4. **Load-Based Sharding**: Assign channels based on message volume
5. **Shard Coordinator**: Central service to manage shard assignments

## Related Documentation

- [Deployment Guide](deployment.md) - Production deployment strategies
- [Environment Variables](environment-variables.md) - All configuration options
- [Architecture](architecture.md) - System design overview

---

**Note**: Sharding is optional and disabled by default. Single-instance deployment is suitable for most use cases. Enable sharding only when you have specific scaling needs.
