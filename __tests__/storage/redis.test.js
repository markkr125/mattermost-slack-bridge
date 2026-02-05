// __tests__/storage/redis.test.js
// Set up environment before importing modules
process.env.CHANNEL_MAPPINGS = '[{"slack":"C12345","mattermost":"mm12345"}]';
process.env.STORAGE_BACKEND = 'memory'; // Use memory backend for tests

const {
  setSlackToMm,
  getSlackToMm,
  setMmToSlack,
  getMmToSlack,
  setReactionMapping,
  getReactionMapping,
} = require('../../src/storage/redis');

describe('Redis Storage (with abstraction)', () => {
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('setSlackToMm', () => {
    test('should store Slack to Mattermost mapping', async () => {
      await setSlackToMm('C12345', '1234567890.123456', 'mm_post_id');
      
      const result = await getSlackToMm('C12345', '1234567890.123456');
      expect(result).toBe('mm_post_id');
    });
  });

  describe('getSlackToMm', () => {
    test('should retrieve Mattermost ID from Slack timestamp', async () => {
      await setSlackToMm('C12345', '1234567890.123456', 'mm_post_id');
      
      const result = await getSlackToMm('C12345', '1234567890.123456');
      expect(result).toBe('mm_post_id');
    });

    test('should return null when key does not exist', async () => {
      const result = await getSlackToMm('C12345', 'non-existent');
      expect(result).toBeNull();
    });
  });

  describe('setMmToSlack', () => {
    test('should store Mattermost to Slack mapping', async () => {
      await setMmToSlack('mm_channel_id', 'mm_post_id', '1234567890.123456');
      
      const result = await getMmToSlack('mm_channel_id', 'mm_post_id');
      expect(result).toBe('1234567890.123456');
    });
  });

  describe('getMmToSlack', () => {
    test('should retrieve Slack timestamp from Mattermost ID', async () => {
      await setMmToSlack('mm_channel_id', 'mm_post_id', '1234567890.123456');
      
      const result = await getMmToSlack('mm_channel_id', 'mm_post_id');
      expect(result).toBe('1234567890.123456');
    });

    test('should return null when key does not exist', async () => {
      const result = await getMmToSlack('mm_channel_id', 'non-existent');
      expect(result).toBeNull();
    });
  });

  describe('reaction mappings', () => {
    test('should store and retrieve Slack reaction mapping', async () => {
      await setReactionMapping('slack', 'C12345', '1234567890.123456', 'mm_post_id');
      
      const result = await getReactionMapping('slack', 'C12345', '1234567890.123456');
      expect(result).toBe('mm_post_id');
    });

    test('should store and retrieve MM reaction mapping', async () => {
      await setReactionMapping('mm', 'mm_channel_id', 'mm_post_id', '1234567890.123456');
      
      const result = await getReactionMapping('mm', 'mm_channel_id', 'mm_post_id');
      expect(result).toBe('mm_channel_id:1234567890.123456');
    });

    test('should return null for non-existent reaction mappings', async () => {
      const result = await getReactionMapping('slack', 'C12345', 'non-existent');
      expect(result).toBeNull();
    });
  });
});
