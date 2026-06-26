'use strict';

const rateLimit = require('express-rate-limit');
const { config } = require('../config/env');

const analyzeLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  // Must return valid JSON matching expected error shape
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests. Please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
    });
  },
  skip: (req) => req.path === '/health',
});

module.exports = { analyzeLimiter };