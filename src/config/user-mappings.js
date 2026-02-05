// src/config/user-mappings.js
const { createContextLogger } = require('../utils/logger');

const log = createContextLogger('user-mappings');

/**
 * Parse user mappings from environment variables
 * Supports mapping user IDs between Slack and Mattermost for custom display names/avatars
 */
function parseUserMappings() {
  let userMappings = {
    slackToMattermost: new Map(),
    mattermostToSlack: new Map(),
  };

  // Parse SLACK_USER_MAPPINGS
  // Format: {"U12345":{"mm_user_id":"abc123","display_name":"John Doe","avatar_url":"https://..."}}
  if (process.env.SLACK_USER_MAPPINGS) {
    try {
      const slackMappings = JSON.parse(process.env.SLACK_USER_MAPPINGS);
      for (const [slackUserId, mapping] of Object.entries(slackMappings)) {
        userMappings.slackToMattermost.set(slackUserId, {
          mmUserId: mapping.mm_user_id,
          displayName: mapping.display_name,
          avatarUrl: mapping.avatar_url,
        });
      }
      log.info(`Loaded ${userMappings.slackToMattermost.size} Slack user mapping(s)`);
    } catch (err) {
      log.error('Error parsing SLACK_USER_MAPPINGS', { error: err.message });
    }
  }

  // Parse MM_USER_MAPPINGS
  // Format: {"abc123":{"slack_user_id":"U12345","display_name":"John Doe","avatar_url":"https://..."}}
  if (process.env.MM_USER_MAPPINGS) {
    try {
      const mmMappings = JSON.parse(process.env.MM_USER_MAPPINGS);
      for (const [mmUserId, mapping] of Object.entries(mmMappings)) {
        userMappings.mattermostToSlack.set(mmUserId, {
          slackUserId: mapping.slack_user_id,
          displayName: mapping.display_name,
          avatarUrl: mapping.avatar_url,
        });
      }
      log.info(`Loaded ${userMappings.mattermostToSlack.size} Mattermost user mapping(s)`);
    } catch (err) {
      log.error('Error parsing MM_USER_MAPPINGS', { error: err.message });
    }
  }

  return userMappings;
}

const userMappings = parseUserMappings();

/**
 * Get mapped user info for a Slack user
 * @param {string} slackUserId - Slack user ID
 * @returns {Object|null} Mapped user info or null if not mapped
 */
function getSlackUserMapping(slackUserId) {
  return userMappings.slackToMattermost.get(slackUserId) || null;
}

/**
 * Get mapped user info for a Mattermost user
 * @param {string} mmUserId - Mattermost user ID
 * @returns {Object|null} Mapped user info or null if not mapped
 */
function getMattermostUserMapping(mmUserId) {
  return userMappings.mattermostToSlack.get(mmUserId) || null;
}

module.exports = {
  userMappings,
  getSlackUserMapping,
  getMattermostUserMapping,
  parseUserMappings,
};
