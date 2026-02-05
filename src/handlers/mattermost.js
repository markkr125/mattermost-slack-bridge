// src/handlers/mattermost.js
const { convertMattermostToSlack } = require('../utils/markdown');
const { setMmToSlack, getMmToSlack, setSlackToMm } = require('../storage/redis');
const { mmToSlackChannelMap, config } = require('../config/environment');

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
  const post = JSON.parse(event.data.post);
  
  // Check if this channel is mapped
  const slackChannelId = mmToSlackChannelMap.get(post.channel_id);
  if (!slackChannelId || post.user_id === mmBotUserId) return;
  
  // Fetch MM user details for avatar (username is already in event.data.sender_name)
  let iconUrl = '';
  try {
    await mmApi.get(`/users/${post.user_id}`);
    iconUrl = `${config.mattermost.url}/api/v4/users/${post.user_id}/image`;  // May require auth
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
        console.error('Error transferring MM file to Slack:', err.message);
      }
    }

    if (!post.root_id) {
      await setMmToSlack(post.channel_id, post.id, response.ts);
      await setSlackToMm(slackChannelId, response.ts, post.id);
    }
  } else {
    const response = await slackApp.client.chat.postMessage(slackMessage);
    if (!post.root_id) {
      await setMmToSlack(post.channel_id, post.id, response.ts);
      await setSlackToMm(slackChannelId, response.ts, post.id);
    }
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
      console.log(`Updated Slack message ${slackTs} from MM edit`);
    } catch (err) {
      console.error('Error updating Slack message:', err.message);
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
      console.log(`Deleted Slack message ${slackTs} from MM delete`);
    } catch (err) {
      console.error('Error deleting Slack message:', err.message);
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
