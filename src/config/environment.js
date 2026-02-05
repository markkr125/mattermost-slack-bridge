// src/config/environment.js
require('dotenv').config();

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
      console.log(`Loaded ${channelMappings.length} channel ${channelMappings.length === 1 ? 'mapping' : 'mappings'} from CHANNEL_MAPPINGS`);
    } catch (err) {
      console.error('Error parsing CHANNEL_MAPPINGS:', err.message);
      console.error('Falling back to legacy single channel configuration');
      channelMappings = [];
    }
  }

  // Fall back to legacy single channel pair if no mappings configured
  if (channelMappings.length === 0) {
    const slackChannelId = process.env.SLACK_CHANNEL_ID;
    const mmChannelId = process.env.MM_CHANNEL_ID;
    if (slackChannelId && mmChannelId) {
      channelMappings = [{ slack: slackChannelId, mattermost: mmChannelId }];
      console.log('Using legacy single channel pair configuration');
    } else {
      console.error('No channel mappings configured. Please set either CHANNEL_MAPPINGS or both SLACK_CHANNEL_ID and MM_CHANNEL_ID');
      console.error('Example CHANNEL_MAPPINGS format: [{"slack":"C0123456789","mattermost":"abcde12345"}]');
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

  console.log('Channel mappings configured:');
  channelMappings.forEach(mapping => {
    console.log(`  Slack ${mapping.slack} <-> Mattermost ${mapping.mattermost}`);
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
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    expiryDays: parseInt(process.env.REDIS_EXPIRY_DAYS || '180', 10),
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
