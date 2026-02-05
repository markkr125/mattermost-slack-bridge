// __tests__/handlers/mattermost.test.js
// Set up environment before importing modules
process.env.CHANNEL_MAPPINGS = '[{"slack":"C12345","mattermost":"mm12345"}]';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.MM_URL = 'https://mattermost.example.com';

// Mock dependencies BEFORE importing handlers
jest.mock('../../src/utils/markdown');
jest.mock('../../src/storage/redis');
jest.mock('ioredis');

const {
  setMmBotUserId,
  getMmBotUserId,
  handleMattermostPost,
  handleMattermostPostEdit,
  handleMattermostPostDelete,
} = require('../../src/handlers/mattermost');

const { convertMattermostToSlack } = require('../../src/utils/markdown');
const { setMmToSlack, getMmToSlack, setSlackToMm } = require('../../src/storage/redis');

describe('Mattermost Handler', () => {
  describe('Bot User ID Management', () => {
    test('should set and get Mattermost bot user ID', () => {
      setMmBotUserId('mm_bot_123');
      expect(getMmBotUserId()).toBe('mm_bot_123');
    });
  });

  describe('handleMattermostPost', () => {
    let mockSlackApp;
    let mockMmApi;

    beforeEach(() => {
      jest.clearAllMocks();
      
      mockSlackApp = {
        client: {
          chat: {
            postMessage: jest.fn().mockResolvedValue({ ts: '1234567890.123456' })
          }
        }
      };

      mockMmApi = {
        get: jest.fn().mockResolvedValue({ data: {} })
      };

      convertMattermostToSlack.mockImplementation(text => text);
      getMmToSlack.mockResolvedValue(null);
    });

    test('should skip post if channel not mapped', async () => {
      const event = {
        event: 'posted',
        data: {
          post: JSON.stringify({
            channel_id: 'mm_unmapped',
            user_id: 'mm_user_123',
            message: 'Hello',
            id: 'post_123'
          }),
          sender_name: 'Test User'
        }
      };

      await handleMattermostPost(mockSlackApp, mockMmApi, event);

      expect(mockSlackApp.client.chat.postMessage).not.toHaveBeenCalled();
    });

    test('should skip post from bot itself', async () => {
      setMmBotUserId('mm_bot_123');
      
      const event = {
        event: 'posted',
        data: {
          post: JSON.stringify({
            channel_id: 'mm12345',
            user_id: 'mm_bot_123',
            message: 'Hello',
            id: 'post_123'
          }),
          sender_name: 'Bot'
        }
      };

      await handleMattermostPost(mockSlackApp, mockMmApi, event);

      expect(mockSlackApp.client.chat.postMessage).not.toHaveBeenCalled();
    });

    test('should post message to Slack', async () => {
      setMmBotUserId('mm_bot_123');
      
      const event = {
        event: 'posted',
        data: {
          post: JSON.stringify({
            channel_id: 'mm12345',
            user_id: 'mm_user_123',
            message: 'Hello World',
            id: 'post_123'
          }),
          sender_name: 'Test User'
        }
      };

      await handleMattermostPost(mockSlackApp, mockMmApi, event);

      expect(mockSlackApp.client.chat.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C12345',
          text: 'Hello World',
          username: 'Test User',
          blocks: expect.any(Array)
        })
      );
    });

    test('should handle threaded posts', async () => {
      setMmBotUserId('mm_bot_123');
      getMmToSlack.mockResolvedValue('1234567890.000000');
      
      const event = {
        event: 'posted',
        data: {
          post: JSON.stringify({
            channel_id: 'mm12345',
            user_id: 'mm_user_123',
            message: 'Reply',
            id: 'post_123',
            root_id: 'root_post_123'
          }),
          sender_name: 'Test User'
        }
      };

      await handleMattermostPost(mockSlackApp, mockMmApi, event);

      expect(mockSlackApp.client.chat.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          thread_ts: '1234567890.000000'
        })
      );
    });

    test('should store message mapping for non-threaded messages', async () => {
      setMmBotUserId('mm_bot_123');
      
      const event = {
        event: 'posted',
        data: {
          post: JSON.stringify({
            channel_id: 'mm12345',
            user_id: 'mm_user_123',
            message: 'Hello',
            id: 'post_123'
          }),
          sender_name: 'Test User'
        }
      };

      await handleMattermostPost(mockSlackApp, mockMmApi, event);

      expect(setMmToSlack).toHaveBeenCalledWith('mm12345', 'post_123', '1234567890.123456');
      expect(setSlackToMm).toHaveBeenCalledWith('C12345', '1234567890.123456', 'post_123');
    });
  });

  describe('handleMattermostPostEdit', () => {
    let mockSlackApp;

    beforeEach(() => {
      jest.clearAllMocks();
      setMmBotUserId('mm_bot_123');
      
      mockSlackApp = {
        client: {
          chat: {
            update: jest.fn().mockResolvedValue({})
          }
        }
      };

      convertMattermostToSlack.mockImplementation(text => text);
      getMmToSlack.mockResolvedValue('1234567890.123456');
    });

    test('should skip if post from bot', async () => {
      const event = {
        event: 'post_edited',
        data: {
          post: JSON.stringify({
            channel_id: 'mm12345',
            user_id: 'mm_bot_123',
            message: 'Updated',
            id: 'post_123'
          })
        }
      };

      await handleMattermostPostEdit(mockSlackApp, event);

      expect(mockSlackApp.client.chat.update).not.toHaveBeenCalled();
    });

    test('should update Slack message', async () => {
      const event = {
        event: 'post_edited',
        data: {
          post: JSON.stringify({
            channel_id: 'mm12345',
            user_id: 'mm_user_123',
            message: 'Updated message',
            id: 'post_123'
          })
        }
      };

      await handleMattermostPostEdit(mockSlackApp, event);

      expect(mockSlackApp.client.chat.update).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C12345',
          ts: '1234567890.123456',
          text: 'Updated message'
        })
      );
    });
  });

  describe('handleMattermostPostDelete', () => {
    let mockSlackApp;

    beforeEach(() => {
      jest.clearAllMocks();
      
      mockSlackApp = {
        client: {
          chat: {
            delete: jest.fn().mockResolvedValue({})
          }
        }
      };

      getMmToSlack.mockResolvedValue('1234567890.123456');
    });

    test('should delete Slack message', async () => {
      const event = {
        event: 'post_deleted',
        data: {
          post: JSON.stringify({
            channel_id: 'mm12345',
            id: 'post_123'
          })
        }
      };

      await handleMattermostPostDelete(mockSlackApp, event);

      expect(mockSlackApp.client.chat.delete).toHaveBeenCalledWith({
        channel: 'C12345',
        ts: '1234567890.123456'
      });
    });

    test('should skip if channel not mapped', async () => {
      const event = {
        event: 'post_deleted',
        data: {
          post: JSON.stringify({
            channel_id: 'mm_unmapped',
            id: 'post_123'
          })
        }
      };

      await handleMattermostPostDelete(mockSlackApp, event);

      expect(mockSlackApp.client.chat.delete).not.toHaveBeenCalled();
    });
  });
});
