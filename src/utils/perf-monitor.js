// src/utils/perf-monitor.js
const { createContextLogger } = require('./logger');

const log = createContextLogger('perf-monitor');

/**
 * Performance monitoring using event-based tracking
 */
class PerformanceMonitor {
  constructor() {
    this.recordings = new Map();
    this.ongoingMeasurements = new Map();
  }

  /**
   * Begin performance measurement
   * @param {string} label - Measurement label
   * @returns {string} Measurement identifier
   */
  begin(label) {
    const measurementId = `${label}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    
    this.ongoingMeasurements.set(measurementId, {
      label,
      startNano: process.hrtime.bigint(),
      memBefore: process.memoryUsage()
    });
    
    return measurementId;
  }

  /**
   * Complete performance measurement
   * @param {string} measurementId - ID from begin()
   * @returns {Object} Measurement data
   */
  complete(measurementId) {
    const measurement = this.ongoingMeasurements.get(measurementId);
    
    if (!measurement) {
      log.warn('Unknown measurement ID', { measurementId });
      return null;
    }

    const endNano = process.hrtime.bigint();
    const memAfter = process.memoryUsage();

    const record = {
      label: measurement.label,
      durationMs: Number(endNano - measurement.startNano) / 1e6,
      memoryDeltaBytes: memAfter.heapUsed - measurement.memBefore.heapUsed,
      recordedAt: new Date().toISOString()
    };

    // Store by label
    if (!this.recordings.has(measurement.label)) {
      this.recordings.set(measurement.label, []);
    }
    this.recordings.get(measurement.label).push(record);

    this.ongoingMeasurements.delete(measurementId);

    return record;
  }

  /**
   * Wrap async function with automatic measurement
   * @param {string} label - Measurement label  
   * @param {Function} asyncFn - Function to measure
   * @returns {Promise} Function result with measurement data
   */
  async track(label, asyncFn) {
    const measurementId = this.begin(label);
    let fnOutput;
    let thrownError;

    try {
      fnOutput = await asyncFn();
    } catch (err) {
      thrownError = err;
    }

    const measurement = this.complete(measurementId);

    if (thrownError) {
      throw thrownError;
    }

    return {
      output: fnOutput,
      measurement
    };
  }

  /**
   * Compute statistics for a label
   * @param {string} label - Label to analyze
   * @returns {Object} Statistical summary
   */
  analyze(label) {
    const records = this.recordings.get(label);
    
    if (!records || records.length === 0) {
      return null;
    }

    const durations = records.map(r => r.durationMs);
    const memDeltas = records.map(r => r.memoryDeltaBytes);

    const sortedDurations = [...durations].sort((a, b) => a - b);

    const percentile = (arr, pct) => {
      const idx = Math.ceil(arr.length * pct) - 1;
      return arr[Math.max(0, idx)];
    };

    return {
      label,
      sampleCount: records.length,
      timing: {
        minMs: Math.min(...durations),
        maxMs: Math.max(...durations),
        meanMs: durations.reduce((sum, v) => sum + v, 0) / durations.length,
        medianMs: percentile(sortedDurations, 0.5),
        p90Ms: percentile(sortedDurations, 0.9),
        p95Ms: percentile(sortedDurations, 0.95),
        p99Ms: percentile(sortedDurations, 0.99)
      },
      memory: {
        minBytes: Math.min(...memDeltas),
        maxBytes: Math.max(...memDeltas),
        avgBytes: memDeltas.reduce((sum, v) => sum + v, 0) / memDeltas.length
      }
    };
  }

  /**
   * Get all recorded data
   * @returns {Object} All recordings
   */
  getAllRecordings() {
    const output = {};
    for (const [label, records] of this.recordings.entries()) {
      output[label] = records;
    }
    return output;
  }

  /**
   * Generate summary statistics for all labels
   * @returns {Object} All statistics
   */
  summarize() {
    const summary = {};
    for (const label of this.recordings.keys()) {
      summary[label] = this.analyze(label);
    }
    return summary;
  }

  /**
   * Create text report
   * @returns {string} Formatted report
   */
  report() {
    const summary = this.summarize();
    const lines = ['', '╔════════════════════════════════════╗'];
    lines.push('║    Performance Monitor Report      ║');
    lines.push('╚════════════════════════════════════╝', '');

    for (const [label, stats] of Object.entries(summary)) {
      if (!stats) continue;

      lines.push(`📊 ${label}`);
      lines.push(`   Samples: ${stats.sampleCount}`);
      lines.push(`   Timing (ms):`);
      lines.push(`     Min:    ${stats.timing.minMs.toFixed(3)}`);
      lines.push(`     Max:    ${stats.timing.maxMs.toFixed(3)}`);
      lines.push(`     Mean:   ${stats.timing.meanMs.toFixed(3)}`);
      lines.push(`     Median: ${stats.timing.medianMs.toFixed(3)}`);
      lines.push(`     P90:    ${stats.timing.p90Ms.toFixed(3)}`);
      lines.push(`     P95:    ${stats.timing.p95Ms.toFixed(3)}`);
      lines.push(`     P99:    ${stats.timing.p99Ms.toFixed(3)}`);
      lines.push(`   Memory delta:`);
      lines.push(`     Min: ${this._humanBytes(stats.memory.minBytes)}`);
      lines.push(`     Max: ${this._humanBytes(stats.memory.maxBytes)}`);
      lines.push(`     Avg: ${this._humanBytes(stats.memory.avgBytes)}`);
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Format bytes as human-readable
   * @private
   */
  _humanBytes(bytes) {
    const absBytes = Math.abs(bytes);
    const sign = bytes < 0 ? '-' : '';
    
    if (absBytes === 0) return '0 B';
    
    const units = ['B', 'KB', 'MB', 'GB'];
    const exponent = Math.min(Math.floor(Math.log(absBytes) / Math.log(1024)), units.length - 1);
    const value = absBytes / Math.pow(1024, exponent);
    
    return `${sign}${value.toFixed(2)} ${units[exponent]}`;
  }

  /**
   * Clear all data
   */
  reset() {
    this.recordings.clear();
    this.ongoingMeasurements.clear();
    log.info('Performance monitor reset');
  }
}

// Singleton for convenience
const perfMonitor = new PerformanceMonitor();

/**
 * Quick helper for tracking
 */
async function trackPerformance(label, asyncFn) {
  return perfMonitor.track(label, asyncFn);
}

module.exports = {
  PerformanceMonitor,
  perfMonitor,
  trackPerformance
};
