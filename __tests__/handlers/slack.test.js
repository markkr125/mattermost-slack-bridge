// __tests__/handlers/slack.test.js
// Set up environment before importing modules
process.env.CHANNEL_MAPPINGS = '[{"slack":"C12345","mattermost":"mm12345"}]';
process.env.REDIS_URL = 'redis://localhost:6379';

// Mock dependencies BEFORE importing handlers
jest.mock('../../src/utils/markdown');
jest.mock('../../src/storage/redis');
jest.mock('ioredis');

const {
  setSlackBotUserId,
  getSlackBotUserId,
  handleSlackMessage,
  handleSlackMessageEdit,
  handleSlackMessageDelete,
} = require('../../src/handlers/slack');

const { convertSlackToMattermost } = require('../../src/utils/markdown');
const { setSlackToMm, getSlackToMm, setMmToSlack } = require('../../src/storage/redis');

describe('Slack Handler', () => {
  describe('Bot User ID Management', () => {
    test('should set and get Slack bot user ID', () => {
      setSlackBotUserId('U12345');
      expect(getSlackBotUserId()).toBe('U12345');
    });
  });

  describe('handleSlackMessage', () => {
    let mockSlackApp;
    let mockMmApi;

    beforeEach(() => {
      jest.clearAllMocks();
      
      mockSlackApp = {
        client: {
          users: {
            info: jest.fn().mockResolvedValue({
              user: {
                profile: {
                  display_name: 'Test User',
                  image_original: 'https://example.com/avatar.png'
                }
              }
            })
          }
        }
      };

      mockMmApi = {
        post: jest.fn().mockResolvedValue({ data: { id: 'mm_post_123' } })
      };

      convertSlackToMattermost.mockImplementation(text => text);
      getSlackToMm.mockResolvedValue(null);
    });

    test('should skip message if channel not mapped', async () => {
      const message = {
        channel: 'C_UNMAPPED',
        user: 'U12345',
        text: 'Hello'
      };

      await handleSlackMessage(mockSlackApp, mockMmApi, message);

      expect(mockMmApi.post).not.toHaveBeenCalled();
    });

    test('should skip message if no user', async () => {
      const message = {
        channel: 'C12345',
        text: 'Hello'
      };

      await handleSlackMessage(mockSlackApp, mockMmApi, message);

      expect(mockMmApi.post).not.toHaveBeenCalled();
    });

    test('should skip message from bot itself', async () => {
      setSlackBotUserId('U_BOT');
      const message = {
        channel: 'C12345',
        user: 'U_BOT',
        text: 'Hello'
      };

      await handleSlackMessage(mockSlackApp, mockMmApi, message);

      expect(mockMmApi.post).not.toHaveBeenCalled();
    });

    test('should skip message with subtype', async () => {
      const message = {
        channel: 'C12345',
        user: 'U12345',
        subtype: 'message_changed',
        text: 'Hello'
      };

      await handleSlackMessage(mockSlackApp, mockMmApi, message);

      expect(mockMmApi.post).not.toHaveBeenCalled();
    });

    test('should post message to Mattermost', async () => {
      const message = {
        channel: 'C12345',
        user: 'U12345',
        text: 'Hello World',
        ts: '1234567890.123456'
      };

      await handleSlackMessage(mockSlackApp, mockMmApi, message);

      expect(mockMmApi.post).toHaveBeenCalledWith('/posts', expect.objectContaining({
        channel_id: 'mm12345',
        message: 'Hello World',
        props: expect.objectContaining({
          from_webhook: 'true',
          override_username: 'Test User',
          override_icon_url: 'https://example.com/avatar.png'
        })
      }));
    });

    test('should handle threaded messages', async () => {
      getSlackToMm.mockResolvedValue('mm_root_123');
      
      const message = {
        channel: 'C12345',
        user: 'U12345',
        text: 'Reply',
        ts: '1234567890.123456',
        thread_ts: '1234567890.000000'
      };

      await handleSlackMessage(mockSlackApp, mockMmApi, message);

      expect(mockMmApi.post).toHaveBeenCalledWith('/posts', expect.objectContaining({
        root_id: 'mm_root_123',
        parent_id: 'mm_root_123'
      }));
    });

    test('should store message mapping for non-threaded messages', async () => {
      const message = {
        channel: 'C12345',
        user: 'U12345',
        text: 'Hello',
        ts: '1234567890.123456'
      };

      await handleSlackMessage(mockSlackApp, mockMmApi, message);

      expect(setSlackToMm).toHaveBeenCalledWith('C12345', '1234567890.123456', 'mm_post_123');
      expect(setMmToSlack).toHaveBeenCalledWith('mm12345', 'mm_post_123', '1234567890.123456');
    });
  });

  describe('handleSlackMessageEdit', () => {
    let mockMmApi;

    beforeEach(() => {
      jest.clearAllMocks();
      setSlackBotUserId('U_BOT');
      
      mockMmApi = {
        put: jest.fn().mockResolvedValue({})
      };

      convertSlackToMattermost.mockImplementation(text => text);
      getSlackToMm.mockResolvedValue('mm_post_123');
    });

    test('should skip if no message in event', async () => {
      const event = {
        channel: 'C12345',
        subtype: 'message_changed'
      };

      await handleSlackMessageEdit(mockMmApi, event);

      expect(mockMmApi.put).not.toHaveBeenCalled();
    });

    test('should skip if message from bot', async () => {
      const event = {
        channel: 'C12345',
        message: {
          user: 'U_BOT',
          text: 'Updated',
          ts: '1234567890.123456'
        }
      };

      await handleSlackMessageEdit(mockMmApi, event);

      expect(mockMmApi.put).not.toHaveBeenCalled();
    });

    test('should update Mattermost post', async () => {
      const event = {
        channel: 'C12345',
        message: {
          user: 'U12345',
          text: 'Updated message',
          ts: '1234567890.123456'
        }
      };

      await handleSlackMessageEdit(mockMmApi, event);

      expect(mockMmApi.put).toHaveBeenCalledWith('/posts/mm_post_123/patch', {
        message: 'Updated message'
      });
    });
  });

  describe('handleSlackMessageDelete', () => {
    let mockMmApi;

    beforeEach(() => {
      jest.clearAllMocks();
      
      mockMmApi = {
        delete: jest.fn().mockResolvedValue({})
      };

      getSlackToMm.mockResolvedValue('mm_post_123');
    });

    test('should skip if no previous_message in event', async () => {
      const event = {
        channel: 'C12345',
        subtype: 'message_deleted'
      };

      await handleSlackMessageDelete(mockMmApi, event);

      expect(mockMmApi.delete).not.toHaveBeenCalled();
    });

    test('should delete Mattermost post', async () => {
      const event = {
        channel: 'C12345',
        previous_message: {
          ts: '1234567890.123456'
        }
      };

      await handleSlackMessageDelete(mockMmApi, event);

      expect(mockMmApi.delete).toHaveBeenCalledWith('/posts/mm_post_123');
    });
  });
});
