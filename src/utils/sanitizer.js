'use strict';

/**
 * Sanitizes string input to prevent prompt injection attacks.
 * Removes or neutralizes common injection patterns.
 * OWASP A03: Injection prevention
 */
function sanitizeString(input) {
  if (typeof input !== 'string') return input;

  // Remove null bytes
  let sanitized = input.replace(/\0/g, '');

  // Limit length to prevent token exhaustion attacks
  sanitized = sanitized.substring(0, 5000);

  return sanitized;
}

/**
 * Detects prompt injection attempts in complaint text.
 * Returns true if injection attempt is suspected.
 */
function detectPromptInjection(text) {
  if (typeof text !== 'string') return false;

  const injectionPatterns = [
    /ignore\s+(all\s+)?(previous|above|prior)\s+instructions/i,
    /system\s*:\s*you\s+are/i,
    /\[INST\]/i,
    /<<SYS>>/i,
    /forget\s+(everything|all|your\s+instructions)/i,
    /new\s+instructions?\s*:/i,
    /override\s+(system|instructions?|rules?)/i,
    /you\s+are\s+now\s+(a|an)\s+/i,
    /act\s+as\s+(if\s+you\s+are\s+)?(a|an)\s+/i,
    /pretend\s+(you\s+are|to\s+be)/i,
    /disregard\s+(all\s+)?(previous|prior|your)/i,
    /###\s*(system|instruction)/i,
    /reveal\s+(your\s+)?(system\s+)?prompt/i,
    /print\s+(your\s+)?(system\s+)?prompt/i,
    /show\s+(me\s+)?(your\s+)?(system\s+)?prompt/i,
  ];

  return injectionPatterns.some((pattern) => pattern.test(text));
}

/**
 * Sanitizes the entire request body
 */
function sanitizeRequestBody(body) {
  if (!body || typeof body !== 'object') return body;

  const sanitized = { ...body };

  if (sanitized.complaint) {
    sanitized.complaint = sanitizeString(sanitized.complaint);
  }

  if (sanitized.transaction_history && Array.isArray(sanitized.transaction_history)) {
    sanitized.transaction_history = sanitized.transaction_history.map((tx) => ({
      ...tx,
      counterparty: sanitizeString(tx.counterparty),
    }));
  }

  return sanitized;
}

module.exports = { sanitizeString, detectPromptInjection, sanitizeRequestBody };