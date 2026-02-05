# Usage Examples for New Features

This document provides practical examples for using the newly implemented features.

## Worker Pools for High-Volume Scenarios

### Basic Usage

```javascript
const { MessageProcessor } = require('./src/utils/message-processor');

// Create a processor with 10 concurrent workers
const processor = new MessageProcessor({ 
  maxConcurrent: 10, 
  name: 'message-handler' 
});

// Submit messages for processing
async function processMessages(messages) {
  const results = await Promise.all(
    messages.map(msg => 
      processor.submit(async () => {
        // Process individual message
        const converted = convertMarkdown(msg.text);
        await sendToDestination(converted);
        return { success: true, messageId: msg.id };
      })
    )
  );
  
  return results;
}

// Check metrics
const stats = processor.snapshot();
console.log(`Processed: ${stats.completed}, Errors: ${stats.errors}`);
console.log(`Average time: ${stats.averageDurationMs}ms`);
console.log(`Peak queue depth: ${stats.peakWaiting}`);
```

### Advanced Usage with Error Handling

```javascript
const processor = new MessageProcessor({ maxConcurrent: 20 });

async function robustProcessing() {
  try {
    const result = await processor.submit(async () => {
      // Risky operation
      return await performComplexTask();
    });
    
    console.log('Success:', result);
  } catch (error) {
    console.error('Task failed:', error.message);
    // Error is automatically counted in metrics
  }
  
  // Wait for all pending tasks to complete
  await processor.awaitCompletion();
  
  // Reset metrics for next batch
  processor.clearMetrics();
}
```

## Performance Benchmarking

### Measuring Specific Operations

```javascript
const { perfMonitor } = require('./src/utils/perf-monitor');

async function benchmarkOperation() {
  // Track a single operation
  const { output, measurement } = await perfMonitor.track(
    'markdown-conversion', 
    async () => {
      return convertMarkdown(longText);
    }
  );
  
  console.log(`Output: ${output}`);
  console.log(`Duration: ${measurement.durationMs}ms`);
  console.log(`Memory delta: ${measurement.memoryDeltaBytes} bytes`);
}
```

### Running Benchmarks

```javascript
async function runBenchmarks() {
  // Run operation multiple times
  for (let i = 0; i < 100; i++) {
    await perfMonitor.track('api-call', async () => {
      await makeAPIRequest();
    });
  }
  
  // Get statistics
  const stats = perfMonitor.analyze('api-call');
  console.log(`Samples: ${stats.sampleCount}`);
  console.log(`Average: ${stats.timing.meanMs}ms`);
  console.log(`P95: ${stats.timing.p95Ms}ms`);
  console.log(`P99: ${stats.timing.p99Ms}ms`);
  
  // Generate full report
  console.log(perfMonitor.report());
  
  // Clear for next benchmark run
  perfMonitor.reset();
}
```

### Using the CLI Tool

```bash
# Run all benchmarks with default settings
node tools/benchmark-cli.js

# Test message processing with 500 iterations
node tools/benchmark-cli.js --scenario message-processing --iterations 500

# Test concurrent processing with different pool sizes
node tools/benchmark-cli.js --scenario concurrent --pool-size 5 --iterations 100
node tools/benchmark-cli.js --scenario concurrent --pool-size 20 --iterations 100
node tools/benchmark-cli.js --scenario concurrent --pool-size 50 --iterations 100

# Run file operations benchmark
node tools/benchmark-cli.js --scenario file-ops --iterations 25
```

## Slash Commands

### User Examples

**In Slack or Mattermost:**

```
/bridge help
```
Output: Shows all available commands

```
/bridge status
```
Output:
```
🌉 Bridge Status

✅ Bridge is operational
⏱️  Uptime: 5h 42m
💾 Memory: 125 MB
```

```
/bridge stats
```
Output:
```
📊 Bridge Statistics

Slack: 🟢 Connected
Mattermost: 🟢 Connected

See /metrics endpoint for detailed statistics.
```

```
/bridge perf
```
Output:
```
📈 Performance Metrics

**message-processing**
  Samples: 1543
  Avg: 12.34ms
  P95: 23.45ms
```

### Integration in Custom Code

```javascript
const { 
  handleSlackSlashCommand,
  handleMattermostSlashCommand 
} = require('./src/handlers/slash-commands');

// Handle Slack command
slackApp.command('/bridge', async ({ command, ack, respond }) => {
  await ack();
  const response = await handleSlackSlashCommand(slackApp, mmApi, command);
  await respond(response);
});

// Handle Mattermost command via POST endpoint
app.post('/mattermost/commands', async (req, res) => {
  await handleMattermostSlashCommand(slackApp, mmApi, req.body);
  res.status(200).json({ status: 'ok' });
});
```

## User Presence Synchronization

### Configuration

**In `.env` file:**

```env
# Enable presence sync
PRESENCE_SYNC_ENABLED=true

# Sync every 3 minutes
PRESENCE_SYNC_INTERVAL_MINUTES=3
```

### Manual User Mapping

```javascript
const { registerPresenceMapping } = require('./src/handlers/presence');

// Map users for presence sync
registerPresenceMapping('U1234567890', 'mattermost_user_id_123');
registerPresenceMapping('U0987654321', 'mattermost_user_id_456');
```

### Programmatic Control

```javascript
const { 
  initializePresence,
  startPeriodicSync,
  syncAllPresences,
  getPresenceStats
} = require('./src/handlers/presence');

// Initialize presence sync
initializePresence({
  enabled: true,
  syncIntervalMs: 5 * 60 * 1000 // 5 minutes
});

// Start periodic sync
const syncTimer = startPeriodicSync(slackClient, mmApi);

// Manually trigger sync
await syncAllPresences(slackClient, mmApi);

// Get statistics
const stats = getPresenceStats();
console.log(`Mapped users: ${stats.mappedUsers}`);
console.log(`Sync interval: ${stats.syncIntervalMs}ms`);

// Stop periodic sync when needed
clearInterval(syncTimer);
```

### Handling Presence Events

```javascript
const { 
  handleSlackPresenceChange,
  handleMattermostStatusChange 
} = require('./src/handlers/presence');

// Slack presence change handler
slackApp.event('presence_change', async ({ event }) => {
  await handleSlackPresenceChange(slackClient, mmApi, event);
});

// Mattermost status change handler (via WebSocket)
ws.on('message', async (data) => {
  const event = JSON.parse(data);
  
  if (event.event === 'status_change') {
    await handleMattermostStatusChange(slackClient, event);
  }
});
```

## Combined Example: Production Setup

```javascript
const { config } = require('./src/config/environment');
const { MessageProcessor } = require('./src/utils/message-processor');
const { perfMonitor } = require('./src/utils/perf-monitor');
const { initializePresence, startPeriodicSync } = require('./src/handlers/presence');

// Initialize worker pool for message processing
const messageProcessor = new MessageProcessor({
  maxConcurrent: config.workerPool.size,
  name: 'production-messages'
});

// Initialize presence sync if enabled
if (config.presence.enabled) {
  initializePresence({
    enabled: true,
    syncIntervalMs: config.presence.syncIntervalMinutes * 60 * 1000
  });
  
  startPeriodicSync(slackClient, mmApi);
}

// Process messages with performance tracking and worker pool
async function handleIncomingMessage(message) {
  const { output, measurement } = await perfMonitor.track('message-handling', async () => {
    return await messageProcessor.submit(async () => {
      // Convert markdown
      const converted = convertMarkdown(message.text);
      
      // Send to destination
      await sendMessage(converted);
      
      return { success: true, messageId: message.id };
    });
  });
  
  // Log if slow
  if (measurement.durationMs > 1000) {
    console.warn(`Slow message processing: ${measurement.durationMs}ms`);
  }
  
  return output;
}

// Periodic metrics reporting
setInterval(() => {
  const processorStats = messageProcessor.snapshot();
  const perfStats = perfMonitor.analyze('message-handling');
  
  console.log('System Metrics:');
  console.log(`  Messages processed: ${processorStats.completed}`);
  console.log(`  Messages failed: ${processorStats.errors}`);
  console.log(`  Average latency: ${perfStats?.timing.meanMs || 0}ms`);
  console.log(`  P95 latency: ${perfStats?.timing.p95Ms || 0}ms`);
}, 60000); // Every minute
```

## Troubleshooting

### Worker Pool Issues

**Problem:** Tasks are queueing up but not processing

**Solution:**
```javascript
// Check if pool is saturated
const stats = processor.snapshot();
if (stats.currentlyWaiting > 100) {
  console.warn('Queue is backing up, consider increasing pool size');
  // Increase pool size in config: WORKER_POOL_SIZE=20
}
```

### Performance Monitoring

**Problem:** Need to identify slow operations

**Solution:**
```javascript
// Add tracking to suspect operations
const stats = perfMonitor.analyze('slow-operation');
if (stats) {
  console.log(`P99 latency: ${stats.timing.p99Ms}ms`);
  if (stats.timing.p99Ms > 5000) {
    console.error('Operation is too slow!');
  }
}
```

### Presence Sync

**Problem:** Presence not syncing for some users

**Solution:**
```javascript
// Check if users are mapped
const stats = getPresenceStats();
console.log(`Mapped users: ${stats.mappedUsers}`);

// Verify mapping exists
registerPresenceMapping('SLACK_USER', 'MM_USER');
```
