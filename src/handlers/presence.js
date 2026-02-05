// src/handlers/presence.js
const { createContextLogger } = require('../utils/logger');

const log = createContextLogger('presence');

// Store presence mappings
const presenceCache = {
  slackToMm: new Map(),
  mmToSlack: new Map()
};

// Configuration
let presenceConfig = {
  enabled: false,
  syncIntervalMs: 60000 // 1 minute default
};

/**
 * Initialize presence synchronization
 * @param {Object} config - Presence configuration
 */
function initializePresence(config = {}) {
  presenceConfig.enabled = config.enabled !== false;
  presenceConfig.syncIntervalMs = config.syncIntervalMs || 60000;
  
  log.info('Presence sync initialized', { 
    enabled: presenceConfig.enabled,
    intervalMs: presenceConfig.syncIntervalMs 
  });
}

/**
 * Handle Slack user presence change
 * @param {Object} slackClient - Slack client
 * @param {Object} mmApi - Mattermost API client
 * @param {Object} event - Slack presence_change event
 */
async function handleSlackPresenceChange(slackClient, mmApi, event) {
  if (!presenceConfig.enabled) {
    return;
  }

  const { user, presence } = event;
  
  log.debug('Slack presence change', { user, presence });

  // Map Slack presence to Mattermost status
  const mmStatus = mapSlackPresenceToMm(presence);
  const mmUserId = presenceCache.slackToMm.get(user);

  if (!mmUserId) {
    log.debug('No Mattermost user mapping for Slack user', { slackUser: user });
    return;
  }

  try {
    // Update Mattermost user status
    await mmApi.put(`/users/${mmUserId}/status`, {
      user_id: mmUserId,
      status: mmStatus
    });

    log.info('Updated Mattermost presence from Slack', { 
      slackUser: user,
      mmUser: mmUserId,
      status: mmStatus 
    });
  } catch (error) {
    log.error('Failed to update Mattermost presence', { 
      error: error.message,
      slackUser: user 
    });
  }
}

/**
 * Handle Mattermost user status change
 * @param {Object} slackClient - Slack client
 * @param {Object} event - Mattermost status_change event
 */
async function handleMattermostStatusChange(slackClient, event) {
  if (!presenceConfig.enabled) {
    return;
  }

  const { user_id, status } = event.data;
  
  log.debug('Mattermost status change', { user: user_id, status });

  // Map Mattermost status to Slack presence
  const slackPresence = mapMmStatusToSlack(status);
  const slackUserId = presenceCache.mmToSlack.get(user_id);

  if (!slackUserId) {
    log.debug('No Slack user mapping for Mattermost user', { mmUser: user_id });
    return;
  }

  try {
    // Note: Slack API doesn't allow bots to set user presence
    // This is a limitation - we can only read Slack presence, not set it
    log.debug('Slack API limitation: Cannot set user presence via bot', {
      slackUser: slackUserId,
      desiredPresence: slackPresence
    });
  } catch (error) {
    log.error('Failed to update Slack presence', { 
      error: error.message,
      mmUser: user_id 
    });
  }
}

/**
 * Register user presence mapping
 * @param {string} slackUserId - Slack user ID
 * @param {string} mmUserId - Mattermost user ID
 */
function registerPresenceMapping(slackUserId, mmUserId) {
  presenceCache.slackToMm.set(slackUserId, mmUserId);
  presenceCache.mmToSlack.set(mmUserId, slackUserId);
  
  log.debug('Registered presence mapping', { slackUserId, mmUserId });
}

/**
 * Bulk sync all user presences
 * @param {Object} slackClient - Slack client
 * @param {Object} mmApi - Mattermost API client
 */
async function syncAllPresences(slackClient, mmApi) {
  if (!presenceConfig.enabled) {
    return;
  }

  log.info('Starting bulk presence sync');

  const syncPromises = [];

  for (const [slackUserId, mmUserId] of presenceCache.slackToMm.entries()) {
    syncPromises.push(
      syncSingleUserPresence(slackClient, mmApi, slackUserId, mmUserId)
    );
  }

  try {
    await Promise.allSettled(syncPromises);
    log.info('Bulk presence sync completed', { count: syncPromises.length });
  } catch (error) {
    log.error('Bulk presence sync failed', { error: error.message });
  }
}

/**
 * Sync single user presence from Slack to Mattermost
 * @param {Object} slackClient - Slack client
 * @param {Object} mmApi - Mattermost API client
 * @param {string} slackUserId - Slack user ID
 * @param {string} mmUserId - Mattermost user ID
 */
async function syncSingleUserPresence(slackClient, mmApi, slackUserId, mmUserId) {
  try {
    // Get Slack user presence
    const presenceInfo = await slackClient.users.getPresence({ user: slackUserId });
    const mmStatus = mapSlackPresenceToMm(presenceInfo.presence);

    // Update Mattermost status
    await mmApi.put(`/users/${mmUserId}/status`, {
      user_id: mmUserId,
      status: mmStatus
    });

    log.debug('Synced user presence', { slackUserId, mmUserId, status: mmStatus });
  } catch (error) {
    log.error('Failed to sync user presence', { 
      error: error.message,
      slackUserId,
      mmUserId 
    });
  }
}

/**
 * Map Slack presence to Mattermost status
 * @param {string} slackPresence - Slack presence (active, away)
 * @returns {string} Mattermost status
 */
function mapSlackPresenceToMm(slackPresence) {
  const mapping = {
    'active': 'online',
    'away': 'away'
  };
  
  return mapping[slackPresence] || 'offline';
}

/**
 * Map Mattermost status to Slack presence
 * @param {string} mmStatus - Mattermost status (online, away, dnd, offline)
 * @returns {string} Slack presence
 */
function mapMmStatusToSlack(mmStatus) {
  const mapping = {
    'online': 'active',
    'away': 'away',
    'dnd': 'away',
    'offline': 'away'
  };
  
  return mapping[mmStatus] || 'away';
}

/**
 * Start periodic presence sync
 * @param {Object} slackClient - Slack client
 * @param {Object} mmApi - Mattermost API client
 * @returns {NodeJS.Timeout} Interval timer
 */
function startPeriodicSync(slackClient, mmApi) {
  if (!presenceConfig.enabled) {
    log.info('Presence sync disabled, not starting periodic sync');
    return null;
  }

  log.info('Starting periodic presence sync', { 
    intervalMs: presenceConfig.syncIntervalMs 
  });

  const intervalId = setInterval(() => {
    syncAllPresences(slackClient, mmApi);
  }, presenceConfig.syncIntervalMs);

  // Initial sync
  syncAllPresences(slackClient, mmApi);

  return intervalId;
}

/**
 * Get presence statistics
 * @returns {Object} Presence sync statistics
 */
function getPresenceStats() {
  return {
    enabled: presenceConfig.enabled,
    syncIntervalMs: presenceConfig.syncIntervalMs,
    mappedUsers: presenceCache.slackToMm.size
  };
}

/**
 * Reset presence state (for testing)
 * @private
 */
function resetPresenceState() {
  presenceCache.slackToMm.clear();
  presenceCache.mmToSlack.clear();
  presenceConfig.enabled = false;
  presenceConfig.syncIntervalMs = 60000;
}

module.exports = {
  initializePresence,
  handleSlackPresenceChange,
  handleMattermostStatusChange,
  registerPresenceMapping,
  syncAllPresences,
  startPeriodicSync,
  getPresenceStats,
  resetPresenceState
};
