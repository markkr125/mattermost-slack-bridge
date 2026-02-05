// __tests__/handlers/reactions.test.js
process.env.CHANNEL_MAPPINGS = '[{"slack":"C12345","mattermost":"mm12345"}]';
process.env.REDIS_URL = 'redis://localhost:6379';

jest.mock('../../src/utils/logger', () => ({
  createContextLogger: () => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  })
}));
jest.mock('../../src/storage/redis');
jest.mock('ioredis');

const {
  setSlackReactionBotId,
  setMmReactionBotId,
  handleSlackReactionAdd,
  handleSlackReactionRemove,
  handleMmReactionAdd,
  handleMmReactionRemove
} = require('../../src/handlers/reactions');

const { setReactionMapping, getReactionMapping } = require('../../src/storage/redis');

describe('Reactions Handler', () => {
  describe('Bot ID Management', () => {
    test('should configure Slack reaction bot ID', () => {
      expect(() => setSlackReactionBotId('U_SLACK_BOT')).not.toThrow();
    });

    test('should configure MM reaction bot ID', () => {
      expect(() => setMmReactionBotId('mm_bot_123')).not.toThrow();
    });
  });

  describe('handleSlackReactionAdd', () => {
    let mockSlackClient;
    let mockMmApi;

    beforeEach(() => {
      jest.clearAllMocks();
      setSlackReactionBotId('U_BOT');
      
      mockSlackClient = {};
      mockMmApi = {
        post: jest.fn().mockResolvedValue({ data: { id: 'reaction_123' } })
      };

      getReactionMapping.mockResolvedValue('mm_post_456');
    });

    test('should ignore reaction from bot itself', async () => {
      const eventData = {
        reaction: 'thumbsup',
        item: { type: 'message', channel: 'C12345', ts: '123.456' },
        user: 'U_BOT'
      };

      await handleSlackReactionAdd(mockSlackClient, mockMmApi, eventData);

      expect(mockMmApi.post).not.toHaveBeenCalled();
    });

    test('should ignore non-message items', async () => {
      const eventData = {
        reaction: 'star',
        item: { type: 'file', channel: 'C12345', ts: '123.456' },
        user: 'U123'
      };

      await handleSlackReactionAdd(mockSlackClient, mockMmApi, eventData);

      expect(mockMmApi.post).not.toHaveBeenCalled();
    });

    test('should sync Slack reaction to Mattermost', async () => {
      const eventData = {
        reaction: '+1',
        item: { type: 'message', channel: 'C12345', ts: '123.456' },
        user: 'U123'
      };

      await handleSlackReactionAdd(mockSlackClient, mockMmApi, eventData);

      expect(getReactionMapping).toHaveBeenCalledWith('slack', 'C12345', '123.456');
      expect(mockMmApi.post).toHaveBeenCalledWith('/reactions', expect.objectContaining({
        post_id: 'mm_post_456',
        emoji_name: 'thumbsup'  // Translated from +1
      }));
    });

    test('should handle missing MM post mapping gracefully', async () => {
      getReactionMapping.mockResolvedValue(null);

      const eventData = {
        reaction: 'smile',
        item: { type: 'message', channel: 'C12345', ts: '123.456' },
        user: 'U123'
      };

      await handleSlackReactionAdd(mockSlackClient, mockMmApi, eventData);

      expect(mockMmApi.post).not.toHaveBeenCalled();
    });
  });

  describe('handleSlackReactionRemove', () => {
    let mockSlackClient;
    let mockMmApi;

    beforeEach(() => {
      jest.clearAllMocks();
      setSlackReactionBotId('U_BOT');
      
      mockSlackClient = {};
      mockMmApi = {
        delete: jest.fn().mockResolvedValue({})
      };

      getReactionMapping.mockResolvedValue('mm_post_789');
    });

    test('should remove reaction from Mattermost', async () => {
      setMmReactionBotId('mm_bot_id');

      const eventData = {
        reaction: '-1',
        item: { type: 'message', channel: 'C12345', ts: '123.456' },
        user: 'U123'
      };

      await handleSlackReactionRemove(mockSlackClient, mockMmApi, eventData);

      expect(mockMmApi.delete).toHaveBeenCalledWith(
        '/users/mm_bot_id/posts/mm_post_789/reactions/thumbsdown'
      );
    });
  });

  describe('handleMmReactionAdd', () => {
    let mockSlackClient;

    beforeEach(() => {
      jest.clearAllMocks();
      setMmReactionBotId('mm_bot_id');
      
      mockSlackClient = {
        reactions: {
          add: jest.fn().mockResolvedValue({})
        }
      };

      getReactionMapping.mockResolvedValue('C12345:123.456');
    });

    test('should ignore reaction from MM bot', async () => {
      const reactionData = {
        emoji_name: 'heart',
        post_id: 'mm_post_123',
        user_id: 'mm_bot_id'
      };

      await handleMmReactionAdd(mockSlackClient, reactionData);

      expect(mockSlackClient.reactions.add).not.toHaveBeenCalled();
    });

    test('should sync MM reaction to Slack', async () => {
      const reactionData = {
        emoji_name: 'thumbsup',
        post_id: 'mm_post_123',
        user_id: 'mm_user_456'
      };

      await handleMmReactionAdd(mockSlackClient, reactionData);

      expect(mockSlackClient.reactions.add).toHaveBeenCalledWith({
        channel: 'C12345',
        timestamp: '123.456',
        name: '+1'  // Translated from thumbsup
      });
    });
  });

  describe('handleMmReactionRemove', () => {
    let mockSlackClient;

    beforeEach(() => {
      jest.clearAllMocks();
      setMmReactionBotId('mm_bot_id');
      
      mockSlackClient = {
        reactions: {
          remove: jest.fn().mockResolvedValue({})
        }
      };

      getReactionMapping.mockResolvedValue('C67890:789.012');
    });

    test('should remove MM reaction from Slack', async () => {
      const reactionData = {
        emoji_name: 'tada',
        post_id: 'mm_post_999',
        user_id: 'mm_user_789'
      };

      await handleMmReactionRemove(mockSlackClient, reactionData);

      expect(mockSlackClient.reactions.remove).toHaveBeenCalledWith({
        channel: 'C67890',
        timestamp: '789.012',
        name: 'tada'
      });
    });
  });
});
