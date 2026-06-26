'use strict';

const { z } = require('zod');

const TransactionHistoryEntrySchema = z.object({
  transaction_id: z.string().min(1, 'transaction_id is required'),
  timestamp: z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    { message: 'timestamp must be a valid ISO 8601 date string' }
  ),
  type: z.enum(['transfer', 'payment', 'cash_in', 'cash_out', 'settlement', 'refund']),
  amount: z.number().positive('amount must be a positive number'),
  counterparty: z.string().min(1, 'counterparty is required'),
  status: z.enum(['completed', 'failed', 'pending', 'reversed']),
});

const TicketRequestSchema = z.object({
  ticket_id: z.string().min(1, 'ticket_id is required'),
  complaint: z.string().min(1, 'complaint cannot be empty').max(5000, 'complaint too long'),
  language: z.enum(['en', 'bn', 'mixed']).optional(),
  channel: z.enum(['in_app_chat', 'call_center', 'email', 'merchant_portal', 'field_agent']).optional(),
  user_type: z.enum(['customer', 'merchant', 'agent', 'unknown']).optional(),
  campaign_context: z.string().optional(),
  transaction_history: z.array(TransactionHistoryEntrySchema).optional().default([]),
  metadata: z.object({}).passthrough().optional(),
});

/**
 * Validates the incoming ticket request body.
 * Returns { success, data, errors }
 */
function validateTicketRequest(body) {
  const result = TicketRequestSchema.safeParse(body);

  if (!result.success) {
    const errors = result.error.errors.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
    }));
    return { success: false, data: null, errors };
  }

  return { success: true, data: result.data, errors: [] };
}

module.exports = { validateTicketRequest, TicketRequestSchema };