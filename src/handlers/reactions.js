// src/handlers/reactions.js
// Bidirectional reaction synchronization between Slack and Mattermost
const { setReactionMapping, getReactionMapping } = require('../storage/redis');
const { slackToMmChannelMap, mmToSlackChannelMap } = require('../config/environment');
const { createContextLogger } = require('../utils/logger');
const { getCustomEmojiUrl, isCustomEmoji } = require('../utils/emoji-sync');

const log = createContextLogger('reactions');

let slackBotId = null;
let mmBotId = null;

function setSlackReactionBotId(botId) {
  slackBotId = botId;
}

function setMmReactionBotId(botId) {
  mmBotId = botId;
}

// Emoji mapping between Slack and Mattermost (they use different names for some)
const emojiTranslations = {
  slackToMm: {
    '+1': 'thumbsup',
    '-1': 'thumbsdown',
    'simple_smile': 'smile',
    'slightly_smiling_face': 'slightly_smiling_face'
  },
  mmToSlack: {
    'thumbsup': '+1',
    'thumbsdown': '-1',
    'smile': 'simple_smile'
  }
};

function translateEmojiForMattermost(slackEmoji) {
  // Check if it's a custom emoji first
  if (isCustomEmoji(slackEmoji)) {
    log.debug('Detected custom Slack emoji', { emojiName: slackEmoji });
    // For custom emojis, we'll need to handle them specially in MM
    return slackEmoji;
  }
  return emojiTranslations.slackToMm[slackEmoji] || slackEmoji;
}

function translateEmojiForSlack(mmEmoji) {
  return emojiTranslations.mmToSlack[mmEmoji] || mmEmoji;
}

/**
 * Create a custom emoji in Mattermost if needed
 * @param {Object} mmApi - Mattermost API client
 * @param {string} emojiName - Name of the emoji
 * @returns {Promise<boolean>} True if emoji exists or was created
 */
async function ensureCustomEmojiInMattermost(mmApi, emojiName) {
  try {
    const emojiUrl = getCustomEmojiUrl(emojiName);
    if (!emojiUrl) {
      return false;
    }

    // Check if emoji already exists in Mattermost
    try {
      await mmApi.get(`/emoji/name/${emojiName}`);
      log.debug('Custom emoji already exists in Mattermost', { emojiName });
      return true;
    } catch (err) {
      // Emoji doesn't exist, need to create it
      log.debug('Custom emoji not found in Mattermost, would need to create', { emojiName });
      // Note: Creating custom emojis in MM requires image upload which is complex
      // For now, we'll just log that we detected a custom emoji
      return false;
    }
  } catch (error) {
    log.error('Error checking custom emoji in Mattermost', { 
      error: error.message,
      emojiName 
    });
    return false;
  }
}

/**
 * Handle reaction_added event from Slack
 */
async function handleSlackReactionAdd(slackClient, mmApi, eventData) {
  const { reaction, item, user } = eventData;
  
  // Skip if not our bot or item is not a message
  if (user === slackBotId || item.type !== 'message') {
    return;
  }
  
  const targetChannel = slackToMmChannelMap.get(item.channel);
  if (!targetChannel) {
    return;
  }
  
  try {
    const mmPostId = await getReactionMapping('slack', item.channel, item.ts);
    if (!mmPostId) {
      log.debug('No MM post found for Slack reaction', { 
        slackChannel: item.channel, 
        slackTs: item.ts 
      });
      return;
    }
    
    const translatedEmoji = translateEmojiForMattermost(reaction);
    
    // Log if this is a custom emoji
    if (isCustomEmoji(reaction)) {
      log.info('Processing custom Slack emoji reaction', { 
        emojiName: reaction,
        emojiUrl: getCustomEmojiUrl(reaction)
      });
    }
    
    await mmApi.post('/reactions', {
      user_id: mmBotId,
      post_id: mmPostId,
      emoji_name: translatedEmoji
    });
    
    log.info('Synced reaction from Slack to MM', { 
      emoji: reaction, 
      translatedTo: translatedEmoji,
      mmPostId,
      isCustom: isCustomEmoji(reaction)
    });
  } catch (error) {
    log.error('Failed to sync Slack reaction to MM', { 
      error: error.message,
      reaction,
      channel: item.channel
    });
  }
}

/**
 * Handle reaction_removed event from Slack
 */
async function handleSlackReactionRemove(slackClient, mmApi, eventData) {
  const { reaction, item, user } = eventData;
  
  if (user === slackBotId || item.type !== 'message') {
    return;
  }
  
  const targetChannel = slackToMmChannelMap.get(item.channel);
  if (!targetChannel) {
    return;
  }
  
  try {
    const mmPostId = await getReactionMapping('slack', item.channel, item.ts);
    if (!mmPostId) {
      return;
    }
    
    const translatedEmoji = translateEmojiForMattermost(reaction);
    
    await mmApi.delete(`/users/${mmBotId}/posts/${mmPostId}/reactions/${translatedEmoji}`);
    
    log.info('Removed reaction sync from Slack to MM', { 
      emoji: reaction,
      mmPostId 
    });
  } catch (error) {
    log.error('Failed to remove Slack reaction from MM', { 
      error: error.message,
      reaction
    });
  }
}

/**
 * Handle reaction_added WebSocket event from Mattermost
 */
async function handleMmReactionAdd(slackClient, reactionData) {
  const { emoji_name, post_id, user_id } = reactionData;
  
  if (user_id === mmBotId) {
    return;
  }
  
  try {
    const channelAndTs = await getReactionMapping('mm', null, post_id);
    if (!channelAndTs) {
      log.debug('No Slack message found for MM reaction', { mmPostId: post_id });
      return;
    }
    
    const [slackChannel, slackTs] = channelAndTs.split(':');
    const translatedEmoji = translateEmojiForSlack(emoji_name);
    
    await slackClient.reactions.add({
      channel: slackChannel,
      timestamp: slackTs,
      name: translatedEmoji
    });
    
    log.info('Synced reaction from MM to Slack', { 
      emoji: emoji_name,
      translatedTo: translatedEmoji,
      slackTs 
    });
  } catch (error) {
    log.error('Failed to sync MM reaction to Slack', { 
      error: error.message,
      emoji: emoji_name
    });
  }
}

/**
 * Handle reaction_removed WebSocket event from Mattermost
 */
async function handleMmReactionRemove(slackClient, reactionData) {
  const { emoji_name, post_id, user_id } = reactionData;
  
  if (user_id === mmBotId) {
    return;
  }
  
  try {
    const channelAndTs = await getReactionMapping('mm', null, post_id);
    if (!channelAndTs) {
      return;
    }
    
    const [slackChannel, slackTs] = channelAndTs.split(':');
    const translatedEmoji = translateEmojiForSlack(emoji_name);
    
    await slackClient.reactions.remove({
      channel: slackChannel,
      timestamp: slackTs,
      name: translatedEmoji
    });
    
    log.info('Removed reaction sync from MM to Slack', { 
      emoji: emoji_name,
      slackTs 
    });
  } catch (error) {
    log.error('Failed to remove MM reaction from Slack', { 
      error: error.message,
      emoji: emoji_name
    });
  }
}

module.exports = {
  setSlackReactionBotId,
  setMmReactionBotId,
  handleSlackReactionAdd,
  handleSlackReactionRemove,
  handleMmReactionAdd,
  handleMmReactionRemove
};
