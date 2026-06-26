'use strict';

const logger = require('../utils/logger');

/**
 * Patterns that violate OWASP and financial safety rules.
 * These should NEVER appear in customer_reply or recommended_next_action.
 */
const CREDENTIAL_REQUEST_PATTERNS = [
  /\bPIN\b/i,
  /\bOTP\b/i,
  /\bone.?time.?password\b/i,
  /\bpassword\b/i,
  /\bfull.?card.?number\b/i,
  /\bcvv\b/i,
  /\bsecret.?code\b/i,
  /share\s+(your\s+)?(pin|otp|password|code)/i,
  /provide\s+(your\s+)?(pin|otp|password|credentials)/i,
  /verify\s+(your\s+)?(pin|otp|password)/i,
  /enter\s+(your\s+)?(pin|otp|password)/i,
  /confirm\s+(your\s+)?(pin|otp|password)/i,
  /send\s+(your\s+)?(pin|otp|password)/i,
];

const UNAUTHORIZED_CONFIRMATION_PATTERNS = [
  /we\s+will\s+refund/i,
  /you\s+will\s+(receive|get)\s+(a\s+)?refund/i,
  /your\s+(money|funds?|amount|balance)\s+will\s+be\s+returned/i,
  /we\s+will\s+reverse/i,
  /we\s+will\s+unblock/i,
  /we\s+guarantee\s+(a\s+)?refund/i,
  /account\s+will\s+be\s+unblocked/i,
  /funds?\s+will\s+be\s+recovered/i,
  /we\s+will\s+restore\s+your\s+balance/i,
  /reversal\s+will\s+be\s+processed/i,
  /your\s+account\s+will\s+be\s+restored/i,
];

const THIRD_PARTY_REDIRECT_PATTERNS = [
  /contact\s+(a\s+)?(third.?party|external|outside)/i,
  /call\s+this\s+number(?!\s+for\s+official)/i,
  /visit\s+(this\s+)?(link|url|website|site)\s*:/i,
  /click\s+(here|this\s+link)/i,
  /whatsapp\s+(us|me|at)/i,
  /telegram\s+(us|me|at)/i,
];

/**
 * Safe replacement phrases for dangerous patterns
 */
const SAFE_ALTERNATIVES = {
  credential: 'Our team will verify your account details through secure internal processes.',
  confirmation: 'Any eligible amount will be processed through official channels as per our policies.',
  redirect: 'Please contact us only through our official app, website, or verified customer care numbers.',
};

/**
 * Checks customer_reply for safety violations.
 * Returns { safe: boolean, violations: string[], sanitizedReply: string }
 */
function checkCustomerReplySafety(customerReply) {
  if (!customerReply || typeof customerReply !== 'string') {
    return {
      safe: false,
      violations: ['empty_or_invalid_reply'],
      sanitizedReply: 'We have received your request and our team will review it shortly. Please contact us through official support channels.',
    };
  }

  const violations = [];
  let sanitizedReply = customerReply;

  // Check for credential requests
  for (const pattern of CREDENTIAL_REQUEST_PATTERNS) {
    if (pattern.test(customerReply)) {
      violations.push('credential_request_detected');
      // Remove the offending content
      sanitizedReply = sanitizedReply.replace(pattern, SAFE_ALTERNATIVES.credential);
      logger.warn('Safety violation: credential request detected in customer_reply', {
        pattern: pattern.toString(),
      });
      break; // One log per category is enough
    }
  }

  // Check for unauthorized confirmations
  for (const pattern of UNAUTHORIZED_CONFIRMATION_PATTERNS) {
    if (pattern.test(customerReply)) {
      violations.push('unauthorized_confirmation_detected');
      sanitizedReply = sanitizedReply.replace(pattern, SAFE_ALTERNATIVES.confirmation);
      logger.warn('Safety violation: unauthorized confirmation detected in customer_reply', {
        pattern: pattern.toString(),
      });
      break;
    }
  }

  // Check for third-party redirects
  for (const pattern of THIRD_PARTY_REDIRECT_PATTERNS) {
    if (pattern.test(customerReply)) {
      violations.push('third_party_redirect_detected');
      sanitizedReply = sanitizedReply.replace(pattern, SAFE_ALTERNATIVES.redirect);
      logger.warn('Safety violation: third-party redirect detected in customer_reply', {
        pattern: pattern.toString(),
      });
      break;
    }
  }

  return {
    safe: violations.length === 0,
    violations,
    sanitizedReply,
  };
}

/**
 * Checks recommended_next_action for safety violations.
 */
function checkNextActionSafety(nextAction) {
  if (!nextAction || typeof nextAction !== 'string') {
    return {
      safe: false,
      violations: ['empty_next_action'],
      sanitizedAction: 'Review the case manually and escalate to the appropriate department.',
    };
  }

  const violations = [];
  let sanitizedAction = nextAction;

  // Next actions should never confirm refunds either
  for (const pattern of UNAUTHORIZED_CONFIRMATION_PATTERNS) {
    if (pattern.test(nextAction)) {
      violations.push('unauthorized_confirmation_in_next_action');
      sanitizedAction = sanitizedAction.replace(
        pattern,
        'initiate investigation through official dispute process'
      );
      logger.warn('Safety violation: unauthorized confirmation in recommended_next_action');
      break;
    }
  }

  return {
    safe: violations.length === 0,
    violations,
    sanitizedAction,
  };
}

/**
 * Applies all safety checks to the LLM response and returns a safe version.
 */
function applySafetyChecks(llmResponse) {
  const safeResponse = { ...llmResponse };
  const allViolations = [];

  // Check and sanitize customer_reply
  const replyCheck = checkCustomerReplySafety(safeResponse.customer_reply);
  if (!replyCheck.safe) {
    allViolations.push(...replyCheck.violations);
    safeResponse.customer_reply = replyCheck.sanitizedReply;
  }

  // Check and sanitize recommended_next_action
  const nextActionCheck = checkNextActionSafety(safeResponse.recommended_next_action);
  if (!nextActionCheck.safe) {
    allViolations.push(...nextActionCheck.violations);
    safeResponse.recommended_next_action = nextActionCheck.sanitizedAction;
  }

  // If safety violations were found, flag for human review
  if (allViolations.length > 0) {
    safeResponse.human_review_required = true;
    if (!safeResponse.reason_codes) safeResponse.reason_codes = [];
    safeResponse.reason_codes.push('safety_override_applied');
    logger.error('Safety violations detected and remediated', {
      violations: allViolations,
      ticketId: safeResponse.ticket_id,
    });
  }

  return { safeResponse, violations: allViolations };
}

module.exports = { applySafetyChecks, checkCustomerReplySafety, checkNextActionSafety };