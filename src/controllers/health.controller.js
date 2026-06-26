'use strict';

/**
 * GET /health
 * Returns service health status.
 * Must respond within 60 seconds of service start.
 */
function healthCheck(req, res) {
  return res.status(200).json({ status: 'ok' });
}

module.exports = { healthCheck };