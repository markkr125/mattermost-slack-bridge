// src/storage/redis.js
const Redis = require('ioredis');
const { config } = require('../config/environment');

/**
 * Initialize Redis client with retry strategy
 */
function initializeRedis() {
  const redis = new Redis(config.redis.url, {
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
    console.error('Error saving to Redis (slack->mm):', err.message);
  }
}

/**
 * Retrieve Mattermost ID from Slack message timestamp
 */
async function getSlackToMm(slackChannelId, slackTs) {
  try {
    return await redis.get(`slack:${slackChannelId}:${slackTs}`);
  } catch (err) {
    console.error('Error reading from Redis (slack->mm):', err.message);
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
    console.error('Error saving to Redis (mm->slack):', err.message);
  }
}

/**
 * Retrieve Slack timestamp from Mattermost message ID
 */
async function getMmToSlack(mmChannelId, mmId) {
  try {
    return await redis.get(`mm:${mmChannelId}:${mmId}`);
  } catch (err) {
    console.error('Error reading from Redis (mm->slack):', err.message);
    return null;
  }
}

module.exports = {
  redis,
  setSlackToMm,
  getSlackToMm,
  setMmToSlack,
  getMmToSlack,
};
