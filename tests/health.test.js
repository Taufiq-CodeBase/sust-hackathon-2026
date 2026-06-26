'use strict';

const request = require('supertest');

// Mock env before requiring app
process.env.OPENAI_API_KEY = 'test-key';
process.env.NODE_ENV = 'test';

const app = require('../src/app');

describe('GET /health', () => {
  it('should return 200 with status ok', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});