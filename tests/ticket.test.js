'use strict';

process.env.OPENAI_API_KEY = 'test-key';
process.env.NODE_ENV = 'test';

const request = require('supertest');

// Mock the investigation service to avoid real LLM calls in tests
jest.mock('../src/services/investigation.service', () => ({
  investigateTicket: jest.fn().mockResolvedValue({
    ticket_id: 'TKT-001',
    relevant_transaction_id: 'TXN-9101',
    evidence_verdict: 'consistent',
    case_type: 'wrong_transfer',
    severity: 'high',
    department: 'dispute_resolution',
    agent_summary: 'Customer reports sending 5000 BDT to wrong number via TXN-9101.',
    recommended_next_action: 'Verify TXN-9101 in payment system and initiate dispute workflow.',
    customer_reply:
      'We have noted your concern regarding transaction TXN-9101. Our team will investigate and update you within 24-48 hours through official channels.',
    human_review_required: true,
    confidence: 0.9,
    reason_codes: ['wrong_transfer', 'transaction_match'],
  }),
}));

const app = require('../src/app');

const validTicket = {
  ticket_id: 'TKT-001',
  complaint: 'I sent 5000 taka to a wrong number around 2pm today',
  language: 'en',
  channel: 'in_app_chat',
  user_type: 'customer',
  campaign_context: 'boishakh_bonanza_day_1',
  transaction_history: [
    {
      transaction_id: 'TXN-9101',
      timestamp: '2026-04-14T14:08:22Z',
      type: 'transfer',
      amount: 5000,
      counterparty: '+8801719876543',
      status: 'completed',
    },
  ],
};

describe('POST /analyze-ticket', () => {
  test('should return 200 with valid ticket', async () => {
    const response = await request(app).post('/analyze-ticket').send(validTicket);
    expect(response.status).toBe(200);
    expect(response.body.ticket_id).toBe('TKT-001');
    expect(response.body.evidence_verdict).toBeDefined();
    expect(response.body.case_type).toBeDefined();
    expect(response.body.department).toBeDefined();
  });

  test('should return 400 with missing ticket_id', async () => {
    const invalid = { ...validTicket };
    delete invalid.ticket_id;
    const response = await request(app).post('/analyze-ticket').send(invalid);
    expect(response.status).toBe(400);
  });

  test('should return 400 with missing complaint', async () => {
    const invalid = { ...validTicket };
    delete invalid.complaint;
    const response = await request(app).post('/analyze-ticket').send(invalid);
    expect(response.status).toBe(400);
  });

  test('should return 400 with invalid JSON', async () => {
    const response = await request(app)
      .post('/analyze-ticket')
      .set('Content-Type', 'application/json')
      .send('{ invalid json }');
    expect(response.status).toBe(400);
  });

  test('should return 400 with invalid enum value in transaction type', async () => {
    const invalid = {
      ...validTicket,
      transaction_history: [
        { ...validTicket.transaction_history[0], type: 'invalid_type' },
      ],
    };
    const response = await request(app).post('/analyze-ticket').send(invalid);
    expect(response.status).toBe(400);
  });

  test('should not crash on empty transaction history', async () => {
    const withEmpty = { ...validTicket, transaction_history: [] };
    const response = await request(app).post('/analyze-ticket').send(withEmpty);
    expect(response.status).toBe(200);
  });

  test('should not crash when transaction_history is omitted', async () => {
    const withoutHistory = { ticket_id: 'TKT-002', complaint: 'My payment failed' };
    const response = await request(app).post('/analyze-ticket').send(withoutHistory);
    expect(response.status).toBe(200);
  });

  test('should echo ticket_id in response', async () => {
    const response = await request(app).post('/analyze-ticket').send(validTicket);
    expect(response.body.ticket_id).toBe(validTicket.ticket_id);
  });
});

describe('Route error handling', () => {
  test('should return 404 for unknown routes', async () => {
    const response = await request(app).get('/unknown-route');
    expect(response.status).toBe(404);
  });

  test('should return 404 for GET /analyze-ticket', async () => {
    const response = await request(app).get('/analyze-ticket');
    expect(response.status).toBe(404);
  });
});