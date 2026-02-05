// src/handlers/mattermost.js
const { convertMattermostToSlack } = require('../utils/markdown');
const { setMmToSlack, getMmToSlack, setSlackToMm, setReactionMapping } = require('../storage/redis');
const { mmToSlackChannelMap, config } = require('../config/environment');
const { getMattermostUserMapping } = require('../config/user-mappings');
const { createContextLogger } = require('../utils/logger');
const { startMessageTimer, recordMessageBridged, recordFailedEvent } = require('../metrics/metrics');

const log = createContextLogger('mattermost');

let mmBotUserId = null;

/**
 * Set the Mattermost bot user ID
 */
function setMmBotUserId(userId) {
  mmBotUserId = userId;
}

/**
 * Get the Mattermost bot user ID
 */
function getMmBotUserId() {
  return mmBotUserId;
}

/**
 * Handle new Mattermost posts
 */
async function handleMattermostPost(slackApp, mmApi, event) {
  const endTimer = startMessageTimer('mattermost', 'slack');
  
  try {
    const post = JSON.parse(event.data.post);
    
    // Check if this channel is mapped
    const slackChannelId = mmToSlackChannelMap.get(post.channel_id);
    if (!slackChannelId || post.user_id === mmBotUserId) return;
    
    // Fetch MM user details for avatar and display name
    let userName = event.data.sender_name || 'Unknown User';
    let iconUrl = '';
    
    // Check if there's a user mapping override
    const userMapping = getMattermostUserMapping(post.user_id);
    if (userMapping) {
      userName = userMapping.displayName || userName;
      iconUrl = userMapping.avatarUrl || iconUrl;
      log.debug('Using mapped user info', { mmUserId: post.user_id, userName, iconUrl });
    } else {
      // Fetch from Mattermost API if no mapping
      try {
        await mmApi.get(`/users/${post.user_id}`);
        iconUrl = `${config.mattermost.url}/api/v4/users/${post.user_id}/image`;  // May require auth
      } catch (err) {
        log.error('Error fetching MM user avatar', { userId: post.user_id, error: err.message });
      }
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
      username: userName,  // Override display name (use mapped or fetched name)
      icon_url: iconUrl,  // Override avatar (requires chat:write.customize scope)
      link_names: true,
    };

    let slackThreadTs;
    if (post.root_id) {
    slackThreadTs = await getMmToSlack(post.channel_id, post.root_id);
  }

  if (slackThreadTs) {
    slackMessage.thread_ts = slackThreadTs;
  }

  // Handle MM files to Slack
  if (post.file_ids && post.file_ids.length > 0) {
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
        log.error('Error transferring file from MM to Slack', { 
          fileId, 
          error: err.message 
        });
      }
    }

    if (!post.root_id) {
      await setMmToSlack(post.channel_id, post.id, response.ts);
      await setSlackToMm(slackChannelId, response.ts, post.id);
      // Store reaction mapping
      await setReactionMapping('slack', slackChannelId, response.ts, post.id);
      await setReactionMapping('mm', slackChannelId, post.id, response.ts);
      log.debug('Stored message mapping', { 
        mmPostId: post.id, 
        slackTs: response.ts 
      });
    }
  } else {
    const response = await slackApp.client.chat.postMessage(slackMessage);
    if (!post.root_id) {
      await setMmToSlack(post.channel_id, post.id, response.ts);
      await setSlackToMm(slackChannelId, response.ts, post.id);
      // Store reaction mapping
      await setReactionMapping('slack', slackChannelId, response.ts, post.id);
      await setReactionMapping('mm', slackChannelId, post.id, response.ts);
      log.debug('Stored message mapping', { 
        mmPostId: post.id, 
        slackTs: response.ts 
      });
    }
  }
  
  // Record successful message bridging
  recordMessageBridged('mattermost', 'slack');
  endTimer();
  } catch (err) {
    log.error('Error handling Mattermost post', { error: err.message });
    recordFailedEvent('mattermost', 'post', err.name || 'Error');
    throw err;
  }
}

/**
 * Handle Mattermost post edits
 */
async function handleMattermostPostEdit(slackApp, event) {
  const post = JSON.parse(event.data.post);
  
  // Check if this channel is mapped
  const slackChannelId = mmToSlackChannelMap.get(post.channel_id);
  if (!slackChannelId || post.user_id === mmBotUserId) return;
  
  const slackTs = await getMmToSlack(post.channel_id, post.id);
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
      log.info('Updated Slack message from MM edit', { slackTs });
    } catch (err) {
      log.error('Error updating Slack message', { slackTs, error: err.message });
    }
  }
}

/**
 * Handle Mattermost post deletes
 */
async function handleMattermostPostDelete(slackApp, event) {
  const post = JSON.parse(event.data.post);
  
  // Check if this channel is mapped
  const slackChannelId = mmToSlackChannelMap.get(post.channel_id);
  if (!slackChannelId) return;
  
  const slackTs = await getMmToSlack(post.channel_id, post.id);
  if (slackTs) {
    try {
      await slackApp.client.chat.delete({
        channel: slackChannelId,
        ts: slackTs
      });
      log.info('Deleted Slack message from MM delete', { slackTs });
    } catch (err) {
      log.error('Error deleting Slack message', { slackTs, error: err.message });
    }
  }
}

module.exports = {
  setMmBotUserId,
  getMmBotUserId,
  handleMattermostPost,
  handleMattermostPostEdit,
  handleMattermostPostDelete,
};
