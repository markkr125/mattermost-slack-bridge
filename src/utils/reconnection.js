// src/utils/reconnection.js
const { createContextLogger } = require('./logger');

const log = createContextLogger('reconnection');

/**
 * Calculate exponential backoff delay with jitter
 * @param {number} attempt - Current attempt number (0-based)
 * @param {number} baseDelay - Base delay in ms (default: 1000)
 * @param {number} maxDelay - Maximum delay in ms (default: 60000)
 * @returns {number} Delay in milliseconds
 */
function calculateBackoff(attempt, baseDelay = 1000, maxDelay = 60000) {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  
  // Cap at maxDelay
  const cappedDelay = Math.min(exponentialDelay, maxDelay);
  
  // Add jitter (random 0-25% of the delay)
  const jitter = Math.random() * 0.25 * cappedDelay;
  
  const finalDelay = cappedDelay + jitter;
  
  log.debug('Calculated backoff', { attempt, finalDelay: Math.round(finalDelay) });
  
  return Math.round(finalDelay);
}

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxAttempts - Maximum number of attempts (default: 10)
 * @param {number} baseDelay - Base delay in ms (default: 1000)
 * @returns {Promise<any>} Result of the function
 */
async function retryWithBackoff(fn, maxAttempts = 10, baseDelay = 1000) {
  let lastError;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      
      if (attempt < maxAttempts - 1) {
        const delay = calculateBackoff(attempt, baseDelay);
        log.warn('Retry attempt failed, backing off', { 
          attempt: attempt + 1, 
          maxAttempts, 
          delayMs: delay,
          error: err.message 
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  log.error('All retry attempts failed', { maxAttempts, error: lastError.message });
  throw lastError;
}

module.exports = {
  calculateBackoff,
  retryWithBackoff,
};
