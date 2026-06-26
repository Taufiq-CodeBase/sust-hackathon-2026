'use strict';

const requiredEnvVars = ['OPENROUTER_API_KEY'];

function validateEnv() {
  const missing = requiredEnvVars.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    model: process.env.OPENROUTER_MODEL || 'gpt-oss-120b-free',
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  },
  allowedOrigins: process.env.ALLOWED_ORIGINS || '*',
};

module.exports = { config, validateEnv };