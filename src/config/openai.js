'use strict';

const OpenAI = require('openai');
const { config } = require('./env');

let openrouterClient = null;

/**
 * Returns a singleton OpenAI-compatible client pointed at OpenRouter.
 * OpenRouter is fully OpenAI SDK compatible — same methods, different baseURL.
 */
function getOpenAIClient() {
  if (!openrouterClient) {
    openrouterClient = new OpenAI({
      apiKey: config.openrouter.apiKey,
      baseURL: config.openrouter.baseURL,
      defaultHeaders: {
        // OpenRouter recommends these headers for tracking/routing
        'HTTP-Referer': 'https://queuestorm-copilot.app',
        'X-Title': 'QueueStorm Copilot',
      },
    });
  }
  return openrouterClient;
}

module.exports = { getOpenAIClient };