// src/index.js
const { App, ExpressReceiver } = require('@slack/bolt');
const axios = require('axios');
const WebSocket = require('ws');
const { config } = require('./config/environment');
const { createContextLogger } = require('./utils/logger');
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
const { setReactionMapping } = require('./storage/redis');
const {
  setConnectionStatus,
  recordReconnection,
  getMetrics,
  getMetricsContentType,
} = require('./metrics/metrics');

const log = createContextLogger('main');

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
  // Get Slack bot user ID
  const authTest = await slackApp.client.auth.test({ token: config.slack.botToken });
  setSlackBotUserId(authTest.user_id);
  setSlackReactionBotId(authTest.user_id);
  log.info('Slack bot authenticated', { userId: authTest.user_id });

  // Get Mattermost bot user ID
  const mmMe = await mmApi.get('/users/me');
  setMmBotUserId(mmMe.data.id);
  setMmReactionBotId(mmMe.data.id);
  log.info('Mattermost bot authenticated', { userId: mmMe.data.id });

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
    } catch (err) {
      log.error('Error processing Mattermost event', { error: err.message });
    }
  });

  ws.on('close', () => {
    log.warn('Mattermost WebSocket closed, reconnecting in 5 seconds...');
    setConnectionStatus('mattermost', false);
    recordReconnection('mattermost');
    setTimeout(() => {
      log.info('Attempting to reconnect to Mattermost WebSocket');
      init().catch(err => log.error('Reconnection failed', { error: err.message }));
    }, 5000);
  });

  ws.on('error', (err) => {
    log.error('Mattermost WebSocket error', { error: err.message });
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
}

// Start the bridge
init().catch(err => log.error('Bridge initialization failed', { error: err.message }));

// Add health check endpoint for monitoring
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'operational', 
    service: 'mattermost-slack-bridge',
    timestamp: new Date().toISOString() 
  });
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
});
