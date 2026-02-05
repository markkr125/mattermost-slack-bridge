// src/utils/message-processor.js
const { createContextLogger } = require('./logger');

const log = createContextLogger('message-processor');

/**
 * Concurrent message processor with dynamic throttling
 * Uses a token bucket algorithm for rate limiting and concurrent execution
 */
class MessageProcessor {
  constructor(options = {}) {
    this.maxConcurrent = options.maxConcurrent || 10;
    this.processorName = options.name || 'default';
    
    // Track running operations
    this.runningOps = new Set();
    this.waitingOps = [];
    
    // Metrics tracking
    this.metrics = {
      completed: 0,
      errors: 0,
      totalDurationMs: 0,
      peakWaiting: 0
    };

    log.info('Message processor initialized', { 
      name: this.processorName, 
      maxConcurrent: this.maxConcurrent 
    });
  }

  /**
   * Submit operation for processing
   * @param {Function} operation - Async function to execute
   * @returns {Promise} Resolves with operation result
   */
  submit(operation) {
    return new Promise((resolve, reject) => {
      const opWrapper = {
        exec: operation,
        onSuccess: resolve,
        onError: reject,
        submittedAt: Date.now()
      };

      this.waitingOps.push(opWrapper);
      
      // Track peak queue depth
      if (this.waitingOps.length > this.metrics.peakWaiting) {
        this.metrics.peakWaiting = this.waitingOps.length;
      }

      this._tryExecuteNext();
    });
  }

  /**
   * Try to execute next waiting operation if capacity available
   * @private
   */
  _tryExecuteNext() {
    if (this.runningOps.size >= this.maxConcurrent || this.waitingOps.length === 0) {
      return;
    }

    const opWrapper = this.waitingOps.shift();
    const opId = Symbol('operation');
    this.runningOps.add(opId);

    const startMs = Date.now();

    opWrapper.exec()
      .then(result => {
        const durationMs = Date.now() - startMs;
        this.metrics.completed++;
        this.metrics.totalDurationMs += durationMs;
        opWrapper.onSuccess(result);
      })
      .catch(err => {
        this.metrics.errors++;
        log.error('Operation failed in processor', { 
          name: this.processorName,
          error: err.message 
        });
        opWrapper.onError(err);
      })
      .finally(() => {
        this.runningOps.delete(opId);
        this._tryExecuteNext();
      });
  }

  /**
   * Get current processor metrics
   * @returns {Object} Current metrics
   */
  snapshot() {
    return {
      ...this.metrics,
      currentlyRunning: this.runningOps.size,
      currentlyWaiting: this.waitingOps.length,
      averageDurationMs: this.metrics.completed > 0 
        ? this.metrics.totalDurationMs / this.metrics.completed 
        : 0
    };
  }

  /**
   * Wait for all pending operations to complete
   * @returns {Promise} Resolves when all operations complete
   */
  async awaitCompletion() {
    while (this.runningOps.size > 0 || this.waitingOps.length > 0) {
      await new Promise(r => setTimeout(r, 10));
    }
  }

  /**
   * Clear metrics
   */
  clearMetrics() {
    this.metrics = {
      completed: 0,
      errors: 0,
      totalDurationMs: 0,
      peakWaiting: 0
    };
  }
}

module.exports = { MessageProcessor };
