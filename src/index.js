// src/index.js
const { App, ExpressReceiver } = require('@slack/bolt');
const axios = require('axios');
const WebSocket = require('ws');
const { config } = require('./config/environment');
const { createContextLogger } = require('./utils/logger');
const { calculateBackoff } = require('./utils/reconnection');
const { 
  initializeAlerting, 
  sendCriticalAlert, 
  sendStatusMessage,
  startPeriodicHealthCheck 
} = require('./utils/alerting');
const {
  setSlackBotUserId,
  handleSlackMessage,
  handleSlackMessageEdit,
  handleSlackMessageDelete,
} = require('./handlers/slack');
const {
  setMmBotUserId,
  handleMattermostPost,
  handleMattermostPostEdit,
  handleMattermostPostDelete,
} = require('./handlers/mattermost');
const {
  setSlackReactionBotId,
  setMmReactionBotId,
  handleSlackReactionAdd,
  handleSlackReactionRemove,
  handleMmReactionAdd,
  handleMmReactionRemove
} = require('./handlers/reactions');
const {
  handleSlackSlashCommand,
  handleMattermostSlashCommand
} = require('./handlers/slash-commands');
const {
  initializePresence,
  handleSlackPresenceChange,
  handleMattermostStatusChange,
  startPeriodicSync
} = require('./handlers/presence');
const { setReactionMapping } = require('./storage/redis');
const {
  setConnectionStatus,
  recordReconnection,
  getMetrics,
  getMetricsContentType,
} = require('./metrics/metrics');

const log = createContextLogger('main');

// Reconnection state
let reconnectAttempt = 0;

// Initialize Slack app
const receiver = new ExpressReceiver({ signingSecret: config.slack.signingSecret });
const slackApp = new App({
  token: config.slack.botToken,
  receiver
});

const app = receiver.app;

// Initialize Mattermost API client
const mmApi = axios.create({
  baseURL: `${config.mattermost.url}/api/v4`,
  headers: { 'Authorization': `Bearer ${config.mattermost.token}` }
});

/**
 * Initialize the bridge
 */
async function init() {
  try {
    // Get Slack bot user ID
    const authTest = await slackApp.client.auth.test({ token: config.slack.botToken });
    setSlackBotUserId(authTest.user_id);
    setSlackReactionBotId(authTest.user_id);
    log.info('Slack bot authenticated', { userId: authTest.user_id });
    setConnectionStatus('slack', true);

    // Get Mattermost bot user ID
    const mmMe = await mmApi.get('/users/me');
    setMmBotUserId(mmMe.data.id);
    setMmReactionBotId(mmMe.data.id);
    log.info('Mattermost bot authenticated', { userId: mmMe.data.id });
    
    // Initialize presence synchronization if enabled
    if (config.presence.enabled) {
      initializePresence({
        enabled: true,
        syncIntervalMs: config.presence.syncIntervalMinutes * 60 * 1000
      });
      log.info('Presence synchronization enabled', { 
        intervalMinutes: config.presence.syncIntervalMinutes 
      });
      
      // Start periodic presence sync
      startPeriodicSync(slackApp.client, mmApi);
    } else {
      log.info('Presence synchronization disabled');
    }
    
    // Initialize alerting if configured
    const alertChannel = process.env.ALERT_CHANNEL;
    if (alertChannel) {
      initializeAlerting(slackApp, mmApi, alertChannel);
      await sendStatusMessage('healthy', 'Bridge initialized successfully');
    }
    
    // Reset reconnection attempt counter on successful init
    reconnectAttempt = 0;

  // Set up Mattermost WebSocket
  const ws = new WebSocket(`${config.mattermost.url.replace('http', 'ws')}/api/v4/websocket`);

  ws.on('open', () => {
    log.info('Mattermost WebSocket connected');
    setConnectionStatus('mattermost', true);
    ws.send(JSON.stringify({
      seq: 1,
      action: 'authentication_challenge',
      data: { token: config.mattermost.token }
    }));
  });

  ws.on('message', async (data) => {
    try {
      const event = JSON.parse(data.toString());
      
      // Handle new posts
      if (event.event === 'posted') {
        await handleMattermostPost(slackApp, mmApi, event);
      }
      // Handle post edits
      else if (event.event === 'post_edited') {
        await handleMattermostPostEdit(slackApp, event);
      }
      // Handle post deletes
      else if (event.event === 'post_deleted') {
        await handleMattermostPostDelete(slackApp, event);
      }
      // Handle reaction added
      else if (event.event === 'reaction_added' && event.data.reaction) {
        await handleMmReactionAdd(slackApp.client, JSON.parse(event.data.reaction));
      }
      // Handle reaction removed
      else if (event.event === 'reaction_removed' && event.data.reaction) {
        await handleMmReactionRemove(slackApp.client, JSON.parse(event.data.reaction));
      }
      // Handle user status changes for presence sync
      else if (event.event === 'status_change' && config.presence.enabled) {
        await handleMattermostStatusChange(slackApp.client, event);
      }
    } catch (err) {
      log.error('Error processing Mattermost event', { error: err.message });
    }
  });

  ws.on('close', () => {
    log.warn('Mattermost WebSocket closed, reconnecting with exponential backoff...');
    setConnectionStatus('mattermost', false);
    recordReconnection('mattermost');
    
    const delay = calculateBackoff(reconnectAttempt);
    reconnectAttempt++;
    
    setTimeout(() => {
      log.info('Attempting to reconnect to Mattermost WebSocket', { attempt: reconnectAttempt });
      init().catch(err => {
        log.error('Reconnection failed', { error: err.message });
        sendCriticalAlert(
          'Bridge Reconnection Failed',
          `Failed to reconnect to Mattermost after ${reconnectAttempt} attempts`,
          { error: err.message, attempt: reconnectAttempt }
        );
      });
    }, delay);
  });

  ws.on('error', (err) => {
    log.error('Mattermost WebSocket error', { error: err.message });
    sendCriticalAlert(
      'Mattermost WebSocket Error',
      'Error occurred in Mattermost WebSocket connection',
      { error: err.message }
    );
  });

  // Set up Slack message listener for new messages
  slackApp.message(async ({ message }) => {
    try {
      await handleSlackMessage(slackApp, mmApi, message);
    } catch (err) {
      log.error('Error processing Slack message', { error: err.message });
    }
  });
  
  // Set up Slack event listener for message changes and deletes only
  slackApp.event('message', async ({ event }) => {
    try {
      // Explicitly ignore messages without subtypes (regular messages handled by message listener)
      if (!event.subtype) return;
      
      // Only handle message_changed and message_deleted events
      if (event.subtype === 'message_changed') {
        await handleSlackMessageEdit(mmApi, event);
      }
      else if (event.subtype === 'message_deleted') {
        await handleSlackMessageDelete(mmApi, event);
      }
    } catch (err) {
      log.error('Error processing Slack event', { error: err.message });
    }
  });
  
  // Set up Slack reaction listeners
  slackApp.event('reaction_added', async ({ event }) => {
    try {
      await handleSlackReactionAdd(slackApp.client, mmApi, event);
    } catch (err) {
      log.error('Error processing Slack reaction_added', { error: err.message });
    }
  });
  
  slackApp.event('reaction_removed', async ({ event }) => {
    try {
      await handleSlackReactionRemove(slackApp.client, mmApi, event);
    } catch (err) {
      log.error('Error processing Slack reaction_removed', { error: err.message });
    }
  });
  
  // Set up Slack presence listener (if presence sync enabled)
  if (config.presence.enabled) {
    slackApp.event('presence_change', async ({ event }) => {
      try {
        await handleSlackPresenceChange(slackApp.client, mmApi, event);
      } catch (err) {
        log.error('Error processing Slack presence_change', { error: err.message });
      }
    });
  }
  
  // Set up Slack slash command listener
  slackApp.command('/bridge', async ({ command, ack, respond }) => {
    try {
      await ack(); // Acknowledge command receipt
      const response = await handleSlackSlashCommand(slackApp, mmApi, command);
      if (response) {
        await respond(response);
      }
    } catch (err) {
      log.error('Error processing Slack slash command', { error: err.message });
      await respond({
        response_type: 'ephemeral',
        text: `❌ Error: ${err.message}`
      });
    }
  });
  } catch (err) {
    log.error('Bridge initialization error', { error: err.message });
    await sendCriticalAlert(
      'Bridge Initialization Failed',
      'Critical error during bridge initialization',
      { error: err.message, stack: err.stack }
    );
    throw err;
  }
}

// Start the bridge
init().catch(err => {
  log.error('Bridge initialization failed', { error: err.message });
  process.exit(1);
});

// Add health check endpoint for monitoring
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'operational', 
    service: 'mattermost-slack-bridge',
    timestamp: new Date().toISOString() 
  });
});

// Add Mattermost slash command endpoint
app.post('/mattermost/commands', async (req, res) => {
  try {
    await handleMattermostSlashCommand(slackApp, mmApi, req.body);
    res.status(200).json({ status: 'ok' });
  } catch (err) {
    log.error('Error processing Mattermost slash command', { error: err.message });
    res.status(200).json({ 
      text: `❌ Error: ${err.message}`,
      response_type: 'ephemeral'
    });
  }
});

// Add metrics endpoint for Prometheus
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', getMetricsContentType());
    const metrics = await getMetrics();
    res.end(metrics);
  } catch (err) {
    log.error('Error generating metrics', { error: err.message });
    res.status(500).end();
  }
});

// Start the server
app.listen(config.port, () => {
  log.info(`Bridge server started`, { port: config.port });
  
  // Start periodic health checks if configured
  const healthCheckInterval = parseInt(process.env.HEALTH_CHECK_INTERVAL_MINUTES || '60', 10);
  if (process.env.ALERT_CHANNEL) {
    startPeriodicHealthCheck(healthCheckInterval * 60 * 1000);
  }
});
