// src/utils/alerting.js
const { createContextLogger } = require('./logger');

const log = createContextLogger('alerting');

let alertingConfig = {
  enabled: false,
  slackApp: null,
  mmApi: null,
  alertChannel: null,
};

/**
 * Initialize alerting configuration
 * @param {Object} slackApp - Slack app client
 * @param {Object} mmApi - Mattermost API client
 * @param {string} channelId - Channel ID for alerts (prefixed with 'slack:' or 'mm:')
 */
function initializeAlerting(slackApp, mmApi, channelId) {
  if (!channelId) {
    log.info('Alerting disabled - no alert channel configured');
    return;
  }
  
  alertingConfig.enabled = true;
  alertingConfig.slackApp = slackApp;
  alertingConfig.mmApi = mmApi;
  alertingConfig.alertChannel = channelId;
  
  log.info('Alerting initialized', { channel: channelId });
}

/**
 * Send a critical error alert
 * @param {string} title - Alert title
 * @param {string} message - Alert message
 * @param {Object} context - Additional context
 */
async function sendCriticalAlert(title, message, context = {}) {
  if (!alertingConfig.enabled) {
    return;
  }
  
  const timestamp = new Date().toISOString();
  const alertMessage = `🚨 **${title}**\n\n${message}\n\n**Time:** ${timestamp}\n**Context:** ${JSON.stringify(context, null, 2)}`;
  
  try {
    if (alertingConfig.alertChannel.startsWith('slack:')) {
      const channelId = alertingConfig.alertChannel.replace('slack:', '');
      await alertingConfig.slackApp.client.chat.postMessage({
        channel: channelId,
        text: alertMessage,
      });
      log.info('Sent critical alert to Slack', { title });
    } else if (alertingConfig.alertChannel.startsWith('mm:')) {
      const channelId = alertingConfig.alertChannel.replace('mm:', '');
      await alertingConfig.mmApi.post('/posts', {
        channel_id: channelId,
        message: alertMessage,
      });
      log.info('Sent critical alert to Mattermost', { title });
    }
  } catch (err) {
    log.error('Failed to send critical alert', { error: err.message, title });
  }
}

/**
 * Send a bridge status message
 * @param {string} status - Status ('healthy', 'degraded', 'down')
 * @param {string} details - Additional details
 */
async function sendStatusMessage(status, details = '') {
  if (!alertingConfig.enabled) {
    return;
  }
  
  const statusEmoji = {
    'healthy': '✅',
    'degraded': '⚠️',
    'down': '❌',
  };
  
  const emoji = statusEmoji[status] || '❓';
  const timestamp = new Date().toISOString();
  const message = `${emoji} **Bridge Status: ${status.toUpperCase()}**\n\n${details}\n\n**Time:** ${timestamp}`;
  
  try {
    if (alertingConfig.alertChannel.startsWith('slack:')) {
      const channelId = alertingConfig.alertChannel.replace('slack:', '');
      await alertingConfig.slackApp.client.chat.postMessage({
        channel: channelId,
        text: message,
      });
      log.info('Sent status message to Slack', { status });
    } else if (alertingConfig.alertChannel.startsWith('mm:')) {
      const channelId = alertingConfig.alertChannel.replace('mm:', '');
      await alertingConfig.mmApi.post('/posts', {
        channel_id: channelId,
        message: message,
      });
      log.info('Sent status message to Mattermost', { status });
    }
  } catch (err) {
    log.error('Failed to send status message', { error: err.message, status });
  }
}

/**
 * Start periodic health status messages
 * @param {number} intervalMs - Interval in milliseconds (default: 1 hour)
 * @returns {NodeJS.Timeout} Interval handle
 */
function startPeriodicHealthCheck(intervalMs = 3600000) {
  if (!alertingConfig.enabled) {
    log.info('Periodic health checks disabled');
    return null;
  }
  
  log.info('Starting periodic health checks', { intervalMs });
  
  const interval = setInterval(async () => {
    await sendStatusMessage('healthy', 'Bridge is operating normally');
  }, intervalMs);
  
  return interval;
}

module.exports = {
  initializeAlerting,
  sendCriticalAlert,
  sendStatusMessage,
  startPeriodicHealthCheck,
};
