// __tests__/utils/perf-monitor.test.js
jest.mock('../../src/utils/logger', () => ({
  createContextLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  })
}));

const { PerformanceMonitor, perfMonitor, trackPerformance } = require('../../src/utils/perf-monitor');

describe('PerformanceMonitor', () => {
  let monitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
  });

  describe('begin and complete', () => {
    test('should record measurement', () => {
      const id = monitor.begin('test-op');
      
      expect(id).toBeDefined();
      expect(id).toContain('test-op');

      const record = monitor.complete(id);
      
      expect(record).toBeDefined();
      expect(record.label).toBe('test-op');
      expect(record.durationMs).toBeGreaterThanOrEqual(0);
      expect(record.memoryDeltaBytes).toBeDefined();
      expect(record.recordedAt).toBeDefined();
    });

    test('should return null for unknown ID', () => {
      const record = monitor.complete('unknown-id');
      expect(record).toBeNull();
    });

    test('should measure elapsed time', async () => {
      const id = monitor.begin('timing-test');
      await new Promise(resolve => setTimeout(resolve, 50));
      const record = monitor.complete(id);

      expect(record.durationMs).toBeGreaterThanOrEqual(40);
    });

    test('should store multiple measurements with same label', () => {
      const id1 = monitor.begin('multi');
      monitor.complete(id1);

      const id2 = monitor.begin('multi');
      monitor.complete(id2);

      const recordings = monitor.getAllRecordings();
      expect(recordings.multi).toHaveLength(2);
    });
  });

  describe('track', () => {
    test('should measure async function', async () => {
      const fn = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'output';
      };

      const { output, measurement } = await monitor.track('async-fn', fn);

      expect(output).toBe('output');
      expect(measurement.label).toBe('async-fn');
      expect(measurement.durationMs).toBeGreaterThanOrEqual(5);
    });

    test('should propagate errors', async () => {
      const fn = async () => {
        throw new Error('Test error');
      };

      await expect(monitor.track('error-fn', fn)).rejects.toThrow('Test error');
    });

    test('should measure sync operations wrapped in async', async () => {
      const fn = async () => {
        let total = 0;
        for (let i = 0; i < 1000; i++) {
          total += i;
        }
        return total;
      };

      const { output, measurement } = await monitor.track('sync-wrapped', fn);

      expect(output).toBe(499500);
      expect(measurement.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('analyze', () => {
    test('should return null for non-existent label', () => {
      const stats = monitor.analyze('nonexistent');
      expect(stats).toBeNull();
    });

    test('should calculate statistics correctly', async () => {
      // Create measurements with known durations
      for (let i = 0; i < 10; i++) {
        await monitor.track('stats-test', async () => {
          await new Promise(resolve => setTimeout(resolve, Math.random() * 30));
        });
      }

      const stats = monitor.analyze('stats-test');
      
      expect(stats).toBeDefined();
      expect(stats.label).toBe('stats-test');
      expect(stats.sampleCount).toBe(10);
      expect(stats.timing.minMs).toBeGreaterThanOrEqual(0);
      expect(stats.timing.maxMs).toBeGreaterThanOrEqual(stats.timing.minMs);
      expect(stats.timing.meanMs).toBeGreaterThanOrEqual(stats.timing.minMs);
      expect(stats.timing.medianMs).toBeDefined();
      expect(stats.timing.p90Ms).toBeDefined();
      expect(stats.timing.p95Ms).toBeDefined();
      expect(stats.timing.p99Ms).toBeDefined();
      expect(stats.memory).toBeDefined();
      expect(stats.memory.minBytes).toBeDefined();
      expect(stats.memory.maxBytes).toBeDefined();
      expect(stats.memory.avgBytes).toBeDefined();
    });

    test('should calculate percentiles accurately', async () => {
      // Create measurements with controlled durations
      const durations = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      
      for (const duration of durations) {
        const id = monitor.begin('percentile-test');
        await new Promise(resolve => setTimeout(resolve, duration));
        monitor.complete(id);
      }

      const stats = monitor.analyze('percentile-test');
      
      expect(stats.sampleCount).toBe(10);
      expect(stats.timing.minMs).toBeGreaterThanOrEqual(5);
      expect(stats.timing.maxMs).toBeGreaterThanOrEqual(90);
      expect(stats.timing.medianMs).toBeGreaterThanOrEqual(40);
      expect(stats.timing.p95Ms).toBeGreaterThanOrEqual(80);
    });
  });

  describe('getAllRecordings', () => {
    test('should return all recordings', async () => {
      await monitor.track('op1', async () => 'r1');
      await monitor.track('op2', async () => 'r2');

      const recordings = monitor.getAllRecordings();
      
      expect(recordings).toHaveProperty('op1');
      expect(recordings).toHaveProperty('op2');
      expect(recordings.op1).toHaveLength(1);
      expect(recordings.op2).toHaveLength(1);
    });

    test('should return empty object when no recordings', () => {
      const recordings = monitor.getAllRecordings();
      expect(recordings).toEqual({});
    });
  });

  describe('summarize', () => {
    test('should return stats for all labels', async () => {
      await monitor.track('sum1', async () => 'a');
      await monitor.track('sum2', async () => 'b');

      const summary = monitor.summarize();
      
      expect(summary).toHaveProperty('sum1');
      expect(summary).toHaveProperty('sum2');
      expect(summary.sum1.sampleCount).toBe(1);
      expect(summary.sum2.sampleCount).toBe(1);
    });
  });

  describe('report', () => {
    test('should generate text report', async () => {
      for (let i = 0; i < 3; i++) {
        await monitor.track('report-test', async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
        });
      }

      const report = monitor.report();
      
      expect(report).toContain('Performance Monitor Report');
      expect(report).toContain('report-test');
      expect(report).toContain('Samples: 3');
      expect(report).toContain('Timing (ms)');
      expect(report).toContain('Min:');
      expect(report).toContain('Max:');
      expect(report).toContain('Mean:');
      expect(report).toContain('Median:');
      expect(report).toContain('P90:');
      expect(report).toContain('P95:');
      expect(report).toContain('P99:');
      expect(report).toContain('Memory delta');
    });

    test('should handle empty report', () => {
      const report = monitor.report();
      expect(report).toContain('Performance Monitor Report');
    });
  });

  describe('_humanBytes', () => {
    test('should format bytes correctly', () => {
      expect(monitor._humanBytes(0)).toBe('0 B');
      expect(monitor._humanBytes(1024)).toBe('1.00 KB');
      expect(monitor._humanBytes(1048576)).toBe('1.00 MB');
      expect(monitor._humanBytes(1073741824)).toBe('1.00 GB');
      expect(monitor._humanBytes(-2048)).toBe('-2.00 KB');
    });
  });

  describe('reset', () => {
    test('should clear all data', async () => {
      await monitor.track('test', async () => 'result');
      
      expect(monitor.analyze('test')).toBeDefined();
      
      monitor.reset();
      
      expect(monitor.analyze('test')).toBeNull();
      expect(monitor.getAllRecordings()).toEqual({});
    });
  });
});

describe('singleton perfMonitor', () => {
  beforeEach(() => {
    perfMonitor.reset();
  });

  test('should be accessible as singleton', () => {
    expect(perfMonitor).toBeInstanceOf(PerformanceMonitor);
  });
});

describe('trackPerformance helper', () => {
  beforeEach(() => {
    perfMonitor.reset();
  });

  test('should use singleton instance', async () => {
    const { output, measurement } = await trackPerformance('helper-test', async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return 'result';
    });

    expect(output).toBe('result');
    expect(measurement.label).toBe('helper-test');
    
    const stats = perfMonitor.analyze('helper-test');
    expect(stats).toBeDefined();
    expect(stats.sampleCount).toBe(1);
  });
});
