// __tests__/utils/reconnection.test.js
const { calculateBackoff, retryWithBackoff } = require('../../src/utils/reconnection');

describe('Reconnection Utilities', () => {
  describe('calculateBackoff', () => {
    test('should calculate exponential backoff', () => {
      const delay0 = calculateBackoff(0, 1000, 60000);
      const delay1 = calculateBackoff(1, 1000, 60000);
      const delay2 = calculateBackoff(2, 1000, 60000);
      
      // Should increase exponentially
      expect(delay0).toBeLessThan(delay1);
      expect(delay1).toBeLessThan(delay2);
    });

    test('should cap at maxDelay', () => {
      const delay = calculateBackoff(10, 1000, 5000);
      expect(delay).toBeLessThanOrEqual(5000 * 1.25); // Max + 25% jitter
    });

    test('should add jitter to delay', () => {
      const delays = [];
      for (let i = 0; i < 10; i++) {
        delays.push(calculateBackoff(3, 1000, 60000));
      }
      
      // All delays should be different due to jitter
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });

    test('should use default values', () => {
      const delay = calculateBackoff(0);
      expect(delay).toBeGreaterThan(0);
      expect(delay).toBeLessThan(2000); // 1000 base + 25% jitter
    });
  });

  describe('retryWithBackoff', () => {
    test('should succeed on first attempt', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      
      const result = await retryWithBackoff(mockFn, 3, 10);
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    test('should retry on failure and eventually succeed', async () => {
      const mockFn = jest.fn()
        .mockRejectedValueOnce(new Error('Attempt 1 failed'))
        .mockRejectedValueOnce(new Error('Attempt 2 failed'))
        .mockResolvedValue('success');
      
      const result = await retryWithBackoff(mockFn, 5, 10);
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    test('should throw error after max attempts', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Always fails'));
      
      await expect(retryWithBackoff(mockFn, 3, 10)).rejects.toThrow('Always fails');
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    test('should use exponential backoff between retries', async () => {
      const mockFn = jest.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValue('success');
      
      const startTime = Date.now();
      await retryWithBackoff(mockFn, 5, 50);
      const elapsed = Date.now() - startTime;
      
      // Should have waited at least some time (2 retries with backoff)
      expect(elapsed).toBeGreaterThan(50);
    });
  });
});
