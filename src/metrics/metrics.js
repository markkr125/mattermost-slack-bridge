// src/metrics/metrics.js
const client = require('prom-client');
const { createContextLogger } = require('../utils/logger');

const log = createContextLogger('metrics');

// Create a Registry to register metrics
const register = new client.Registry();

// Add default metrics (CPU, memory, etc.)
client.collectDefaultMetrics({ register });

// Custom metrics for the bridge

/**
 * Counter: Total messages bridged
 */
const messagesBridged = new client.Counter({
  name: 'bridge_messages_total',
  help: 'Total number of messages bridged between platforms',
  labelNames: ['direction', 'source', 'target'],
  registers: [register]
});

/**
 * Histogram: Message processing latency
 */
const messageLatency = new client.Histogram({
  name: 'bridge_message_latency_seconds',
  help: 'Message processing latency in seconds',
  labelNames: ['direction', 'source', 'target'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register]
});

/**
 * Counter: Reconnection attempts
 */
const reconnections = new client.Counter({
  name: 'bridge_reconnections_total',
  help: 'Total number of reconnection attempts',
  labelNames: ['platform'],
  registers: [register]
});

/**
 * Counter: Failed events
 */
const failedEvents = new client.Counter({
  name: 'bridge_failed_events_total',
  help: 'Total number of failed events',
  labelNames: ['platform', 'event_type', 'error_type'],
  registers: [register]
});

/**
 * Gauge: Connection status
 */
const connectionStatus = new client.Gauge({
  name: 'bridge_connection_status',
  help: 'Connection status (1 = connected, 0 = disconnected)',
  labelNames: ['platform'],
  registers: [register]
});

/**
 * Record a message being bridged
 * @param {string} source - Source platform ('slack' or 'mattermost')
 * @param {string} target - Target platform ('slack' or 'mattermost')
 */
function recordMessageBridged(source, target) {
  const direction = `${source}_to_${target}`;
  messagesBridged.inc({ direction, source, target });
  log.debug('Recorded message bridged', { source, target });
}

/**
 * Record message processing latency
 * @param {string} source - Source platform
 * @param {string} target - Target platform
 * @param {number} latencySeconds - Processing time in seconds
 */
function recordMessageLatency(source, target, latencySeconds) {
  const direction = `${source}_to_${target}`;
  messageLatency.observe({ direction, source, target }, latencySeconds);
}

/**
 * Create a timer for measuring latency
 * @param {string} source - Source platform
 * @param {string} target - Target platform
 * @returns {Function} End function to call when operation completes
 */
function startMessageTimer(source, target) {
  const direction = `${source}_to_${target}`;
  return messageLatency.startTimer({ direction, source, target });
}

/**
 * Record a reconnection attempt
 * @param {string} platform - Platform name ('slack' or 'mattermost')
 */
function recordReconnection(platform) {
  reconnections.inc({ platform });
  log.debug('Recorded reconnection', { platform });
}

/**
 * Record a failed event
 * @param {string} platform - Platform name
 * @param {string} eventType - Type of event that failed
 * @param {string} errorType - Type of error
 */
function recordFailedEvent(platform, eventType, errorType = 'unknown') {
  failedEvents.inc({ platform, event_type: eventType, error_type: errorType });
  log.debug('Recorded failed event', { platform, eventType, errorType });
}

/**
 * Update connection status
 * @param {string} platform - Platform name
 * @param {boolean} isConnected - Connection status
 */
function setConnectionStatus(platform, isConnected) {
  connectionStatus.set({ platform }, isConnected ? 1 : 0);
  log.debug('Updated connection status', { platform, isConnected });
}

/**
 * Get metrics in Prometheus format
 * @returns {Promise<string>} Metrics text
 */
async function getMetrics() {
  return await register.metrics();
}

/**
 * Get metrics content type
 * @returns {string} Content type header value
 */
function getMetricsContentType() {
  return register.contentType;
}

module.exports = {
  recordMessageBridged,
  recordMessageLatency,
  startMessageTimer,
  recordReconnection,
  recordFailedEvent,
  setConnectionStatus,
  getMetrics,
  getMetricsContentType,
};
