// __tests__/utils/emoji-sync.test.js
jest.mock('../../src/utils/logger', () => ({
  createContextLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  })
}));

const {
  fetchSlackCustomEmojis,
  syncCustomEmojis,
  getCustomEmojiUrl,
  isCustomEmoji,
  getCustomEmojiNames,
  getCacheStats,
  clearCache,
  startPeriodicEmojiSync
} = require('../../src/utils/emoji-sync');

describe('emoji-sync', () => {
  let mockSlackClient;

  beforeEach(() => {
    clearCache();
    mockSlackClient = {
      emoji: {
        list: jest.fn()
      }
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchSlackCustomEmojis', () => {
    test('should fetch custom emojis successfully', async () => {
      mockSlackClient.emoji.list.mockResolvedValue({
        ok: true,
        emoji: {
          'custom1': 'https://example.com/emoji1.png',
          'custom2': 'https://example.com/emoji2.png',
          'alias1': 'alias:custom1'
        }
      });

      const result = await fetchSlackCustomEmojis(mockSlackClient);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(2);
      expect(result.get('custom1')).toBe('https://example.com/emoji1.png');
      expect(result.get('custom2')).toBe('https://example.com/emoji2.png');
      expect(result.has('alias1')).toBe(false);
    });

    test('should handle Slack API error', async () => {
      mockSlackClient.emoji.list.mockResolvedValue({
        ok: false,
        error: 'invalid_auth'
      });

      const result = await fetchSlackCustomEmojis(mockSlackClient);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    test('should handle exception during fetch', async () => {
      mockSlackClient.emoji.list.mockRejectedValue(new Error('Network error'));

      const result = await fetchSlackCustomEmojis(mockSlackClient);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    test('should handle empty emoji list', async () => {
      mockSlackClient.emoji.list.mockResolvedValue({
        ok: true,
        emoji: {}
      });

      const result = await fetchSlackCustomEmojis(mockSlackClient);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });
  });

  describe('syncCustomEmojis', () => {
    test('should sync emojis to cache', async () => {
      mockSlackClient.emoji.list.mockResolvedValue({
        ok: true,
        emoji: {
          'party': 'https://example.com/party.gif',
          'rocket': 'https://example.com/rocket.png'
        }
      });

      const result = await syncCustomEmojis(mockSlackClient);

      expect(result).toBe(true);
      expect(getCustomEmojiNames()).toContain('party');
      expect(getCustomEmojiNames()).toContain('rocket');
    });

    test('should return false on sync failure', async () => {
      // First populate cache with some emojis
      mockSlackClient.emoji.list.mockResolvedValueOnce({
        ok: true,
        emoji: { 'existing': 'url' }
      });
      await syncCustomEmojis(mockSlackClient);
      expect(getCustomEmojiNames()).toContain('existing');
      
      // Now simulate a failure that returns empty result
      mockSlackClient.emoji.list.mockResolvedValueOnce({
        ok: false,
        error: 'invalid_auth'
      });

      const result = await syncCustomEmojis(mockSlackClient);

      expect(result).toBe(false);
      // Cache should still have the old emoji
      expect(getCustomEmojiNames()).toContain('existing');
    });

    test('should update lastSyncTime', async () => {
      mockSlackClient.emoji.list.mockResolvedValue({
        ok: true,
        emoji: { 'test': 'https://example.com/test.png' }
      });

      await syncCustomEmojis(mockSlackClient);

      const stats = getCacheStats();
      expect(stats.lastSyncTime).not.toBeNull();
      expect(stats.ageMinutes).toBe(0);
    });
  });

  describe('getCustomEmojiUrl', () => {
    beforeEach(async () => {
      mockSlackClient.emoji.list.mockResolvedValue({
        ok: true,
        emoji: {
          'parrot': 'https://example.com/parrot.gif'
        }
      });
      await syncCustomEmojis(mockSlackClient);
    });

    test('should return URL for existing emoji', () => {
      const url = getCustomEmojiUrl('parrot');
      expect(url).toBe('https://example.com/parrot.gif');
    });

    test('should return null for non-existing emoji', () => {
      const url = getCustomEmojiUrl('nonexistent');
      expect(url).toBeNull();
    });
  });

  describe('isCustomEmoji', () => {
    beforeEach(async () => {
      mockSlackClient.emoji.list.mockResolvedValue({
        ok: true,
        emoji: {
          'thumbsup': 'https://example.com/thumbsup.png'
        }
      });
      await syncCustomEmojis(mockSlackClient);
    });

    test('should return true for custom emoji', () => {
      expect(isCustomEmoji('thumbsup')).toBe(true);
    });

    test('should return false for non-custom emoji', () => {
      expect(isCustomEmoji('smile')).toBe(false);
    });
  });

  describe('getCustomEmojiNames', () => {
    test('should return empty array when cache is empty', () => {
      expect(getCustomEmojiNames()).toEqual([]);
    });

    test('should return all emoji names', async () => {
      mockSlackClient.emoji.list.mockResolvedValue({
        ok: true,
        emoji: {
          'emoji1': 'url1',
          'emoji2': 'url2',
          'emoji3': 'url3'
        }
      });
      await syncCustomEmojis(mockSlackClient);

      const names = getCustomEmojiNames();
      expect(names).toHaveLength(3);
      expect(names).toContain('emoji1');
      expect(names).toContain('emoji2');
      expect(names).toContain('emoji3');
    });
  });

  describe('getCacheStats', () => {
    test('should return stats with null lastSyncTime initially', () => {
      const stats = getCacheStats();
      expect(stats.size).toBe(0);
      expect(stats.lastSyncTime).toBeNull();
      expect(stats.ageMinutes).toBeNull();
    });

    test('should return stats after sync', async () => {
      mockSlackClient.emoji.list.mockResolvedValue({
        ok: true,
        emoji: {
          'test1': 'url1',
          'test2': 'url2'
        }
      });
      await syncCustomEmojis(mockSlackClient);

      const stats = getCacheStats();
      expect(stats.size).toBe(2);
      expect(stats.lastSyncTime).not.toBeNull();
      expect(typeof stats.ageMinutes).toBe('number');
    });
  });

  describe('clearCache', () => {
    test('should clear the emoji cache', async () => {
      mockSlackClient.emoji.list.mockResolvedValue({
        ok: true,
        emoji: { 'test': 'url' }
      });
      await syncCustomEmojis(mockSlackClient);
      expect(getCacheStats().size).toBe(1);

      clearCache();

      const stats = getCacheStats();
      expect(stats.size).toBe(0);
      expect(stats.lastSyncTime).toBeNull();
    });
  });

  describe('startPeriodicEmojiSync', () => {
    test('should start periodic sync and perform initial sync', async () => {
      mockSlackClient.emoji.list.mockResolvedValue({
        ok: true,
        emoji: { 'periodic': 'url' }
      });

      const interval = startPeriodicEmojiSync(mockSlackClient, 1);

      // Wait for initial sync to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockSlackClient.emoji.list).toHaveBeenCalled();
      expect(getCustomEmojiNames()).toContain('periodic');

      clearInterval(interval);
    });

    test('should use default interval of 60 minutes', async () => {
      mockSlackClient.emoji.list.mockResolvedValue({
        ok: true,
        emoji: {}
      });

      const interval = startPeriodicEmojiSync(mockSlackClient);

      expect(interval).toBeDefined();
      clearInterval(interval);
    });
  });
});
