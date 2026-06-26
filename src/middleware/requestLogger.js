'use strict';

const morgan = require('morgan');
const logger = require('../utils/logger');

// Custom Morgan stream that writes to Winston
const stream = {
  write: (message) => {
    logger.info(message.trim(), { source: 'http' });
  },
};

// Scrub sensitive fields from request logs
morgan.token('scrubbed-body', (req) => {
  if (!req.body) return '';
  const scrubbed = { ...req.body };
  // Never log the complaint text in production (could contain sensitive info)
  if (scrubbed.complaint) scrubbed.complaint = '[REDACTED]';
  return JSON.stringify(scrubbed);
});

const requestLogger = morgan(
  ':method :url :status :response-time ms - :res[content-length]',
  { stream }
);

module.exports = { requestLogger };