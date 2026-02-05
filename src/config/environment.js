// src/config/environment.js
require('dotenv').config();
const { createContextLogger } = require('../utils/logger');

const log = createContextLogger('config');

/**
 * Parse and validate channel mappings from environment variables
 * Supports both new JSON format and legacy single channel pair
 */
function parseChannelMappings() {
  let channelMappings = [];
  
  if (process.env.CHANNEL_MAPPINGS) {
    try {
      channelMappings = JSON.parse(process.env.CHANNEL_MAPPINGS);
      if (!Array.isArray(channelMappings)) {
        throw new Error('CHANNEL_MAPPINGS must be an array');
      }
      // Validate each mapping has required fields
      channelMappings.forEach((mapping, index) => {
        if (!mapping.slack || !mapping.mattermost) {
          throw new Error(`Channel mapping at index ${index} must have both 'slack' and 'mattermost' fields`);
        }
      });
      log.info(`Loaded ${channelMappings.length} channel mapping(s) from CHANNEL_MAPPINGS`);
    } catch (err) {
      log.error('Error parsing CHANNEL_MAPPINGS', { error: err.message });
      log.warn('Falling back to legacy single channel configuration');
      channelMappings = [];
    }
  }

  // Fall back to legacy single channel pair if no mappings configured
  if (channelMappings.length === 0) {
    const slackChannelId = process.env.SLACK_CHANNEL_ID;
    const mmChannelId = process.env.MM_CHANNEL_ID;
    if (slackChannelId && mmChannelId) {
      channelMappings = [{ slack: slackChannelId, mattermost: mmChannelId }];
      log.info('Using legacy single channel pair configuration');
    } else {
      log.error('No channel mappings configured');
      log.error('Please set either CHANNEL_MAPPINGS or both SLACK_CHANNEL_ID and MM_CHANNEL_ID');
      log.error('Example CHANNEL_MAPPINGS format: [{"slack":"C0123456789","mattermost":"abcde12345"}]');
      process.exit(1);
    }
  }

  return channelMappings;
}

/**
 * Create lookup maps for efficient channel routing
 */
function createChannelMaps(channelMappings) {
  const slackToMmChannelMap = new Map();
  const mmToSlackChannelMap = new Map();
  
  channelMappings.forEach(mapping => {
    slackToMmChannelMap.set(mapping.slack, mapping.mattermost);
    mmToSlackChannelMap.set(mapping.mattermost, mapping.slack);
  });

  log.info('Channel mappings configured:');
  channelMappings.forEach(mapping => {
    log.info(`Slack ${mapping.slack} <-> Mattermost ${mapping.mattermost}`);
  });

  return { slackToMmChannelMap, mmToSlackChannelMap };
}

const config = {
  slack: {
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    botToken: process.env.SLACK_BOT_TOKEN,
  },
  mattermost: {
    token: process.env.MM_TOKEN,
    url: process.env.MM_URL,
  },
  storage: {
    backend: process.env.STORAGE_BACKEND || 'redis',
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    expiryDays: parseInt(process.env.REDIS_EXPIRY_DAYS || '180', 10),
  },
  workerPool: {
    size: parseInt(process.env.WORKER_POOL_SIZE || '10', 10),
  },
  presence: {
    enabled: process.env.PRESENCE_SYNC_ENABLED === 'true',
    syncIntervalMinutes: parseInt(process.env.PRESENCE_SYNC_INTERVAL_MINUTES || '5', 10),
  },
  emoji: {
    syncEnabled: process.env.CUSTOM_EMOJI_SYNC_ENABLED !== 'false', // Default to true
    syncIntervalMinutes: parseInt(process.env.CUSTOM_EMOJI_SYNC_INTERVAL_MINUTES || '60', 10),
  },
  port: process.env.PORT || 3000,
};

// Parse and setup channel mappings
const channelMappings = parseChannelMappings();
const { slackToMmChannelMap, mmToSlackChannelMap } = createChannelMaps(channelMappings);

module.exports = {
  config,
  channelMappings,
  slackToMmChannelMap,
  mmToSlackChannelMap,
};
