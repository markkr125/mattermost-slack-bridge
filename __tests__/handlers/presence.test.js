// __tests__/handlers/presence.test.js
jest.mock('../../src/utils/logger', () => ({
  createContextLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  })
}));

const {
  initializePresence,
  handleSlackPresenceChange,
  handleMattermostStatusChange,
  registerPresenceMapping,
  syncAllPresences,
  startPeriodicSync,
  getPresenceStats,
  resetPresenceState
} = require('../../src/handlers/presence');

describe('Presence Handler', () => {
  let slackClient, mmApi;

  beforeEach(() => {
    resetPresenceState();
    
    slackClient = {
      users: {
        getPresence: jest.fn()
      }
    };

    mmApi = {
      put: jest.fn().mockResolvedValue({ data: {} })
    };

    jest.clearAllMocks();
  });

  describe('initializePresence', () => {
    test('should initialize with defaults', () => {
      initializePresence();
      
      const stats = getPresenceStats();
      expect(stats.enabled).toBe(true);
      expect(stats.syncIntervalMs).toBe(60000);
    });

    test('should initialize with custom config', () => {
      initializePresence({ enabled: true, syncIntervalMs: 30000 });
      
      const stats = getPresenceStats();
      expect(stats.enabled).toBe(true);
      expect(stats.syncIntervalMs).toBe(30000);
    });

    test('should allow disabling presence sync', () => {
      initializePresence({ enabled: false });
      
      const stats = getPresenceStats();
      expect(stats.enabled).toBe(false);
    });
  });

  describe('registerPresenceMapping', () => {
    test('should register user mapping', () => {
      registerPresenceMapping('S123', 'M456');
      
      const stats = getPresenceStats();
      expect(stats.mappedUsers).toBe(1);
    });

    test('should allow multiple mappings', () => {
      registerPresenceMapping('S1', 'M1');
      registerPresenceMapping('S2', 'M2');
      registerPresenceMapping('S3', 'M3');
      
      const stats = getPresenceStats();
      expect(stats.mappedUsers).toBe(3);
    });
  });

  describe('handleSlackPresenceChange', () => {
    beforeEach(() => {
      initializePresence({ enabled: true });
      registerPresenceMapping('U123', 'mm_user_123');
    });

    test('should update Mattermost status when presence changes', async () => {
      const event = {
        user: 'U123',
        presence: 'active'
      };

      await handleSlackPresenceChange(slackClient, mmApi, event);

      expect(mmApi.put).toHaveBeenCalledWith(
        '/users/mm_user_123/status',
        {
          user_id: 'mm_user_123',
          status: 'online'
        }
      );
    });

    test('should map away presence correctly', async () => {
      const event = {
        user: 'U123',
        presence: 'away'
      };

      await handleSlackPresenceChange(slackClient, mmApi, event);

      expect(mmApi.put).toHaveBeenCalledWith(
        '/users/mm_user_123/status',
        expect.objectContaining({
          status: 'away'
        })
      );
    });

    test('should skip when presence disabled', async () => {
      initializePresence({ enabled: false });

      const event = {
        user: 'U123',
        presence: 'active'
      };

      await handleSlackPresenceChange(slackClient, mmApi, event);

      expect(mmApi.put).not.toHaveBeenCalled();
    });

    test('should skip when user not mapped', async () => {
      const event = {
        user: 'UNMAPPED',
        presence: 'active'
      };

      await handleSlackPresenceChange(slackClient, mmApi, event);

      expect(mmApi.put).not.toHaveBeenCalled();
    });

    test('should handle API errors gracefully', async () => {
      mmApi.put.mockRejectedValue(new Error('API error'));

      const event = {
        user: 'U123',
        presence: 'active'
      };

      // Should not throw
      await expect(
        handleSlackPresenceChange(slackClient, mmApi, event)
      ).resolves.not.toThrow();
    });
  });

  describe('handleMattermostStatusChange', () => {
    beforeEach(() => {
      initializePresence({ enabled: true });
      registerPresenceMapping('U123', 'mm_user_123');
    });

    test('should handle status change event', async () => {
      const event = {
        data: {
          user_id: 'mm_user_123',
          status: 'online'
        }
      };

      // Note: Slack API doesn't allow bots to set user presence
      // This test validates the handler doesn't crash
      await expect(
        handleMattermostStatusChange(slackClient, event)
      ).resolves.not.toThrow();
    });

    test('should skip when presence disabled', async () => {
      initializePresence({ enabled: false });

      const event = {
        data: {
          user_id: 'mm_user_123',
          status: 'online'
        }
      };

      await handleMattermostStatusChange(slackClient, event);

      // No API calls should be made
      expect(slackClient.users.getPresence).not.toHaveBeenCalled();
    });

    test('should skip when user not mapped', async () => {
      const event = {
        data: {
          user_id: 'UNMAPPED',
          status: 'online'
        }
      };

      await handleMattermostStatusChange(slackClient, event);

      // No API calls should be made
      expect(slackClient.users.getPresence).not.toHaveBeenCalled();
    });
  });

  describe('syncAllPresences', () => {
    beforeEach(() => {
      initializePresence({ enabled: true });
      registerPresenceMapping('U1', 'M1');
      registerPresenceMapping('U2', 'M2');

      slackClient.users.getPresence.mockResolvedValue({
        presence: 'active'
      });
    });

    test('should sync all mapped users', async () => {
      await syncAllPresences(slackClient, mmApi);

      expect(slackClient.users.getPresence).toHaveBeenCalledTimes(2);
      expect(mmApi.put).toHaveBeenCalledTimes(2);
    });

    test('should skip when disabled', async () => {
      initializePresence({ enabled: false });

      await syncAllPresences(slackClient, mmApi);

      expect(slackClient.users.getPresence).not.toHaveBeenCalled();
      expect(mmApi.put).not.toHaveBeenCalled();
    });

    test('should handle individual sync failures', async () => {
      slackClient.users.getPresence
        .mockResolvedValueOnce({ presence: 'active' })
        .mockRejectedValueOnce(new Error('API error'));

      await syncAllPresences(slackClient, mmApi);

      // Should have attempted both
      expect(slackClient.users.getPresence).toHaveBeenCalledTimes(2);
      // Only one should succeed
      expect(mmApi.put).toHaveBeenCalledTimes(1);
    });
  });

  describe('startPeriodicSync', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      initializePresence({ enabled: true, syncIntervalMs: 1000 });
      registerPresenceMapping('U1', 'M1');

      slackClient.users.getPresence.mockResolvedValue({
        presence: 'active'
      });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should start periodic sync when enabled', async () => {
      const intervalId = startPeriodicSync(slackClient, mmApi);

      expect(intervalId).toBeDefined();

      // Should do initial sync
      await Promise.resolve();
      expect(slackClient.users.getPresence).toHaveBeenCalled();

      // Clear interval
      clearInterval(intervalId);
    });

    test('should return null when disabled', () => {
      initializePresence({ enabled: false });

      const intervalId = startPeriodicSync(slackClient, mmApi);

      expect(intervalId).toBeNull();
    });

    test('should sync at configured interval', async () => {
      const intervalId = startPeriodicSync(slackClient, mmApi);

      // Initial sync
      await Promise.resolve();
      const initialCalls = slackClient.users.getPresence.mock.calls.length;

      // Advance time and flush promises
      jest.advanceTimersByTime(1000);
      await Promise.resolve();

      expect(slackClient.users.getPresence.mock.calls.length).toBeGreaterThan(initialCalls);

      clearInterval(intervalId);
    });
  });

  describe('getPresenceStats', () => {
    test('should return current stats', () => {
      initializePresence({ enabled: true, syncIntervalMs: 5000 });
      registerPresenceMapping('U1', 'M1');
      registerPresenceMapping('U2', 'M2');

      const stats = getPresenceStats();

      expect(stats.enabled).toBe(true);
      expect(stats.syncIntervalMs).toBe(5000);
      expect(stats.mappedUsers).toBe(2);
    });
  });
});
