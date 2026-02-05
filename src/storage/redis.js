// src/storage/redis.js
const { config } = require('../config/environment');
const { initializeStorage } = require('./storage-interface');

// Initialize storage backend based on configuration
const storageBackend = initializeStorage(config.storage.backend, config.storage);
const EXPIRY_SECONDS = config.storage.expiryDays * 24 * 60 * 60;

/**
 * Store Slack message to Mattermost mapping
 */
async function setSlackToMm(slackChannelId, slackTs, mmId) {
  await storageBackend.set(`slack:${slackChannelId}:${slackTs}`, mmId, EXPIRY_SECONDS);
}

/**
 * Retrieve Mattermost ID from Slack message timestamp
 */
async function getSlackToMm(slackChannelId, slackTs) {
  return await storageBackend.get(`slack:${slackChannelId}:${slackTs}`);
}

/**
 * Store Mattermost message to Slack mapping
 */
async function setMmToSlack(mmChannelId, mmId, slackTs) {
  await storageBackend.set(`mm:${mmChannelId}:${mmId}`, slackTs, EXPIRY_SECONDS);
}

/**
 * Retrieve Slack timestamp from Mattermost message ID
 */
async function getMmToSlack(mmChannelId, mmId) {
  return await storageBackend.get(`mm:${mmChannelId}:${mmId}`);
}

/**
 * Store reaction mapping for bidirectional reaction sync
 * For Slack->MM: stores mapping from slack channel:ts to MM post ID
 * For MM->Slack: stores mapping from MM post ID to slack channel:ts
 */
async function setReactionMapping(platform, channelId, messageId, targetId) {
  if (platform === 'slack') {
    // Store slack channel:ts -> MM post ID mapping
    const key = `reaction:slack:${channelId}:${messageId}`;
    await storageBackend.set(key, targetId, EXPIRY_SECONDS);
  } else if (platform === 'mm') {
    // Store MM post ID -> slack channel:ts mapping
    const key = `reaction:mm:${messageId}`;
    await storageBackend.set(key, `${channelId}:${targetId}`, EXPIRY_SECONDS);
  }
}

/**
 * Get reaction mapping for sync
 */
async function getReactionMapping(platform, channelId, messageId) {
  if (platform === 'slack') {
    const key = `reaction:slack:${channelId}:${messageId}`;
    return await storageBackend.get(key);
  } else if (platform === 'mm') {
    const key = `reaction:mm:${messageId}`;
    return await storageBackend.get(key);
  }
  return null;
}

module.exports = {
  storageBackend,
  setSlackToMm,
  getSlackToMm,
  setMmToSlack,
  getMmToSlack,
  setReactionMapping,
  getReactionMapping,
};
