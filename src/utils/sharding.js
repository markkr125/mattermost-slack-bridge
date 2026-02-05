// src/utils/sharding.js
// Optional sharding support for distributed deployments
const { createContextLogger } = require('./logger');
const crypto = require('crypto');

const log = createContextLogger('sharding');

let shardConfig = {
  enabled: false,
  shardId: 0,
  totalShards: 1,
  channelAssignments: new Map()
};

/**
 * Initialize sharding configuration
 * @param {Object} options - Sharding configuration
 * @param {boolean} options.enabled - Whether sharding is enabled
 * @param {number} options.shardId - Current shard ID (0-based)
 * @param {number} options.totalShards - Total number of shards
 */
function initializeSharding(options = {}) {
  shardConfig.enabled = options.enabled || false;
  shardConfig.shardId = options.shardId !== undefined ? options.shardId : 0;
  shardConfig.totalShards = options.totalShards !== undefined ? options.totalShards : 1;
  shardConfig.channelAssignments = new Map();
  
  if (shardConfig.enabled) {
    log.info('Sharding initialized', {
      shardId: shardConfig.shardId,
      totalShards: shardConfig.totalShards
    });
    
    // Validate shard configuration
    if (shardConfig.totalShards < 1) {
      throw new Error(`Invalid total shards: ${shardConfig.totalShards} (must be >= 1)`);
    }
    
    if (shardConfig.shardId >= shardConfig.totalShards) {
      throw new Error(`Invalid shard ID: ${shardConfig.shardId} (must be < ${shardConfig.totalShards})`);
    }
  } else {
    log.info('Sharding disabled');
  }
}

/**
 * Calculate which shard a channel belongs to using consistent hashing
 * @param {string} channelId - Channel ID (Slack or Mattermost)
 * @returns {number} Shard ID (0-based)
 */
function getChannelShard(channelId) {
  if (!shardConfig.enabled) {
    return 0;
  }
  
  // Use MD5 hash for consistent distribution
  const hash = crypto.createHash('md5').update(channelId).digest();
  // Take first 4 bytes as an integer
  const hashInt = hash.readUInt32BE(0);
  // Modulo to get shard assignment
  return hashInt % shardConfig.totalShards;
}

/**
 * Check if this shard should handle a given channel
 * @param {string} channelId - Channel ID to check
 * @returns {boolean} True if this shard should handle the channel
 */
function shouldHandleChannel(channelId) {
  if (!shardConfig.enabled) {
    return true;
  }
  
  const assignedShard = getChannelShard(channelId);
  const shouldHandle = assignedShard === shardConfig.shardId;
  
  if (!shouldHandle) {
    log.debug('Channel assigned to different shard', {
      channelId,
      assignedShard,
      currentShard: shardConfig.shardId
    });
  }
  
  return shouldHandle;
}

/**
 * Filter channel mappings for this shard
 * @param {Array} channelMappings - All channel mappings
 * @returns {Array} Filtered channel mappings for this shard
 */
function filterChannelMappingsForShard(channelMappings) {
  if (!shardConfig.enabled) {
    return channelMappings;
  }
  
  const filtered = channelMappings.filter(mapping => {
    // Use Slack channel ID as the primary key for sharding
    return shouldHandleChannel(mapping.slack);
  });
  
  log.info('Filtered channel mappings for shard', {
    totalMappings: channelMappings.length,
    shardMappings: filtered.length,
    shardId: shardConfig.shardId,
    totalShards: shardConfig.totalShards
  });
  
  return filtered;
}

/**
 * Get current shard configuration
 * @returns {Object} Current shard config
 */
function getShardConfig() {
  return {
    enabled: shardConfig.enabled,
    shardId: shardConfig.shardId,
    totalShards: shardConfig.totalShards
  };
}

/**
 * Get shard health status
 * @returns {Object} Shard health information
 */
function getShardHealth() {
  return {
    shardId: shardConfig.shardId,
    totalShards: shardConfig.totalShards,
    enabled: shardConfig.enabled,
    channelsHandled: shardConfig.channelAssignments.size,
    status: 'healthy'
  };
}

/**
 * Register a channel assignment for monitoring
 * @param {string} channelId - Channel ID
 */
function registerChannelAssignment(channelId) {
  if (shardConfig.enabled) {
    shardConfig.channelAssignments.set(channelId, {
      registeredAt: Date.now(),
      shard: shardConfig.shardId
    });
  }
}

/**
 * Get all channel assignments for this shard
 * @returns {Array} Array of channel IDs
 */
function getChannelAssignments() {
  return Array.from(shardConfig.channelAssignments.keys());
}

module.exports = {
  initializeSharding,
  getChannelShard,
  shouldHandleChannel,
  filterChannelMappingsForShard,
  getShardConfig,
  getShardHealth,
  registerChannelAssignment,
  getChannelAssignments
};
