'use strict';

const { getOpenAIClient } = require('../config/openai');
const { config } = require('../config/env');
const { SYSTEM_PROMPT, buildUserMessage } = require('../prompts/investigator.prompt');
const logger = require('../utils/logger');

const VALID_CASE_TYPES = [
  'wrong_transfer',
  'payment_failed',
  'refund_request',
  'duplicate_payment',
  'merchant_settlement_delay',
  'agent_cash_in_issue',
  'phishing_or_social_engineering',
  'other',
];

const VALID_DEPARTMENTS = [
  'customer_support',
  'dispute_resolution',
  'payments_ops',
  'merchant_operations',
  'agent_operations',
  'fraud_risk',
];

const VALID_EVIDENCE_VERDICTS = ['consistent', 'inconsistent', 'insufficient_data'];
const VALID_SEVERITIES = ['low', 'medium', 'high', 'critical'];

/**
 * Calls the LLM and returns raw parsed JSON response
 */
async function callLLM(ticketData) {
  const client = getOpenAIClient();
  const userMessage = buildUserMessage(ticketData);

  const response = await client.chat.completions.create({
    model: config.openai.model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.1, // Low temperature for consistent, factual output
    max_tokens: 1000,
    response_format: { type: 'json_object' }, // Force JSON output
  });

  const rawContent = response.choices[0]?.message?.content;

  if (!rawContent) {
    throw new Error('LLM returned empty response');
  }

  try {
    const parsed = JSON.parse(rawContent);
    return parsed;
  } catch {
    logger.error('Failed to parse LLM response as JSON', { rawContent });
    throw new Error('LLM returned non-JSON response');
  }
}

/**
 * Validates and normalizes the LLM output to ensure schema compliance.
 * Acts as a safety net if LLM returns slightly off values.
 */
function validateAndNormalizeLLMOutput(llmOutput, ticketId) {
  const errors = [];

  // Ensure ticket_id matches
  const result = { ...llmOutput };
  result.ticket_id = ticketId; // Always override with correct ticket_id

  // Validate and default case_type
  if (!VALID_CASE_TYPES.includes(result.case_type)) {
    logger.warn(`Invalid case_type from LLM: ${result.case_type}, defaulting to 'other'`);
    result.case_type = 'other';
    errors.push('case_type_defaulted');
  }

  // Validate and default department
  if (!VALID_DEPARTMENTS.includes(result.department)) {
    logger.warn(`Invalid department from LLM: ${result.department}, defaulting to 'customer_support'`);
    result.department = 'customer_support';
    errors.push('department_defaulted');
  }

  // Validate evidence_verdict
  if (!VALID_EVIDENCE_VERDICTS.includes(result.evidence_verdict)) {
    logger.warn(`Invalid evidence_verdict: ${result.evidence_verdict}, defaulting to 'insufficient_data'`);
    result.evidence_verdict = 'insufficient_data';
    errors.push('evidence_verdict_defaulted');
  }

  // Validate severity
  if (!VALID_SEVERITIES.includes(result.severity)) {
    logger.warn(`Invalid severity: ${result.severity}, defaulting to 'medium'`);
    result.severity = 'medium';
    errors.push('severity_defaulted');
  }

  // Ensure relevant_transaction_id is string or null
  if (
    result.relevant_transaction_id !== null &&
    result.relevant_transaction_id !== undefined &&
    typeof result.relevant_transaction_id !== 'string'
  ) {
    result.relevant_transaction_id = String(result.relevant_transaction_id);
  }
  if (result.relevant_transaction_id === undefined) {
    result.relevant_transaction_id = null;
  }

  // Ensure human_review_required is boolean
  if (typeof result.human_review_required !== 'boolean') {
    result.human_review_required = true; // Default to true for safety
    errors.push('human_review_defaulted');
  }

  // Ensure confidence is a number between 0 and 1
  if (typeof result.confidence !== 'number' || result.confidence < 0 || result.confidence > 1) {
    result.confidence = 0.5;
  }

  // Ensure reason_codes is an array
  if (!Array.isArray(result.reason_codes)) {
    result.reason_codes = [];
  }

  // Ensure required string fields are present
  const requiredStrings = ['agent_summary', 'recommended_next_action', 'customer_reply'];
  for (const field of requiredStrings) {
    if (!result[field] || typeof result[field] !== 'string' || result[field].trim() === '') {
      result[field] = `Unable to generate ${field}. Please review manually.`;
      errors.push(`${field}_missing`);
    }
  }

  if (errors.length > 0) {
    logger.warn('LLM output required normalization', { errors, ticketId });
  }

  return result;
}

module.exports = { callLLM, validateAndNormalizeLLMOutput };