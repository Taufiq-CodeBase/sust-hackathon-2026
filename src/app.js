'use strict';

// ── MUST BE FIRST — load env before any other module reads process.env ──
require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const { validateEnv, config } = require('./config/env');
const { healthCheck } = require('./controllers/health.controller');
const { analyzeTicket } = require('./controllers/ticket.controller');
const { analyzeLimiter } = require('./middleware/rateLimiter');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { requestLogger } = require('./middleware/requestLogger');
const logger = require('./utils/logger');

// Validate environment variables on startup
validateEnv();

const app = express();

// ─── Security Middleware (OWASP) ─────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: true,
    xFrameOptions: { action: 'deny' },
    noSniff: true,
    referrerPolicy: { policy: 'no-referrer' },
  })
);

// CORS
app.use(
  cors({
    origin: config.allowedOrigins === '*' ? '*' : config.allowedOrigins.split(','),
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// ─── Request Logging ──────────────────────────────────────────────────────────
app.use(requestLogger);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.get('/health', healthCheck);
app.post('/analyze-ticket', analyzeLimiter, analyzeTicket);

// ─── Error Handling ───────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = config.port;
const server = app.listen(PORT, () => {
  logger.info(`QueueStorm Copilot running on port ${PORT}`, {
    environment: config.nodeEnv,
    model: config.openrouter.model,
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});

// Prevent crashes on unhandled rejections
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection', { reason: String(reason) });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message });
  setTimeout(() => process.exit(1), 1000);
});

module.exports = app;