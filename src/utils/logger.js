'use strict';

const winston = require('winston');

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Scrubs sensitive keys from log objects before writing.
 * OWASP A09: Security Logging — never log secrets.
 */
const sensitiveKeys = ['apikey', 'api_key', 'password', 'token', 'secret', 'authorization', 'openrouter_api_key'];

function scrubSensitive(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const clone = Array.isArray(obj) ? [...obj] : { ...obj };
  for (const key of Object.keys(clone)) {
    if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk))) {
      clone[key] = '[REDACTED]';
    } else if (typeof clone[key] === 'object') {
      clone[key] = scrubSensitive(clone[key]);
    }
  }
  return clone;
}

const scrubFormat = winston.format((info) => {
  return scrubSensitive(info);
});

const logger = winston.createLogger({
  level: isDev ? 'debug' : 'warn',
  format: winston.format.combine(
    scrubFormat(),
    winston.format.timestamp(),
    winston.format.errors({ stack: false }), // Never log stack traces
    isDev
      ? winston.format.combine(winston.format.colorize(), winston.format.simple())
      : winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
  ],
});

module.exports = logger;