// src/storage/memory-backend.js
const { createContextLogger } = require('../utils/logger');

const log = createContextLogger('memory-storage');

/**
 * In-memory storage backend for development and testing
 * WARNING: All mappings will be lost on restart
 */
class MemoryBackend {
  constructor() {
    this.storage = new Map();
    log.warn('Using in-memory storage - mappings will be lost on restart');
    log.info('Memory storage initialized');
  }

  /**
   * Store a key-value pair
   * @param {string} key - Storage key
   * @param {string} value - Value to store
   * @param {number} expirySeconds - Ignored in memory backend (no expiry)
   */
  async set(key, value, expirySeconds) {
    try {
      this.storage.set(key, value);
    } catch (err) {
      log.error('Error setting value in memory', { error: err.message });
    }
  }

  /**
   * Get a value by key
   * @param {string} key - Storage key
   * @returns {string|null} Value or null if not found
   */
  async get(key) {
    try {
      return this.storage.get(key) || null;
    } catch (err) {
      log.error('Error getting value from memory', { error: err.message });
      return null;
    }
  }

  /**
   * Delete a key
   * @param {string} key - Storage key
   */
  async delete(key) {
    try {
      this.storage.delete(key);
    } catch (err) {
      log.error('Error deleting value from memory', { error: err.message });
    }
  }

  /**
   * Check connection status (always connected for memory)
   * @returns {boolean} Always true
   */
  isConnected() {
    return true;
  }

  /**
   * Close connection (no-op for memory)
   */
  async close() {
    this.storage.clear();
    log.info('Memory storage cleared');
  }
}

module.exports = MemoryBackend;
