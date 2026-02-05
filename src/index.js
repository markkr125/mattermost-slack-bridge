// src/index.js
const { App, ExpressReceiver } = require('@slack/bolt');
const axios = require('axios');
const WebSocket = require('ws');
const { config } = require('./config/environment');
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

  // Get Mattermost bot user ID
  const mmMe = await mmApi.get('/users/me');
  setMmBotUserId(mmMe.data.id);

  // Set up Mattermost WebSocket
  const ws = new WebSocket(`${config.mattermost.url.replace('http', 'ws')}/api/v4/websocket`);

  ws.on('open', () => {
    console.log('Mattermost WebSocket connected');
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
    } catch (err) {
      console.error('Error processing Mattermost message:', err.message);
    }
  });

  ws.on('close', () => {
    console.log('Mattermost WebSocket closed, reconnecting in 5 seconds...');
    setTimeout(() => {
      console.log('Reconnecting to Mattermost WebSocket...');
      init().catch(console.error);
    }, 5000);
  });

  ws.on('error', (err) => {
    console.error('Mattermost WebSocket error:', err);
  });

  // Set up Slack message listener for new messages
  slackApp.message(async ({ message }) => {
    try {
      await handleSlackMessage(slackApp, mmApi, message);
    } catch (err) {
      console.error('Error processing Slack message:', err.message);
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
      console.error('Error processing Slack event:', err.message);
    }
  });
}

// Start the bridge
init().catch(console.error);

// Start the server
app.listen(config.port, () => {
  console.log(`Bridge running on port ${config.port}`);
});
