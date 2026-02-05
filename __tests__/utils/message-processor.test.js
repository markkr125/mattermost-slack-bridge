// __tests__/utils/message-processor.test.js
jest.mock('../../src/utils/logger', () => ({
  createContextLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  })
}));

const { MessageProcessor } = require('../../src/utils/message-processor');

describe('MessageProcessor', () => {
  let processor;

  beforeEach(() => {
    processor = new MessageProcessor({ maxConcurrent: 3, name: 'test' });
  });

  describe('constructor', () => {
    test('should create with default settings', () => {
      const defaultProc = new MessageProcessor();
      const snapshot = defaultProc.snapshot();
      
      expect(snapshot.currentlyRunning).toBe(0);
      expect(snapshot.currentlyWaiting).toBe(0);
    });

    test('should accept custom configuration', () => {
      expect(processor.maxConcurrent).toBe(3);
      expect(processor.processorName).toBe('test');
    });
  });

  describe('submit', () => {
    test('should process single operation', async () => {
      const op = jest.fn().mockResolvedValue('success');
      const result = await processor.submit(op);
      
      expect(op).toHaveBeenCalled();
      expect(result).toBe('success');
      expect(processor.snapshot().completed).toBe(1);
    });

    test('should handle multiple concurrent operations', async () => {
      const operations = [];
      const completions = [];

      for (let i = 0; i < 5; i++) {
        operations.push(
          processor.submit(async () => {
            await new Promise(resolve => setTimeout(resolve, 30));
            completions.push(i);
            return i;
          })
        );
      }

      const results = await Promise.all(operations);
      
      expect(results).toEqual([0, 1, 2, 3, 4]);
      expect(processor.snapshot().completed).toBe(5);
    });

    test('should respect concurrency limit', async () => {
      const delays = [];
      let concurrentCount = 0;
      let maxConcurrent = 0;

      const createOp = () => async () => {
        concurrentCount++;
        maxConcurrent = Math.max(maxConcurrent, concurrentCount);
        await new Promise(resolve => setTimeout(resolve, 50));
        concurrentCount--;
      };

      const promises = [];
      for (let i = 0; i < 6; i++) {
        promises.push(processor.submit(createOp()));
      }

      await Promise.all(promises);

      expect(maxConcurrent).toBeLessThanOrEqual(3);
      expect(processor.snapshot().completed).toBe(6);
    });

    test('should track errors', async () => {
      const error = new Error('Operation failed');
      const failingOp = jest.fn().mockRejectedValue(error);

      await expect(processor.submit(failingOp)).rejects.toThrow('Operation failed');
      
      expect(processor.snapshot().errors).toBe(1);
      expect(processor.snapshot().completed).toBe(0);
    });

    test('should track peak waiting operations', async () => {
      const blockingOps = [];
      let resolvers = [];

      // Fill processor capacity
      for (let i = 0; i < 3; i++) {
        blockingOps.push(
          processor.submit(() => new Promise(r => resolvers.push(r)))
        );
      }

      // Queue additional ops
      const queuedOps = [];
      for (let i = 0; i < 4; i++) {
        queuedOps.push(processor.submit(async () => 'queued'));
      }

      await new Promise(resolve => setTimeout(resolve, 10));

      const snapshot = processor.snapshot();
      expect(snapshot.peakWaiting).toBeGreaterThanOrEqual(4);

      // Cleanup
      resolvers.forEach(r => r());
      await Promise.all([...blockingOps, ...queuedOps]);
    });
  });

  describe('snapshot', () => {
    test('should return current metrics', async () => {
      await processor.submit(async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
      });

      const snapshot = processor.snapshot();
      
      expect(snapshot).toHaveProperty('completed');
      expect(snapshot).toHaveProperty('errors');
      expect(snapshot).toHaveProperty('totalDurationMs');
      expect(snapshot).toHaveProperty('currentlyRunning');
      expect(snapshot).toHaveProperty('currentlyWaiting');
      expect(snapshot).toHaveProperty('averageDurationMs');
      
      expect(snapshot.completed).toBe(1);
      expect(snapshot.averageDurationMs).toBeGreaterThan(0);
    });

    test('should show zero average when no completions', () => {
      const snapshot = processor.snapshot();
      expect(snapshot.averageDurationMs).toBe(0);
    });
  });

  describe('awaitCompletion', () => {
    test('should wait for all operations to finish', async () => {
      const ops = [];
      
      for (let i = 0; i < 5; i++) {
        ops.push(
          processor.submit(async () => {
            await new Promise(resolve => setTimeout(resolve, 20));
          })
        );
      }

      const completionPromise = processor.awaitCompletion();
      expect(processor.snapshot().currentlyRunning).toBeGreaterThan(0);

      await completionPromise;
      
      const snapshot = processor.snapshot();
      expect(snapshot.currentlyRunning).toBe(0);
      expect(snapshot.currentlyWaiting).toBe(0);
    });

    test('should resolve immediately when already complete', async () => {
      await processor.awaitCompletion();
      expect(processor.snapshot().currentlyRunning).toBe(0);
    });
  });

  describe('clearMetrics', () => {
    test('should reset all metrics', async () => {
      await processor.submit(async () => 'done');
      
      expect(processor.snapshot().completed).toBe(1);
      
      processor.clearMetrics();
      
      const snapshot = processor.snapshot();
      expect(snapshot.completed).toBe(0);
      expect(snapshot.errors).toBe(0);
      expect(snapshot.totalDurationMs).toBe(0);
      expect(snapshot.peakWaiting).toBe(0);
    });
  });
});
