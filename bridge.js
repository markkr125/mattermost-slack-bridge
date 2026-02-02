// bridge.js
// Requirements (add fs for temp if needed, but using buffers here):
// npm install @slack/bolt axios ws dotenv form-data ioredis

require('dotenv').config();
const { App, ExpressReceiver } = require('@slack/bolt');
const axios = require('axios');
const WebSocket = require('ws');
const FormData = require('form-data');
const Redis = require('ioredis');

const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;
const slackBotToken = process.env.SLACK_BOT_TOKEN;
const mmToken = process.env.MM_TOKEN;
const mmUrl = process.env.MM_URL;
const slackChannelId = process.env.SLACK_CHANNEL_ID;
const mmChannelId = process.env.MM_CHANNEL_ID;
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redisExpiryDays = parseInt(process.env.REDIS_EXPIRY_DAYS || '180', 10);

// Initialize Redis client
const redis = new Redis(redisUrl, {
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    console.log(`Redis connection retry attempt ${times}, waiting ${delay}ms`);
    return delay;
  },
  maxRetriesPerRequest: 3
});

redis.on('connect', () => {
  console.log('Redis connected');
});

redis.on('error', (err) => {
  console.error('Redis error:', err.message);
});

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

// Helper functions for Redis-based thread mapping with error handling
const REDIS_EXPIRY_SECONDS = redisExpiryDays * 24 * 60 * 60;

async function setSlackToMm(slackTs, mmId) {
  try {
    await redis.setex(`slack:${slackTs}`, REDIS_EXPIRY_SECONDS, mmId);
  } catch (err) {
    console.error('Error saving to Redis (slack->mm):', err.message);
  }
}

async function getSlackToMm(slackTs) {
  try {
    return await redis.get(`slack:${slackTs}`);
  } catch (err) {
    console.error('Error reading from Redis (slack->mm):', err.message);
    return null;
  }
}

async function setMmToSlack(mmId, slackTs) {
  try {
    await redis.setex(`mm:${mmId}`, REDIS_EXPIRY_SECONDS, slackTs);
  } catch (err) {
    console.error('Error saving to Redis (mm->slack):', err.message);
  }
}

async function getMmToSlack(mmId) {
  try {
    return await redis.get(`mm:${mmId}`);
  } catch (err) {
    console.error('Error reading from Redis (mm->slack):', err.message);
    return null;
  }
}

// Markdown conversion functions
function convertMattermostToSlack(text) {
  if (!text) return text;
  
  let converted = text;
  
  // Convert strikethrough first: ~~text~~ -> ~text~
  converted = converted.replace(/~~(.+?)~~/g, '~$1~');
  
  // Convert bold and italic in a single pass to avoid conflicts
  // Use placeholders to protect converted text
  const placeholders = [];
  
  // First handle **bold** -> *bold* and store with placeholder
  converted = converted.replace(/\*\*(.+?)\*\*/g, (match, p1) => {
    const placeholder = `\x00BOLD${placeholders.length}\x00`;
    placeholders.push(`*${p1}*`);
    return placeholder;
  });
  
  // Then handle *italic* -> _italic_
  converted = converted.replace(/\*(.+?)\*/g, '_$1_');
  
  // Restore bold placeholders
  converted = converted.replace(/\x00BOLD(\d+)\x00/g, (match, index) => {
    return placeholders[parseInt(index)];
  });
  
  // Convert links: [text](url) -> <url|text>
  converted = converted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<$2|$1>');
  
  return converted;
}

function convertSlackToMattermost(text) {
  if (!text) return text;
  
  let converted = text;
  
  // Convert channel mentions first: <#CHANNEL_ID|name> -> ~name
  converted = converted.replace(/<#[^|>]+\|([^>]+)>/g, '~$1');
  
  // Convert channel mentions without name: <#CHANNEL_ID> -> #CHANNEL_ID
  converted = converted.replace(/<#([^>]+)>/g, '#$1');
  
  // Convert Slack links: <url|text> -> [text](url)
  converted = converted.replace(/<([^|>]+)\|([^>]+)>/g, '[$2]($1)');
  
  // Convert Slack links without text: <url> -> url
  converted = converted.replace(/<(https?:\/\/[^>]+)>/g, '$1');
  
  // Convert strikethrough: ~text~ -> ~~text~~
  converted = converted.replace(/(?<!~)~([^~\n]+?)~(?!~)/g, '~~$1~~');
  
  // Convert bold: *text* -> **text**
  // Need to be careful not to affect italic or lists
  converted = converted.replace(/(?<![*\s])\*([^*\n]+?)\*(?![*])/g, '**$1**');
  
  // Convert italic: _text_ -> *text* (Mattermost supports both, but * is more common)
  converted = converted.replace(/(?<!_)_([^_\n]+?)_(?!_)/g, '*$1*');
  
  // Convert user mentions: <@USER_ID> -> @USER_ID (simplified)
  converted = converted.replace(/<@([^>]+)>/g, '@$1');
  
  return converted;
}

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
    try {
      const event = JSON.parse(data.toString());
      // Handle new posts
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
        console.error('Error fetching MM user avatar:', err.message);
      }

        // Convert Mattermost markdown to Slack markdown
        const convertedMessage = convertMattermostToSlack(post.message);

        let blocks = [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": convertedMessage
            }
          }
        ];
        
      const slackMessage = {
        channel: slackChannelId,
        text: convertedMessage,
        blocks,
        username: event.data.sender_name,  // Override display name
        icon_url: iconUrl,  // Override avatar (requires chat:write.customize scope)
        link_names: true,
      };


        let slackThreadTs;
        if (post.root_id) {
          slackThreadTs = await getMmToSlack(post.root_id);
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
              console.error('Error transferring MM file to Slack:', err.message);
              // Optionally notify in message
            }
          }

          if (!post.root_id) {
            await setMmToSlack(post.id, response.ts);
            await setSlackToMm(response.ts, post.id);
          }
        } else {
          const response = await slackApp.client.chat.postMessage(slackMessage);
          if (!post.root_id) {
            await setMmToSlack(post.id, response.ts);
            await setSlackToMm(response.ts, post.id);
          }
        }
      }
      
      // Handle post edits
      else if (event.event === 'post_edited') {
        const post = JSON.parse(event.data.post);
        if (post.channel_id !== mmChannelId || post.user_id === mmBotUserId) return;
        
        const slackTs = await getMmToSlack(post.id);
        if (slackTs) {
          try {
            // Convert Mattermost markdown to Slack markdown
            const convertedMessage = convertMattermostToSlack(post.message);
            
            await slackApp.client.chat.update({
              channel: slackChannelId,
              ts: slackTs,
              text: convertedMessage,
              blocks: [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": convertedMessage
                  }
                }
              ]
            });
            console.log(`Updated Slack message ${slackTs} from MM edit`);
          } catch (err) {
            console.error('Error updating Slack message:', err.message);
          }
        }
      }
      
      // Handle post deletes
      else if (event.event === 'post_deleted') {
        const post = JSON.parse(event.data.post);
        if (post.channel_id !== mmChannelId) return;
        
        const slackTs = await getMmToSlack(post.id);
        if (slackTs) {
          try {
            await slackApp.client.chat.delete({
              channel: slackChannelId,
              ts: slackTs
            });
            console.log(`Deleted Slack message ${slackTs} from MM delete`);
          } catch (err) {
            console.error('Error deleting Slack message:', err.message);
          }
        }
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
      // Guard conditions for message filtering
      if (message.channel !== slackChannelId) return; // Wrong channel
      if (!message.user) return; // No user (system messages, etc.)
      if (message.user === slackBotUserId) return; // Skip our own messages
      if (message.subtype) return; // Skip messages with subtypes (handled by event listener)

      let userName = 'Unknown User';
      let avatarUrl = '';
      try {
          const userInfo = await slackApp.client.users.info({ user: message.user });
          userName = userInfo.user?.profile?.display_name || userInfo.user?.name || 'Unknown User';
          avatarUrl = userInfo.user?.profile?.image_original || userInfo.user?.profile?.image_1024 || '';  // Public URL
      } catch (err) {
          console.error(`Error fetching Slack user info for user ${message.user}:`, err.message);
      }
      
  
    // Convert Slack markdown to Mattermost markdown
    let text = convertSlackToMattermost(message.text);
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
        mmRootId = await getSlackToMm(message.thread_ts);
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
            formData.append('files', fileBuffer, { filename: fileName });

            const uploadResponse = await mmApi.post('/files', formData, {
              headers: formData.getHeaders()
            });
            fileIds.push(...uploadResponse.data.file_infos.map(f => f.id));
          } catch (err) {
            console.error('Error transferring Slack file to MM:', err.message);
            // Optionally notify in message
          }
        }
        mmPost.file_ids = fileIds;
      }

      const newPost = await mmApi.post('/posts', mmPost);

      if (!message.thread_ts) {
        await setSlackToMm(message.ts, newPost.data.id);
        await setMmToSlack(newPost.data.id, message.ts);
      }
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
      if (event.subtype === 'message_changed' && event.channel === slackChannelId) {
        // Check message exists before accessing its properties
        if (!event.message) return;
        const message = event.message;
        if (!message.user || message.user === slackBotUserId) return;
        
        const mmPostId = await getSlackToMm(message.ts);
        if (mmPostId) {
          try {
            // Convert Slack markdown to Mattermost markdown
            const convertedMessage = convertSlackToMattermost(message.text);
            
            await mmApi.put(`/posts/${mmPostId}/patch`, {
              message: convertedMessage
            });
            console.log(`Updated MM post ${mmPostId} from Slack edit`);
          } catch (err) {
            console.error('Error updating MM post:', err.message);
          }
        }
      }
      else if (event.subtype === 'message_deleted' && event.channel === slackChannelId) {
        // Check previous_message exists before accessing its properties
        if (!event.previous_message) return;
        const mmPostId = await getSlackToMm(event.previous_message.ts);
        if (mmPostId) {
          try {
            await mmApi.delete(`/posts/${mmPostId}`);
            console.log(`Deleted MM post ${mmPostId} from Slack delete`);
          } catch (err) {
            console.error('Error deleting MM post:', err.message);
          }
        }
      }
      // Explicitly ignore other subtypes and regular messages (no subtype)
    } catch (err) {
      console.error('Error processing Slack event:', err.message);
    }
  });
}

init().catch(console.error);

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Bridge running on port ${port}`);
});