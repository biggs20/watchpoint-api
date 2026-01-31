/**
 * Logger Utility
 * Centralized logging with different levels and formats
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL?.toUpperCase()] ?? LOG_LEVELS.INFO;

/**
 * Format log message with timestamp
 * @param {string} level
 * @param {string} message
 * @param {Object} meta
 * @returns {string}
 */
const formatMessage = (level, message, meta = {}) => {
  const timestamp = new Date().toISOString();
  const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta) : '';
  return `[${timestamp}] [${level}] ${message} ${metaStr}`.trim();
};

/**
 * Log error message
 * @param {string} message
 * @param {Object} meta - Additional context
 */
const error = (message, meta = {}) => {
  if (currentLevel >= LOG_LEVELS.ERROR) {
    console.error(formatMessage('ERROR', message, meta));
  }
};

/**
 * Log warning message
 * @param {string} message
 * @param {Object} meta
 */
const warn = (message, meta = {}) => {
  if (currentLevel >= LOG_LEVELS.WARN) {
    console.warn(formatMessage('WARN', message, meta));
  }
};

/**
 * Log info message
 * @param {string} message
 * @param {Object} meta
 */
const info = (message, meta = {}) => {
  if (currentLevel >= LOG_LEVELS.INFO) {
    console.log(formatMessage('INFO', message, meta));
  }
};

/**
 * Log debug message
 * @param {string} message
 * @param {Object} meta
 */
const debug = (message, meta = {}) => {
  if (currentLevel >= LOG_LEVELS.DEBUG) {
    console.log(formatMessage('DEBUG', message, meta));
  }
};

module.exports = {
  error,
  warn,
  info,
  debug,
  LOG_LEVELS,
};
