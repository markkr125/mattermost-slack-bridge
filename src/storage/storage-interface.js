// src/storage/storage-interface.js

/**
 * Storage interface for message and reaction mappings
 * Provides abstraction over Redis and in-memory storage backends
 */

/**
 * Initialize storage backend based on configuration
 * @param {string} backendType - 'redis' or 'memory'
 * @param {Object} config - Backend-specific configuration
 * @returns {Object} Storage backend instance
 */
function initializeStorage(backendType, config) {
  if (backendType === 'memory') {
    const MemoryBackend = require('./memory-backend');
    return new MemoryBackend();
  } else {
    const RedisBackend = require('./redis-backend');
    return new RedisBackend(config);
  }
}

module.exports = {
  initializeStorage,
};
