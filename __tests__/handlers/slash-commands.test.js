// __tests__/handlers/slash-commands.test.js
jest.mock('../../src/utils/logger', () => ({
  createContextLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  })
}));

jest.mock('../../src/utils/perf-monitor', () => ({
  perfMonitor: {
    summarize: jest.fn()
  }
}));

jest.mock('../../src/metrics/metrics', () => ({
  getConnectionStatus: jest.fn()
}));

const { handleSlackSlashCommand, handleMattermostSlashCommand } = require('../../src/handlers/slash-commands');
const { perfMonitor } = require('../../src/utils/perf-monitor');
const { getConnectionStatus } = require('../../src/metrics/metrics');

describe('Slash Commands', () => {
  let slackApp, mmApi;

  beforeEach(() => {
    slackApp = {
      client: {}
    };
    
    mmApi = {
      post: jest.fn().mockResolvedValue({ data: {} })
    };

    jest.clearAllMocks();
  });

  describe('handleSlackSlashCommand', () => {
    test('should handle help command', async () => {
      const command = {
        command: '/bridge',
        text: 'help',
        user_id: 'U123',
        channel_id: 'C123'
      };

      const response = await handleSlackSlashCommand(slackApp, mmApi, command);

      expect(response.response_type).toBe('ephemeral');
      expect(response.text).toContain('Bridge Commands');
      expect(response.text).toContain('/bridge status');
      expect(response.text).toContain('/bridge stats');
      expect(response.text).toContain('/bridge perf');
    });

    test('should handle status command', async () => {
      const command = {
        command: '/bridge',
        text: 'status',
        user_id: 'U123',
        channel_id: 'C123'
      };

      const response = await handleSlackSlashCommand(slackApp, mmApi, command);

      expect(response.response_type).toBe('ephemeral');
      expect(response.text).toContain('Bridge Status');
      expect(response.text).toContain('operational');
      expect(response.text).toContain('Uptime');
      expect(response.text).toContain('Memory');
    });

    test('should handle stats command', async () => {
      getConnectionStatus.mockReturnValue({
        slack: true,
        mattermost: true
      });

      const command = {
        command: '/bridge',
        text: 'stats',
        user_id: 'U123',
        channel_id: 'C123'
      };

      const response = await handleSlackSlashCommand(slackApp, mmApi, command);

      expect(response.response_type).toBe('ephemeral');
      expect(response.text).toContain('Bridge Statistics');
      expect(response.text).toContain('Connected');
    });

    test('should handle perf command with data', async () => {
      perfMonitor.summarize.mockReturnValue({
        'message-processing': {
          sampleCount: 5,
          timing: {
            meanMs: 12.5,
            p95Ms: 18.3
          }
        }
      });

      const command = {
        command: '/bridge',
        text: 'perf',
        user_id: 'U123',
        channel_id: 'C123'
      };

      const response = await handleSlackSlashCommand(slackApp, mmApi, command);

      expect(response.response_type).toBe('ephemeral');
      expect(response.text).toContain('Performance Metrics');
      expect(response.text).toContain('message-processing');
      expect(response.text).toContain('Samples: 5');
    });

    test('should handle perf command with no data', async () => {
      perfMonitor.summarize.mockReturnValue({});

      const command = {
        command: '/bridge',
        text: 'perf',
        user_id: 'U123',
        channel_id: 'C123'
      };

      const response = await handleSlackSlashCommand(slackApp, mmApi, command);

      expect(response.text).toContain('No performance data available');
    });

    test('should default to help for empty text', async () => {
      const command = {
        command: '/bridge',
        text: '',
        user_id: 'U123',
        channel_id: 'C123'
      };

      const response = await handleSlackSlashCommand(slackApp, mmApi, command);

      expect(response.text).toContain('Bridge Commands');
    });

    test('should ignore non-bridge commands', async () => {
      const command = {
        command: '/other',
        text: 'test',
        user_id: 'U123',
        channel_id: 'C123'
      };

      const response = await handleSlackSlashCommand(slackApp, mmApi, command);

      expect(response).toBeUndefined();
    });

    test('should handle errors gracefully', async () => {
      getConnectionStatus.mockImplementation(() => {
        throw new Error('Connection check failed');
      });

      const command = {
        command: '/bridge',
        text: 'stats',
        user_id: 'U123',
        channel_id: 'C123'
      };

      const response = await handleSlackSlashCommand(slackApp, mmApi, command);

      expect(response.response_type).toBe('ephemeral');
      expect(response.text).toContain('Error');
      expect(response.text).toContain('Connection check failed');
    });
  });

  describe('handleMattermostSlashCommand', () => {
    test('should handle help command', async () => {
      const payload = {
        command: '/bridge',
        text: 'help',
        user_id: 'user123',
        channel_id: 'ch123'
      };

      const result = await handleMattermostSlashCommand(slackApp, mmApi, payload);

      expect(result.status).toBe('ok');
      expect(mmApi.post).toHaveBeenCalledWith('/posts', expect.objectContaining({
        channel_id: 'ch123',
        message: expect.stringContaining('Bridge Commands')
      }));
    });

    test('should handle status command', async () => {
      const payload = {
        command: '/bridge',
        text: 'status',
        user_id: 'user123',
        channel_id: 'ch123'
      };

      const result = await handleMattermostSlashCommand(slackApp, mmApi, payload);

      expect(result.status).toBe('ok');
      expect(mmApi.post).toHaveBeenCalledWith('/posts', expect.objectContaining({
        channel_id: 'ch123',
        message: expect.stringContaining('Bridge Status')
      }));
    });

    test('should handle stats command', async () => {
      getConnectionStatus.mockReturnValue({
        slack: false,
        mattermost: true
      });

      const payload = {
        command: '/bridge',
        text: 'stats',
        user_id: 'user123',
        channel_id: 'ch123'
      };

      const result = await handleMattermostSlashCommand(slackApp, mmApi, payload);

      expect(result.status).toBe('ok');
      expect(mmApi.post).toHaveBeenCalledWith('/posts', expect.objectContaining({
        message: expect.stringContaining('Disconnected')
      }));
    });

    test('should ignore non-bridge commands', async () => {
      const payload = {
        command: '/other',
        text: 'test',
        user_id: 'user123',
        channel_id: 'ch123'
      };

      const result = await handleMattermostSlashCommand(slackApp, mmApi, payload);

      expect(result).toBeUndefined();
      expect(mmApi.post).not.toHaveBeenCalled();
    });

    test('should handle errors gracefully', async () => {
      mmApi.post.mockRejectedValue(new Error('Post failed'));

      const payload = {
        command: '/bridge',
        text: 'help',
        user_id: 'user123',
        channel_id: 'ch123'
      };

      const result = await handleMattermostSlashCommand(slackApp, mmApi, payload);

      expect(result.status).toBe('error');
      expect(result.error).toBe('Post failed');
    });
  });
});
