/**
 * Centralized configuration constants
 * Extracted from hardcoded values across codebase
 */

// API Configuration
export const CONFIG = {
  // Request/Response
  REQUEST_TIMEOUT: parseInt(process.env.REQUEST_TIMEOUT, 10) || 30000,
  REQUEST_BODY_LIMIT: process.env.REQUEST_BODY_LIMIT || '10mb',
  CSV_EXPORT_LIMIT: parseInt(process.env.CSV_EXPORT_LIMIT, 10) || 10000,

  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
  CORS_CREDENTIALS: process.env.CORS_CREDENTIALS === 'true',

  // Socket.io
  SOCKET_PING_INTERVAL: parseInt(process.env.SOCKET_PING_INTERVAL, 10) || 30000,
  SOCKET_PING_TIMEOUT: parseInt(process.env.SOCKET_PING_TIMEOUT, 10) || 60000,

  // Redis
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  REDIS_CONNECT_TIMEOUT: parseInt(process.env.REDIS_CONNECT_TIMEOUT, 10) || 5000,
  REDIS_FAMILY: parseInt(process.env.REDIS_FAMILY, 10) || 4,
  REDIS_DB: parseInt(process.env.REDIS_DB, 10) || 0,

  // Redis TTLs (in seconds)
  NUMBER_SOLD_TTL: parseInt(process.env.NUMBER_SOLD_TTL, 10) || 86400, // 24 hours
  SESSION_TTL: parseInt(process.env.SESSION_TTL, 10) || 28800, // 8 hours
  NOTIFICATION_CACHE_TTL: parseInt(process.env.NOTIFICATION_CACHE_TTL, 10) || 300, // 5 minutes

  // Pagination
  DEFAULT_PAGE_LIMIT: parseInt(process.env.DEFAULT_PAGE_LIMIT, 10) || 100,
  MAX_PAGE_LIMIT: parseInt(process.env.MAX_PAGE_LIMIT, 10) || 500,

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  SEARCH_RATE_LIMIT_MAX: parseInt(process.env.SEARCH_RATE_LIMIT_MAX, 10) || 30,

  // API Endpoints
  API_PORT: parseInt(process.env.API_PORT, 10) || 3000,
  WORKER_API_URL: process.env.WORKER_API_URL || 'http://localhost:3000/api/v1',

  // Feature Flags
  ENABLE_COMPRESSION: process.env.ENABLE_COMPRESSION !== 'false',
  ENABLE_SOCKET_POLLING: process.env.ENABLE_SOCKET_POLLING !== 'false',

  // Environment
  NODE_ENV: process.env.NODE_ENV || 'development',
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  IS_DEVELOPMENT: process.env.NODE_ENV === 'development',

  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
};

/**
 * Gets a configuration value with type validation
 * @param {string} key - Config key (e.g., 'REDIS_URL')
 * @param {any} defaultValue - Default value if not found
 * @returns {any} Config value or default
 */
export function getConfig(key, defaultValue) {
  return CONFIG[key] ?? defaultValue;
}

/**
 * Validates that all required config values are set
 * @param {string[]} requiredKeys - Array of required config keys
 * @throws Error if any required key is missing
 */
export function validateConfig(requiredKeys = []) {
  const missing = requiredKeys.filter((key) => !CONFIG[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required config: ${missing.join(', ')}`);
  }
}
