'use strict';

const OpenAI = require('openai');
const { config } = require('./env');

let openaiClient = null;

function getOpenAIClient() {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: config.openai.apiKey,
    });
  }
  return openaiClient;
}

module.exports = { getOpenAIClient };