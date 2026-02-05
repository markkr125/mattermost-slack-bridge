// __tests__/storage/redis.test.js
// Set up environment before importing modules
process.env.CHANNEL_MAPPINGS = '[{"slack":"C12345","mattermost":"mm12345"}]';
process.env.REDIS_URL = 'redis://localhost:6379';

// Create mock Redis instance
const mockRedisInstance = {
  setex: jest.fn().mockResolvedValue('OK'),
  get: jest.fn().mockResolvedValue(null),
  on: jest.fn(),
};

jest.mock('ioredis', () => {
  return jest.fn(() => mockRedisInstance);
});

const {
  setSlackToMm,
  getSlackToMm,
  setMmToSlack,
  getMmToSlack,
} = require('../../src/storage/redis');

describe('Redis Storage', () => {
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('setSlackToMm', () => {
    test('should store Slack to Mattermost mapping', async () => {
      mockRedisInstance.setex.mockResolvedValue('OK');
      
      await setSlackToMm('C12345', '1234567890.123456', 'mm_post_id');
      
      expect(mockRedisInstance.setex).toHaveBeenCalledWith(
        'slack:C12345:1234567890.123456',
        expect.any(Number),
        'mm_post_id'
      );
    });

    test('should handle Redis errors gracefully', async () => {
      mockRedisInstance.setex.mockRejectedValue(new Error('Redis error'));
      
      // Should not throw
      await expect(setSlackToMm('C12345', '1234567890.123456', 'mm_post_id')).resolves.not.toThrow();
    });
  });

  describe('getSlackToMm', () => {
    test('should retrieve Mattermost ID from Slack timestamp', async () => {
      mockRedisInstance.get.mockResolvedValue('mm_post_id');
      
      const result = await getSlackToMm('C12345', '1234567890.123456');
      
      expect(result).toBe('mm_post_id');
      expect(mockRedisInstance.get).toHaveBeenCalledWith('slack:C12345:1234567890.123456');
    });

    test('should return null when key does not exist', async () => {
      mockRedisInstance.get.mockResolvedValue(null);
      
      const result = await getSlackToMm('C12345', '1234567890.123456');
      
      expect(result).toBeNull();
    });

    test('should handle Redis errors gracefully', async () => {
      mockRedisInstance.get.mockRejectedValue(new Error('Redis error'));
      
      const result = await getSlackToMm('C12345', '1234567890.123456');
      
      expect(result).toBeNull();
    });
  });

  describe('setMmToSlack', () => {
    test('should store Mattermost to Slack mapping', async () => {
      mockRedisInstance.setex.mockResolvedValue('OK');
      
      await setMmToSlack('mm_channel_id', 'mm_post_id', '1234567890.123456');
      
      expect(mockRedisInstance.setex).toHaveBeenCalledWith(
        'mm:mm_channel_id:mm_post_id',
        expect.any(Number),
        '1234567890.123456'
      );
    });

    test('should handle Redis errors gracefully', async () => {
      mockRedisInstance.setex.mockRejectedValue(new Error('Redis error'));
      
      // Should not throw
      await expect(setMmToSlack('mm_channel_id', 'mm_post_id', '1234567890.123456')).resolves.not.toThrow();
    });
  });

  describe('getMmToSlack', () => {
    test('should retrieve Slack timestamp from Mattermost ID', async () => {
      mockRedisInstance.get.mockResolvedValue('1234567890.123456');
      
      const result = await getMmToSlack('mm_channel_id', 'mm_post_id');
      
      expect(result).toBe('1234567890.123456');
      expect(mockRedisInstance.get).toHaveBeenCalledWith('mm:mm_channel_id:mm_post_id');
    });

    test('should return null when key does not exist', async () => {
      mockRedisInstance.get.mockResolvedValue(null);
      
      const result = await getMmToSlack('mm_channel_id', 'mm_post_id');
      
      expect(result).toBeNull();
    });

    test('should handle Redis errors gracefully', async () => {
      mockRedisInstance.get.mockRejectedValue(new Error('Redis error'));
      
      const result = await getMmToSlack('mm_channel_id', 'mm_post_id');
      
      expect(result).toBeNull();
    });
  });
});
