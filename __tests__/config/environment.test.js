// __tests__/config/environment.test.js
// Mock dotenv before requiring the module
jest.mock('dotenv', () => ({
  config: jest.fn()
}));

describe('Environment Configuration', () => {
  let originalEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Clear the module cache to allow fresh imports
    jest.resetModules();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Channel Mappings', () => {
    test('should parse CHANNEL_MAPPINGS JSON format correctly', () => {
      process.env.CHANNEL_MAPPINGS = '[{"slack":"C12345","mattermost":"mm12345"}]';
      
      const { channelMappings } = require('../../src/config/environment');
      
      expect(channelMappings).toEqual([
        { slack: 'C12345', mattermost: 'mm12345' }
      ]);
    });

    test('should parse multiple channel mappings', () => {
      process.env.CHANNEL_MAPPINGS = '[{"slack":"C12345","mattermost":"mm12345"},{"slack":"C67890","mattermost":"mm67890"}]';
      
      const { channelMappings } = require('../../src/config/environment');
      
      expect(channelMappings).toHaveLength(2);
      expect(channelMappings[0]).toEqual({ slack: 'C12345', mattermost: 'mm12345' });
      expect(channelMappings[1]).toEqual({ slack: 'C67890', mattermost: 'mm67890' });
    });

    test('should fall back to legacy config when CHANNEL_MAPPINGS is not set', () => {
      process.env.SLACK_CHANNEL_ID = 'C12345';
      process.env.MM_CHANNEL_ID = 'mm12345';
      delete process.env.CHANNEL_MAPPINGS;
      
      const { channelMappings } = require('../../src/config/environment');
      
      expect(channelMappings).toEqual([
        { slack: 'C12345', mattermost: 'mm12345' }
      ]);
    });

    test('should exit process when no channel mappings are configured', () => {
      delete process.env.CHANNEL_MAPPINGS;
      delete process.env.SLACK_CHANNEL_ID;
      delete process.env.MM_CHANNEL_ID;
      
      const mockExit = jest.spyOn(process, 'exit').mockImplementation((code) => {
        throw new Error(`Process.exit called with code ${code}`);
      });
      
      expect(() => {
        require('../../src/config/environment');
      }).toThrow('Process.exit called with code 1');
      
      mockExit.mockRestore();
    });
  });

  describe('Channel Maps', () => {
    test('should create correct Slack to Mattermost map', () => {
      process.env.CHANNEL_MAPPINGS = '[{"slack":"C12345","mattermost":"mm12345"}]';
      
      const { slackToMmChannelMap } = require('../../src/config/environment');
      
      expect(slackToMmChannelMap.get('C12345')).toBe('mm12345');
    });

    test('should create correct Mattermost to Slack map', () => {
      process.env.CHANNEL_MAPPINGS = '[{"slack":"C12345","mattermost":"mm12345"}]';
      
      const { mmToSlackChannelMap } = require('../../src/config/environment');
      
      expect(mmToSlackChannelMap.get('mm12345')).toBe('C12345');
    });
  });

  describe('Configuration Object', () => {
    test('should load Slack configuration from environment', () => {
      process.env.SLACK_SIGNING_SECRET = 'test_secret';
      process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';
      process.env.CHANNEL_MAPPINGS = '[{"slack":"C12345","mattermost":"mm12345"}]';
      
      const { config } = require('../../src/config/environment');
      
      expect(config.slack.signingSecret).toBe('test_secret');
      expect(config.slack.botToken).toBe('xoxb-test-token');
    });

    test('should load Mattermost configuration from environment', () => {
      process.env.MM_TOKEN = 'mm_test_token';
      process.env.MM_URL = 'https://mattermost.example.com';
      process.env.CHANNEL_MAPPINGS = '[{"slack":"C12345","mattermost":"mm12345"}]';
      
      const { config } = require('../../src/config/environment');
      
      expect(config.mattermost.token).toBe('mm_test_token');
      expect(config.mattermost.url).toBe('https://mattermost.example.com');
    });

    test('should load Redis configuration with defaults', () => {
      process.env.CHANNEL_MAPPINGS = '[{"slack":"C12345","mattermost":"mm12345"}]';
      delete process.env.REDIS_URL;
      delete process.env.REDIS_EXPIRY_DAYS;
      
      const { config } = require('../../src/config/environment');
      
      expect(config.redis.url).toBe('redis://localhost:6379');
      expect(config.redis.expiryDays).toBe(180);
    });

    test('should use custom Redis configuration when provided', () => {
      process.env.REDIS_URL = 'redis://custom:6379';
      process.env.REDIS_EXPIRY_DAYS = '365';
      process.env.CHANNEL_MAPPINGS = '[{"slack":"C12345","mattermost":"mm12345"}]';
      
      const { config } = require('../../src/config/environment');
      
      expect(config.redis.url).toBe('redis://custom:6379');
      expect(config.redis.expiryDays).toBe(365);
    });

    test('should load port configuration with default', () => {
      process.env.CHANNEL_MAPPINGS = '[{"slack":"C12345","mattermost":"mm12345"}]';
      delete process.env.PORT;
      
      const { config } = require('../../src/config/environment');
      
      expect(config.port).toBe(3000);
    });

    test('should use custom port when provided', () => {
      process.env.PORT = '8080';
      process.env.CHANNEL_MAPPINGS = '[{"slack":"C12345","mattermost":"mm12345"}]';
      
      const { config } = require('../../src/config/environment');
      
      expect(config.port).toBe('8080');
    });
  });
});
