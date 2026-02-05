// __tests__/storage/storage-interface.test.js

describe('Storage Interface', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('should initialize memory backend', () => {
    const { initializeStorage } = require('../../src/storage/storage-interface');
    const backend = initializeStorage('memory', {});
    
    expect(backend).toBeDefined();
    expect(backend.set).toBeDefined();
    expect(backend.get).toBeDefined();
    expect(backend.delete).toBeDefined();
    expect(backend.isConnected).toBeDefined();
    expect(backend.close).toBeDefined();
  });

  test('should initialize redis backend', () => {
    // Mock Redis
    const mockRedisInstance = {
      setex: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
      quit: jest.fn(),
      on: jest.fn(),
      status: 'ready',
    };
    
    jest.mock('ioredis', () => {
      return jest.fn(() => mockRedisInstance);
    });

    const { initializeStorage } = require('../../src/storage/storage-interface');
    const config = {
      url: 'redis://localhost:6379',
      expiryDays: 180,
    };
    const backend = initializeStorage('redis', config);
    
    expect(backend).toBeDefined();
    expect(backend.set).toBeDefined();
    expect(backend.get).toBeDefined();
    expect(backend.delete).toBeDefined();
    expect(backend.isConnected).toBeDefined();
    expect(backend.close).toBeDefined();
  });
});
