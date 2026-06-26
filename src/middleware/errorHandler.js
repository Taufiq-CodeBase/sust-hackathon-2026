'use strict';

const logger = require('../utils/logger');

/**
 * Global error handler middleware.
 * OWASP A09: Security Logging and Monitoring
 * OWASP A05: Security Misconfiguration (no stack trace leakage)
 */
function errorHandler(err, req, res, next) {
  // Log the full error internally
  logger.error('Unhandled error', {
    message: err.message,
    path: req.path,
    method: req.method,
    ticketId: req.body?.ticket_id || 'unknown',
  });

  // Never expose stack traces, tokens, or internal details externally
  const isProduction = process.env.NODE_ENV === 'production';

  if (err.name === 'SyntaxError' && err.status === 400) {
    return res.status(400).json({
      error: 'Invalid JSON in request body',
      code: 'INVALID_JSON',
    });
  }

  if (err.status === 413) {
    return res.status(413).json({
      error: 'Request body too large',
      code: 'PAYLOAD_TOO_LARGE',
    });
  }

  // OpenAI specific errors
  if (err.constructor?.name === 'APIError' || err.message?.includes('openai')) {
    return res.status(500).json({
      error: 'AI service temporarily unavailable. Please try again.',
      code: 'AI_SERVICE_ERROR',
    });
  }

  return res.status(500).json({
    error: isProduction
      ? 'An internal error occurred. Please try again.'
      : `Internal error: ${err.message}`,
    code: 'INTERNAL_ERROR',
  });
}

/**
 * 404 handler for unknown routes
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    error: `Route ${req.method} ${req.path} not found`,
    code: 'NOT_FOUND',
  });
}

module.exports = { errorHandler, notFoundHandler };