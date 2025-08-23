// bridge.js
// Requirements (add fs for temp if needed, but using buffers here):
// npm install @slack/bolt axios ws dotenv

require('dotenv').config();
const { App, ExpressReceiver } = require('@slack/bolt');
const axios = require('axios');
const WebSocket = require('ws');

const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;
const slackBotToken = process.env.SLACK_BOT_TOKEN;
const mmToken = process.env.MM_TOKEN;
const mmUrl = process.env.MM_URL;
const slackChannelId = process.env.SLACK_CHANNEL_ID;
const mmChannelId = process.env.MM_CHANNEL_ID;

const receiver = new ExpressReceiver({ signingSecret: slackSigningSecret });
const slackApp = new App({
  token: slackBotToken,
  receiver
});

const app = receiver.app;

const mmApi = axios.create({
  baseURL: `${mmUrl}/api/v4`,
  headers: { 'Authorization': `Bearer ${mmToken}` }
});

// Thread maps
const slackToMmThread = new Map(); // slack thread_ts => mm root_id
const mmToSlackThread = new Map(); // mm root_id => slack thread_ts

let slackBotUserId;
let mmBotUserId;

async function init() {
  // Get Slack bot user ID
  const authTest = await slackApp.client.auth.test({ token: slackBotToken });
  slackBotUserId = authTest.user_id;

  // Get Mattermost bot user ID
  const mmMe = await mmApi.get('/users/me');
  mmBotUserId = mmMe.data.id;

  // Set up Mattermost WebSocket
  const ws = new WebSocket(`${mmUrl.replace('http', 'ws')}/api/v4/websocket`);

  ws.on('open', () => {
    console.log('Mattermost WebSocket connected');
    ws.send(JSON.stringify({
      seq: 1,
      action: 'authentication_challenge',
      data: { token: mmToken }
    }));
  });

  ws.on('message', async (data) => {
    const event = JSON.parse(data.toString());
    if (event.event === 'posted') {
      const post = JSON.parse(event.data.post);
      if (post.channel_id !== mmChannelId || post.user_id === mmBotUserId) return;
      
    // Fetch MM user details for avatar (username is already in event.data.sender_name)
    let iconUrl = '';
    try {
      const user = await mmApi.get(`/users/${post.user_id}`);
      iconUrl = `${mmUrl}/api/v4/users/${post.user_id}/image`;  // May require auth; see notes above
      // If auth issue, optionally download and rehost:
      // const imageResp = await mmApi.get(`/users/${post.user_id}/image`, { responseType: 'arraybuffer' });
      // Then upload imageResp.data to a public service and set iconUrl to that.
    } catch (err) {
      console.error('Error fetching MM user avatar:', err);
    }

      let blocks = `[
    {
        "type": "section",
        "text": {
            "type": "mrkdwn",
            "text": "${post.message}"
        }
    }
]`
      
    const slackMessage = {
      channel: slackChannelId,
      text: post.message,
      blocks,
      username: event.data.sender_name,  // Override display name
      icon_url: iconUrl,  // Override avatar (requires chat:write.customize scope)
      link_names: true,
    };


      let slackThreadTs;
      if (post.root_id) {
        slackThreadTs = mmToSlackThread.get(post.root_id);
      }

      if (slackThreadTs) {
        slackMessage.thread_ts = slackThreadTs;
      }

      // Handle MM files to Slack
      if (post.file_ids && post.file_ids.length > 0) {
        // text += ' (with attachments)';
        // slackMessage.text = text; // Placeholder while uploading
        const response = await slackApp.client.chat.postMessage(slackMessage);
        slackMessage.ts = response.ts; // For updates if needed

        for (const fileId of post.file_ids) {
          try {
            // Get file info
            const fileInfo = await mmApi.get(`/files/${fileId}/info`);
            const fileName = fileInfo.data.name;
            // Download file
            const fileDownload = await mmApi.get(`/files/${fileId}`, { responseType: 'arraybuffer' });
            const fileBuffer = Buffer.from(fileDownload.data);
            // Upload to Slack
            await slackApp.client.files.uploadV2({
              channels: slackChannelId,
              thread_ts: slackMessage.thread_ts || response.ts,
              file: fileBuffer,
              filename: fileName,
              title: fileName
            });
          } catch (err) {
            console.error('Error transferring MM file to Slack:', err);
            // Optionally notify in message
          }
        }

        if (!post.root_id) {
          mmToSlackThread.set(post.id, response.ts);
          slackToMmThread.set(response.ts, post.id);
        }
      } else {
        const response = await slackApp.client.chat.postMessage(slackMessage);
        if (!post.root_id) {
          mmToSlackThread.set(post.id, response.ts);
          slackToMmThread.set(response.ts, post.id);
        }
      }
    }
  });

  ws.on('close', () => {
    console.log('Mattermost WebSocket closed');
    // Reconnect logic can be added here
  });

  ws.on('error', (err) => {
    console.error('Mattermost WebSocket error:', err);
  });

  // Set up Slack message listener
  slackApp.message(async ({ message }) => {
    if (message.channel !== slackChannelId || message.user === slackBotUserId || message.subtype) return;

    let userName = 'Unknown User';
    let avatarUrl = '';
    try {
        const userInfo = await slackApp.client.users.info({ user: message.user });
        userName = userInfo.user?.profile?.display_name || userInfo.user?.name || 'Unknown User';
        avatarUrl = userInfo.user?.profile?.image_original || userInfo.user?.profile?.image_1024 || '';  // Public URL
    } catch (err) {
        console.error(`Error fetching Slack user info for user ${message.user}:`, err);
    }
    

  let text = message.text;  // No need for [From Slack] prefix if overriding
  const mmPost = {
    channel_id: mmChannelId,
    message: text,
    props: {
      from_webhook: 'true',  // Enables overrides
      override_username: userName,  // Custom display name
      override_icon_url: avatarUrl  // Custom avatar (public URL)
    }
  };

    let mmRootId;
    if (message.thread_ts) {
      mmRootId = slackToMmThread.get(message.thread_ts);
    }

    if (mmRootId) {
      mmPost.root_id = mmRootId;
      mmPost.parent_id = mmRootId; // Keep flat structure
    }

    // Handle Slack files to MM
    let fileIds = [];
    if (message.files && message.files.length > 0) {
      text += ' (with attachments)';
      mmPost.message = text; // Placeholder

      for (const file of message.files) {
        try {
          // Download file from Slack
          const fileDownload = await axios.get(file.url_private_download, {
            headers: { 'Authorization': `Bearer ${slackBotToken}` },
            responseType: 'arraybuffer'
          });
          const fileBuffer = Buffer.from(fileDownload.data);
          const fileName = file.name;

          // Upload to Mattermost
          const formData = new FormData();
          formData.append('channel_id', mmChannelId);
          formData.append('files', new Blob([fileBuffer]), fileName);

          const uploadResponse = await mmApi.post('/files', formData, {
            headers: { ...formData.getHeaders() }
          });
          fileIds.push(...uploadResponse.data.file_infos.map(f => f.id));
        } catch (err) {
          console.error('Error transferring Slack file to MM:', err);
          // Optionally notify in message
        }
      }
      mmPost.file_ids = fileIds;
    }

    const newPost = await mmApi.post('/posts', mmPost);

    if (!message.thread_ts) {
      slackToMmThread.set(message.ts, newPost.data.id);
      mmToSlackThread.set(newPost.data.id, message.ts);
    }
  });
}

init().catch(console.error);

// Start the server
const port = process.env.PORT
app.listen(port, () => {
  console.log(`Bridge running on port ${port}`);
});