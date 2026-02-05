// src/handlers/slack.js
const { convertSlackToMattermost } = require('../utils/markdown');
const { setSlackToMm, getSlackToMm, setMmToSlack, setReactionMapping } = require('../storage/redis');
const { slackToMmChannelMap } = require('../config/environment');
const { createContextLogger } = require('../utils/logger');

const log = createContextLogger('slack');

let slackBotUserId = null;

/**
 * Set the Slack bot user ID
 */
function setSlackBotUserId(userId) {
  slackBotUserId = userId;
}

/**
 * Get the Slack bot user ID
 */
function getSlackBotUserId() {
  return slackBotUserId;
}

/**
 * Handle new Slack messages
 */
async function handleSlackMessage(slackApp, mmApi, message) {
  // Guard conditions for message filtering
  // Check if this channel is mapped
  const mmChannelId = slackToMmChannelMap.get(message.channel);
  if (!mmChannelId) return; // Channel not in our mappings
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
    log.error('Error fetching Slack user info', { userId: message.user, error: err.message });
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
    mmRootId = await getSlackToMm(message.channel, message.thread_ts);
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
        const axios = require('axios');
        const FormData = require('form-data');
        const { config } = require('../config/environment');
        
        // Download file from Slack
        const fileDownload = await axios.get(file.url_private_download, {
          headers: { 'Authorization': `Bearer ${config.slack.botToken}` },
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
        log.error('Error transferring file from Slack to MM', { 
          fileName: file.name, 
          error: err.message 
        });
      }
    }
    mmPost.file_ids = fileIds;
  }

  const newPost = await mmApi.post('/posts', mmPost);

  if (!message.thread_ts) {
    await setSlackToMm(message.channel, message.ts, newPost.data.id);
    await setMmToSlack(mmChannelId, newPost.data.id, message.ts);
    // Store reaction mapping for bidirectional sync
    await setReactionMapping('slack', message.channel, message.ts, newPost.data.id);
    await setReactionMapping('mm', message.channel, newPost.data.id, message.ts);
    log.debug('Stored message mapping', { 
      slackTs: message.ts, 
      mmPostId: newPost.data.id 
    });
  }
}

/**
 * Handle Slack message edits
 */
async function handleSlackMessageEdit(mmApi, event) {
  // Check message exists before accessing its properties
  if (!event.message) return;
  const message = event.message;
  if (!message.user || message.user === slackBotUserId) return;
  
  const { slackToMmChannelMap } = require('../config/environment');
  const mmChannelId = slackToMmChannelMap.get(event.channel);
  if (!mmChannelId) return;
  
  const mmPostId = await getSlackToMm(event.channel, message.ts);
  if (mmPostId) {
    try {
      // Convert Slack markdown to Mattermost markdown
      const convertedMessage = convertSlackToMattermost(message.text);
      
      await mmApi.put(`/posts/${mmPostId}/patch`, {
        message: convertedMessage
      });
      log.info('Updated MM post from Slack edit', { mmPostId });
    } catch (err) {
      log.error('Error updating MM post', { mmPostId, error: err.message });
    }
  }
}

/**
 * Handle Slack message deletes
 */
async function handleSlackMessageDelete(mmApi, event) {
  // Check previous_message exists before accessing its properties
  if (!event.previous_message) return;
  
  const { slackToMmChannelMap } = require('../config/environment');
  const mmChannelId = slackToMmChannelMap.get(event.channel);
  if (!mmChannelId) return;
  
  const mmPostId = await getSlackToMm(event.channel, event.previous_message.ts);
  if (mmPostId) {
    try {
      await mmApi.delete(`/posts/${mmPostId}`);
      log.info('Deleted MM post from Slack delete', { mmPostId });
    } catch (err) {
      log.error('Error deleting MM post', { mmPostId, error: err.message });
    }
  }
}

module.exports = {
  setSlackBotUserId,
  getSlackBotUserId,
  handleSlackMessage,
  handleSlackMessageEdit,
  handleSlackMessageDelete,
};
