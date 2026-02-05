// __tests__/metrics/metrics.test.js
const {
  recordMessageBridged,
  recordReconnection,
  recordFailedEvent,
  setConnectionStatus,
  getMetrics,
  getMetricsContentType,
} = require('../../src/metrics/metrics');

describe('Metrics', () => {
  describe('recordMessageBridged', () => {
    test('should record message bridged without errors', () => {
      expect(() => recordMessageBridged('slack', 'mattermost')).not.toThrow();
      expect(() => recordMessageBridged('mattermost', 'slack')).not.toThrow();
    });
  });

  describe('recordReconnection', () => {
    test('should record reconnection without errors', () => {
      expect(() => recordReconnection('slack')).not.toThrow();
      expect(() => recordReconnection('mattermost')).not.toThrow();
    });
  });

  describe('recordFailedEvent', () => {
    test('should record failed event without errors', () => {
      expect(() => recordFailedEvent('slack', 'message', 'NetworkError')).not.toThrow();
      expect(() => recordFailedEvent('mattermost', 'post', 'TimeoutError')).not.toThrow();
    });

    test('should handle missing error type', () => {
      expect(() => recordFailedEvent('slack', 'message')).not.toThrow();
    });
  });

  describe('setConnectionStatus', () => {
    test('should set connection status without errors', () => {
      expect(() => setConnectionStatus('slack', true)).not.toThrow();
      expect(() => setConnectionStatus('mattermost', false)).not.toThrow();
    });
  });

  describe('getMetrics', () => {
    test('should return metrics as string', async () => {
      const metrics = await getMetrics();
      expect(typeof metrics).toBe('string');
      expect(metrics.length).toBeGreaterThan(0);
    });

    test('should include custom metrics', async () => {
      // Record some metrics
      recordMessageBridged('slack', 'mattermost');
      recordReconnection('slack');
      setConnectionStatus('slack', true);

      const metrics = await getMetrics();
      
      expect(metrics).toContain('bridge_messages_total');
      expect(metrics).toContain('bridge_reconnections_total');
      expect(metrics).toContain('bridge_connection_status');
    });

    test('should include default metrics', async () => {
      const metrics = await getMetrics();
      
      // Check for some default Node.js metrics
      expect(metrics).toContain('process_cpu');
      expect(metrics).toContain('nodejs_');
    });
  });

  describe('getMetricsContentType', () => {
    test('should return valid content type', () => {
      const contentType = getMetricsContentType();
      expect(typeof contentType).toBe('string');
      expect(contentType).toMatch(/^text\/plain/);
    });
  });

  describe('message latency timer', () => {
    test('should create and use timer without errors', () => {
      const { startMessageTimer } = require('../../src/metrics/metrics');
      
      const endTimer = startMessageTimer('slack', 'mattermost');
      expect(typeof endTimer).toBe('function');
      
      // End the timer
      expect(() => endTimer()).not.toThrow();
    });
  });

  describe('integration test', () => {
    test('should record multiple metrics and retrieve them', async () => {
      // Record various metrics
      recordMessageBridged('slack', 'mattermost');
      recordMessageBridged('mattermost', 'slack');
      recordReconnection('slack');
      recordFailedEvent('mattermost', 'post', 'NetworkError');
      setConnectionStatus('slack', true);
      setConnectionStatus('mattermost', false);

      const metrics = await getMetrics();
      
      // Verify metrics contain expected data
      expect(metrics).toContain('bridge_messages_total');
      expect(metrics).toContain('bridge_reconnections_total');
      expect(metrics).toContain('bridge_failed_events_total');
      expect(metrics).toContain('bridge_connection_status');
    });
  });
});
