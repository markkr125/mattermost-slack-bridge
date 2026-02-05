// src/utils/emoji-sync.js
// Slack custom emoji synchronization and caching
const { createContextLogger } = require('./logger');

const log = createContextLogger('emoji-sync');

// In-memory cache for custom emojis
let customEmojiCache = new Map();
let lastSyncTime = null;

/**
 * Fetch custom emojis from Slack workspace
 * @param {Object} slackClient - Slack API client
 * @returns {Promise<Map>} Map of emoji names to URLs
 */
async function fetchSlackCustomEmojis(slackClient) {
  try {
    log.info('Fetching custom emojis from Slack');
    const result = await slackClient.emoji.list();
    
    if (!result.ok) {
      log.error('Failed to fetch Slack custom emojis', { error: result.error });
      return new Map();
    }
    
    const emojiMap = new Map();
    const emojis = result.emoji || {};
    
    // Filter out alias emojis (those that point to another emoji with "alias:")
    Object.entries(emojis).forEach(([name, url]) => {
      if (!url.startsWith('alias:')) {
        emojiMap.set(name, url);
      }
    });
    
    log.info('Successfully fetched custom emojis', { count: emojiMap.size });
    return emojiMap;
  } catch (error) {
    log.error('Error fetching Slack custom emojis', { error: error.message });
    return new Map();
  }
}

/**
 * Sync custom emojis from Slack to cache
 * @param {Object} slackClient - Slack API client
 * @returns {Promise<boolean>} True if sync was successful
 */
async function syncCustomEmojis(slackClient) {
  try {
    const emojiMap = await fetchSlackCustomEmojis(slackClient);
    
    // Consider it a failure if we couldn't fetch any emojis
    // (unless the workspace truly has no custom emojis, which is unlikely)
    if (emojiMap.size === 0 && customEmojiCache.size > 0) {
      log.warn('Emoji sync returned empty result, keeping existing cache');
      return false;
    }
    
    customEmojiCache = emojiMap;
    lastSyncTime = Date.now();
    
    log.info('Custom emoji cache updated', { 
      count: customEmojiCache.size,
      timestamp: new Date(lastSyncTime).toISOString()
    });
    
    return true;
  } catch (error) {
    log.error('Failed to sync custom emojis', { error: error.message });
    return false;
  }
}

/**
 * Get custom emoji URL by name
 * @param {string} emojiName - Name of the emoji (without colons)
 * @returns {string|null} URL of the emoji or null if not found
 */
function getCustomEmojiUrl(emojiName) {
  return customEmojiCache.get(emojiName) || null;
}

/**
 * Check if an emoji is a custom emoji
 * @param {string} emojiName - Name of the emoji (without colons)
 * @returns {boolean} True if emoji is custom
 */
function isCustomEmoji(emojiName) {
  return customEmojiCache.has(emojiName);
}

/**
 * Get all custom emoji names
 * @returns {Array<string>} Array of custom emoji names
 */
function getCustomEmojiNames() {
  return Array.from(customEmojiCache.keys());
}

/**
 * Get cache statistics
 * @returns {Object} Cache stats including size and last sync time
 */
function getCacheStats() {
  return {
    size: customEmojiCache.size,
    lastSyncTime: lastSyncTime ? new Date(lastSyncTime).toISOString() : null,
    ageMinutes: lastSyncTime ? Math.floor((Date.now() - lastSyncTime) / 60000) : null
  };
}

/**
 * Clear the emoji cache
 */
function clearCache() {
  customEmojiCache.clear();
  lastSyncTime = null;
  log.info('Custom emoji cache cleared');
}

/**
 * Start periodic emoji sync
 * @param {Object} slackClient - Slack API client
 * @param {number} intervalMinutes - Sync interval in minutes (default: 60)
 * @returns {NodeJS.Timeout} Interval timer
 */
function startPeriodicEmojiSync(slackClient, intervalMinutes = 60) {
  log.info('Starting periodic emoji sync', { intervalMinutes });
  
  // Initial sync
  syncCustomEmojis(slackClient);
  
  // Set up periodic sync
  const interval = setInterval(() => {
    syncCustomEmojis(slackClient);
  }, intervalMinutes * 60 * 1000);
  
  return interval;
}

module.exports = {
  fetchSlackCustomEmojis,
  syncCustomEmojis,
  getCustomEmojiUrl,
  isCustomEmoji,
  getCustomEmojiNames,
  getCacheStats,
  clearCache,
  startPeriodicEmojiSync
};
