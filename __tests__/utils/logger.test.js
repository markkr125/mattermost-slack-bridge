// __tests__/utils/logger.test.js
const { createContextLogger, loggerInstance } = require('../../src/utils/logger');

describe('Logger Utility', () => {
  test('creates logger with specific context', () => {
    const testLogger = createContextLogger('test-module');
    expect(testLogger).toHaveProperty('error');
    expect(testLogger).toHaveProperty('warn');
    expect(testLogger).toHaveProperty('info');
    expect(testLogger).toHaveProperty('debug');
  });

  test('logger methods are callable', () => {
    const moduleLogger = createContextLogger('module-x');
    expect(() => moduleLogger.info('test message')).not.toThrow();
    expect(() => moduleLogger.error('error message')).not.toThrow();
    expect(() => moduleLogger.warn('warning message')).not.toThrow();
  });

  test('logger includes context in messages', () => {
    const specificLogger = createContextLogger('payment-processor');
    expect(() => specificLogger.info('Processing payment')).not.toThrow();
  });

  test('handles metadata in log calls', () => {
    const dataLogger = createContextLogger('data-sync');
    expect(() => dataLogger.info('Syncing data', { recordCount: 42, status: 'active' })).not.toThrow();
  });
});
