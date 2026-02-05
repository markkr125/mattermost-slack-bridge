// __tests__/storage/memory-backend.test.js
const MemoryBackend = require('../../src/storage/memory-backend');

describe('MemoryBackend', () => {
  let backend;

  beforeEach(() => {
    backend = new MemoryBackend();
  });

  afterEach(async () => {
    await backend.close();
  });

  describe('set and get', () => {
    test('should store and retrieve values', async () => {
      await backend.set('test-key', 'test-value', 3600);
      const result = await backend.get('test-key');
      expect(result).toBe('test-value');
    });

    test('should return null for non-existent keys', async () => {
      const result = await backend.get('non-existent-key');
      expect(result).toBeNull();
    });

    test('should overwrite existing values', async () => {
      await backend.set('test-key', 'value1', 3600);
      await backend.set('test-key', 'value2', 3600);
      const result = await backend.get('test-key');
      expect(result).toBe('value2');
    });
  });

  describe('delete', () => {
    test('should delete existing keys', async () => {
      await backend.set('test-key', 'test-value', 3600);
      await backend.delete('test-key');
      const result = await backend.get('test-key');
      expect(result).toBeNull();
    });

    test('should not throw when deleting non-existent keys', async () => {
      await expect(backend.delete('non-existent-key')).resolves.not.toThrow();
    });
  });

  describe('isConnected', () => {
    test('should always return true', () => {
      expect(backend.isConnected()).toBe(true);
    });
  });

  describe('close', () => {
    test('should clear all data', async () => {
      await backend.set('key1', 'value1', 3600);
      await backend.set('key2', 'value2', 3600);
      await backend.close();
      
      const result1 = await backend.get('key1');
      const result2 = await backend.get('key2');
      
      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });
  });

  describe('expiry handling', () => {
    test('should ignore expiry parameter (no auto-expiry in memory)', async () => {
      await backend.set('test-key', 'test-value', 1);
      
      // Wait a bit to ensure expiry would have happened if supported
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should still be available (no expiry in memory backend)
      const result = await backend.get('test-key');
      expect(result).toBe('test-value');
    });
  });
});
