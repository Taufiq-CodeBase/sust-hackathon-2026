'use strict';

const rateLimit = require('express-rate-limit');
const { config } = require('../config/env');

/**
 * Rate limiter for the analyze-ticket endpoint.
 * OWASP A04: Insecure Design - prevents abuse
 */
const analyzeLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests. Please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health';
  },
});

module.exports = { analyzeLimiter };