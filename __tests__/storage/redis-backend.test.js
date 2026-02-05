// __tests__/storage/redis-backend.test.js

// Create mock Redis instance
const mockRedisInstance = {
  setex: jest.fn().mockResolvedValue('OK'),
  get: jest.fn().mockResolvedValue(null),
  del: jest.fn().mockResolvedValue(1),
  quit: jest.fn().mockResolvedValue('OK'),
  on: jest.fn(),
  status: 'ready',
};

jest.mock('ioredis', () => {
  return jest.fn(() => mockRedisInstance);
});

const RedisBackend = require('../../src/storage/redis-backend');

describe('RedisBackend', () => {
  let backend;
  const config = {
    url: 'redis://localhost:6379',
    expiryDays: 180,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    backend = new RedisBackend(config);
  });

  afterEach(async () => {
    await backend.close();
  });

  describe('set', () => {
    test('should store values with default expiry', async () => {
      mockRedisInstance.setex.mockResolvedValue('OK');
      
      await backend.set('test-key', 'test-value');
      
      expect(mockRedisInstance.setex).toHaveBeenCalledWith(
        'test-key',
        180 * 24 * 60 * 60, // default expiry
        'test-value'
      );
    });

    test('should store values with custom expiry', async () => {
      mockRedisInstance.setex.mockResolvedValue('OK');
      
      await backend.set('test-key', 'test-value', 3600);
      
      expect(mockRedisInstance.setex).toHaveBeenCalledWith(
        'test-key',
        3600,
        'test-value'
      );
    });

    test('should handle errors gracefully', async () => {
      mockRedisInstance.setex.mockRejectedValue(new Error('Redis error'));
      
      await expect(backend.set('test-key', 'test-value')).resolves.not.toThrow();
    });
  });

  describe('get', () => {
    test('should retrieve values', async () => {
      mockRedisInstance.get.mockResolvedValue('test-value');
      
      const result = await backend.get('test-key');
      
      expect(result).toBe('test-value');
      expect(mockRedisInstance.get).toHaveBeenCalledWith('test-key');
    });

    test('should return null for non-existent keys', async () => {
      mockRedisInstance.get.mockResolvedValue(null);
      
      const result = await backend.get('non-existent-key');
      
      expect(result).toBeNull();
    });

    test('should handle errors gracefully', async () => {
      mockRedisInstance.get.mockRejectedValue(new Error('Redis error'));
      
      const result = await backend.get('test-key');
      
      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    test('should delete keys', async () => {
      mockRedisInstance.del.mockResolvedValue(1);
      
      await backend.delete('test-key');
      
      expect(mockRedisInstance.del).toHaveBeenCalledWith('test-key');
    });

    test('should handle errors gracefully', async () => {
      mockRedisInstance.del.mockRejectedValue(new Error('Redis error'));
      
      await expect(backend.delete('test-key')).resolves.not.toThrow();
    });
  });

  describe('isConnected', () => {
    test('should return true when Redis is ready', () => {
      mockRedisInstance.status = 'ready';
      expect(backend.isConnected()).toBe(true);
    });

    test('should return false when Redis is not ready', () => {
      mockRedisInstance.status = 'connecting';
      expect(backend.isConnected()).toBe(false);
    });
  });

  describe('close', () => {
    test('should close Redis connection', async () => {
      mockRedisInstance.quit.mockResolvedValue('OK');
      
      await backend.close();
      
      expect(mockRedisInstance.quit).toHaveBeenCalled();
    });
  });
});
