// src/utils/logger.js
// Custom logging utility with contextual information
const winston = require('winston');

const logLevelPriority = {
  error: 0,
  warn: 1, 
  info: 2,
  debug: 3
};

const customFormat = winston.format.printf(({ level, message, timestamp, context, ...metadata }) => {
  let logLine = `[${timestamp}] ${level.toUpperCase()}`;
  
  if (context) {
    logLine += ` [${context}]`;
  }
  
  logLine += `: ${message}`;
  
  if (Object.keys(metadata).length > 0) {
    logLine += ` ${JSON.stringify(metadata)}`;
  }
  
  return logLine;
});

const loggerInstance = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels: logLevelPriority,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    customFormat
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        customFormat
      )
    })
  ]
});

// Factory function to create context-aware loggers
function createContextLogger(contextName) {
  return {
    error: (msg, meta = {}) => loggerInstance.error(msg, { context: contextName, ...meta }),
    warn: (msg, meta = {}) => loggerInstance.warn(msg, { context: contextName, ...meta }),
    info: (msg, meta = {}) => loggerInstance.info(msg, { context: contextName, ...meta }),
    debug: (msg, meta = {}) => loggerInstance.debug(msg, { context: contextName, ...meta })
  };
}

module.exports = { createContextLogger, loggerInstance };
