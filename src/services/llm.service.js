'use strict';

const { getOpenAIClient } = require('../config/openai');
const { config } = require('../config/env');
const { SYSTEM_PROMPT, buildUserMessage } = require('../prompts/investigator.prompt');
const logger = require('../utils/logger');

const VALID_CASE_TYPES = [
  'wrong_transfer', 'payment_failed', 'refund_request', 'duplicate_payment',
  'merchant_settlement_delay', 'agent_cash_in_issue', 'phishing_or_social_engineering', 'other',
];
const VALID_DEPARTMENTS = [
  'customer_support', 'dispute_resolution', 'payments_ops',
  'merchant_operations', 'agent_operations', 'fraud_risk',
];
const VALID_EVIDENCE_VERDICTS = ['consistent', 'inconsistent', 'insufficient_data'];
const VALID_SEVERITIES = ['low', 'medium', 'high', 'critical'];

function extractJSON(rawContent) {
  if (!rawContent || typeof rawContent !== 'string') {
    throw new Error('Empty or invalid content from LLM');
  }
  const trimmed = rawContent.trim();
  if (trimmed.startsWith('{')) return JSON.parse(trimmed);

  const codeBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) return JSON.parse(codeBlock[1].trim());

  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first !== -1 && last > first) return JSON.parse(trimmed.substring(first, last + 1));

  throw new Error(`Cannot extract JSON. Raw: ${trimmed.substring(0, 300)}`);
}

async function callLLM(ticketData) {
  const client = getOpenAIClient();
  const userMessage = buildUserMessage(ticketData);
  const model = config.openrouter.model;

  logger.info('Calling OpenRouter', { model, ticketId: ticketData.ticket_id });

  const basePayload = {
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.1,
    max_tokens: 1200,
  };

  let response;
  try {
    // Try JSON mode first
    response = await client.chat.completions.create({ ...basePayload, response_format: { type: 'json_object' } });
  } catch (err) {
    if (err.status === 400 && (err.message?.includes('response_format') || err.message?.includes('json'))) {
      logger.warn('JSON mode not supported, retrying without it', { model });
      response = await client.chat.completions.create(basePayload);
    } else {
      // 🔍 Log the exact OpenRouter error
      console.error('🚨 OPENROUTER API ERROR:', err.message);
      if (err.status) console.error('Status:', err.status);
      throw err;
    }
  }

  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error('LLM returned empty response');

  try {
    return extractJSON(raw);
  } catch (parseErr) {
    console.error('📦 RAW LLM OUTPUT (first 500 chars):', raw.substring(0, 500));
    throw new Error(`LLM JSON parse failed: ${parseErr.message}`);
  }
}

function validateAndNormalizeLLMOutput(llmOutput, ticketId) {
  const errors = [];
  const result = { ...llmOutput };
  result.ticket_id = ticketId;

  if (!VALID_CASE_TYPES.includes(result.case_type)) {
    result.case_type = 'other';
    errors.push('case_type_defaulted');
  }
  if (!VALID_DEPARTMENTS.includes(result.department)) {
    result.department = 'customer_support';
    errors.push('department_defaulted');
  }
  if (!VALID_EVIDENCE_VERDICTS.includes(result.evidence_verdict)) {
    result.evidence_verdict = 'insufficient_data';
    errors.push('evidence_verdict_defaulted');
  }
  if (!VALID_SEVERITIES.includes(result.severity)) {
    result.severity = 'medium';
    errors.push('severity_defaulted');
  }

  if (result.relevant_transaction_id === undefined || result.relevant_transaction_id === '') {
    result.relevant_transaction_id = null;
  } else if (typeof result.relevant_transaction_id !== 'string') {
    result.relevant_transaction_id = String(result.relevant_transaction_id);
  }

  if (typeof result.human_review_required !== 'boolean') result.human_review_required = true;
  if (typeof result.confidence !== 'number' || result.confidence < 0 || result.confidence > 1) result.confidence = 0.5;
  if (!Array.isArray(result.reason_codes)) result.reason_codes = [];

  ['agent_summary', 'recommended_next_action', 'customer_reply'].forEach(field => {
    if (!result[field] || typeof result[field] !== 'string' || result[field].trim() === '') {
      result[field] = `Unable to generate ${field.replace(/_/g, ' ')}. Please review manually.`;
      errors.push(`${field}_missing`);
    }
  });

  if (errors.length > 0) logger.warn('LLM output normalized', { errors, ticketId });
  return result;
}

module.exports = { callLLM, validateAndNormalizeLLMOutput };