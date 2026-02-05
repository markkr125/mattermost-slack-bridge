// src/storage/redis-backend.js
const Redis = require('ioredis');
const { createContextLogger } = require('../utils/logger');

const log = createContextLogger('redis');

/**
 * Redis storage backend for production use
 */
class RedisBackend {
  constructor(config) {
    this.expirySeconds = config.expiryDays * 24 * 60 * 60;
    this.redis = this.initializeRedis(config.url);
  }

  /**
   * Initialize Redis client with retry strategy
   */
  initializeRedis(url) {
    const redis = new Redis(url, {
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

  /**
   * Store a key-value pair with expiry
   * @param {string} key - Storage key
   * @param {string} value - Value to store
   * @param {number} expirySeconds - Expiry time in seconds (optional, uses default if not provided)
   */
  async set(key, value, expirySeconds = null) {
    try {
      const expiry = expirySeconds || this.expirySeconds;
      await this.redis.setex(key, expiry, value);
    } catch (err) {
      log.error('Error setting value in Redis', { error: err.message });
    }
  }

  /**
   * Get a value by key
   * @param {string} key - Storage key
   * @returns {string|null} Value or null if not found
   */
  async get(key) {
    try {
      return await this.redis.get(key);
    } catch (err) {
      log.error('Error getting value from Redis', { error: err.message });
      return null;
    }
  }

  /**
   * Delete a key
   * @param {string} key - Storage key
   */
  async delete(key) {
    try {
      await this.redis.del(key);
    } catch (err) {
      log.error('Error deleting value from Redis', { error: err.message });
    }
  }

  /**
   * Check if Redis is connected
   * @returns {boolean} Connection status
   */
  isConnected() {
    return this.redis.status === 'ready';
  }

  /**
   * Close Redis connection
   */
  async close() {
    await this.redis.quit();
    log.info('Redis connection closed');
  }
}

module.exports = RedisBackend;
