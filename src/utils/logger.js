'use strict';

const winston = require('winston');
const { config } = require('../config/env');

const logger = winston.createLogger({
  level: config.nodeEnv === 'production' ? 'warn' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: false }), // NEVER log stack traces in production
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format:
        config.nodeEnv === 'production'
          ? winston.format.json()
          : winston.format.combine(winston.format.colorize(), winston.format.simple()),
      // Filter out any accidental secret logging
      log(info, callback) {
        // Scrub any accidental API key logging
        const sanitized = JSON.parse(JSON.stringify(info));
        const sensitiveKeys = ['apiKey', 'api_key', 'password', 'token', 'secret', 'authorization'];
        function scrub(obj) {
          if (typeof obj !== 'object' || obj === null) return obj;
          for (const key of Object.keys(obj)) {
            if (sensitiveKeys.some((k) => key.toLowerCase().includes(k))) {
              obj[key] = '[REDACTED]';
            } else if (typeof obj[key] === 'object') {
              scrub(obj[key]);
            }
          }
          return obj;
        }
        scrub(sanitized);
        console.log(JSON.stringify(sanitized));
        callback();
      },
    }),
  ],
});

module.exports = logger;