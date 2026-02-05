// src/storage/redis.js
const Redis = require('ioredis');
const { config } = require('../config/environment');
const { createContextLogger } = require('../utils/logger');

const log = createContextLogger('redis');

/**
 * Initialize Redis client with retry strategy
 */
function initializeRedis() {
  const redis = new Redis(config.redis.url, {
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      log.debug(`Retry attempt ${times}, waiting ${delay}ms`);
      return delay;
    },
    maxRetriesPerRequest: 3
  });

  redis.on('connect', () => {
    log.info('Redis connected successfully');
  });

  redis.on('error', (err) => {
    log.error('Redis error occurred', { error: err.message });
  });

  return redis;
}

const redis = initializeRedis();
const REDIS_EXPIRY_SECONDS = config.redis.expiryDays * 24 * 60 * 60;

/**
 * Store Slack message to Mattermost mapping
 */
async function setSlackToMm(slackChannelId, slackTs, mmId) {
  try {
    await redis.setex(`slack:${slackChannelId}:${slackTs}`, REDIS_EXPIRY_SECONDS, mmId);
  } catch (err) {
    log.error('Error saving slack->mm mapping', { error: err.message });
  }
}

/**
 * Retrieve Mattermost ID from Slack message timestamp
 */
async function getSlackToMm(slackChannelId, slackTs) {
  try {
    return await redis.get(`slack:${slackChannelId}:${slackTs}`);
  } catch (err) {
    log.error('Error reading slack->mm mapping', { error: err.message });
    return null;
  }
}

/**
 * Store Mattermost message to Slack mapping
 */
async function setMmToSlack(mmChannelId, mmId, slackTs) {
  try {
    await redis.setex(`mm:${mmChannelId}:${mmId}`, REDIS_EXPIRY_SECONDS, slackTs);
  } catch (err) {
    log.error('Error saving mm->slack mapping', { error: err.message });
  }
}

/**
 * Retrieve Slack timestamp from Mattermost message ID
 */
async function getMmToSlack(mmChannelId, mmId) {
  try {
    return await redis.get(`mm:${mmChannelId}:${mmId}`);
  } catch (err) {
    log.error('Error reading mm->slack mapping', { error: err.message });
    return null;
  }
}

/**
 * Store reaction mapping for bidirectional reaction sync
 * For Slack->MM: stores mapping from slack channel:ts to MM post ID
 * For MM->Slack: stores mapping from MM post ID to slack channel:ts
 */
async function setReactionMapping(platform, channelId, messageId, targetId) {
  try {
    if (platform === 'slack') {
      // Store slack channel:ts -> MM post ID mapping
      const key = `reaction:slack:${channelId}:${messageId}`;
      await redis.setex(key, REDIS_EXPIRY_SECONDS, targetId);
    } else if (platform === 'mm') {
      // Store MM post ID -> slack channel:ts mapping
      const key = `reaction:mm:${messageId}`;
      await redis.setex(key, REDIS_EXPIRY_SECONDS, `${channelId}:${targetId}`);
    }
  } catch (err) {
    log.error('Error saving reaction mapping', { error: err.message });
  }
}

/**
 * Get reaction mapping for sync
 */
async function getReactionMapping(platform, channelId, messageId) {
  try {
    if (platform === 'slack') {
      const key = `reaction:slack:${channelId}:${messageId}`;
      return await redis.get(key);
    } else if (platform === 'mm') {
      const key = `reaction:mm:${messageId}`;
      return await redis.get(key);
    }
    return null;
  } catch (err) {
    log.error('Error retrieving reaction mapping', { error: err.message });
    return null;
  }
}

module.exports = {
  redis,
  setSlackToMm,
  getSlackToMm,
  setMmToSlack,
  getMmToSlack,
  setReactionMapping,
  getReactionMapping,
};
