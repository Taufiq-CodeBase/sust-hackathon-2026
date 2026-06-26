'use strict';

const { validateTicketRequest } = require('../validators/ticket.validator');
const { investigateTicket } = require('../services/investigation.service');
const { sanitizeRequestBody } = require('../utils/sanitizer');
const logger = require('../utils/logger');

/**
 * POST /analyze-ticket
 * Accepts one ticket and returns structured investigation response.
 */
async function analyzeTicket(req, res) {
  try {
    // Step 1: Sanitize raw input (OWASP A03 - Injection prevention)
    const sanitizedBody = sanitizeRequestBody(req.body);

    // Step 2: Validate schema with Zod
    const { success, data, errors } = validateTicketRequest(sanitizedBody);

    if (!success) {
      logger.warn('Invalid request schema', { errors });
      return res.status(400).json({
        error: 'Invalid request schema',
        code: 'SCHEMA_VALIDATION_FAILED',
        details: errors,
      });
    }

    // Step 3: Semantic validation (422 for valid schema but invalid semantics)
    if (!data.complaint || data.complaint.trim().length === 0) {
      return res.status(422).json({
        error: 'Complaint field cannot be empty',
        code: 'EMPTY_COMPLAINT',
      });
    }

    // Step 4: Run investigation
    const result = await investigateTicket(data);

    // Step 5: Return structured response
    return res.status(200).json(result);
  } catch (error) {
    logger.error('Error in analyzeTicket controller', {
      error: error.message,
      ticketId: req.body?.ticket_id || 'unknown',
    });

    // Don't expose internal errors
    return res.status(500).json({
      error: 'Failed to analyze ticket. Please try again.',
      code: 'ANALYSIS_FAILED',
    });
  }
}

module.exports = { analyzeTicket };