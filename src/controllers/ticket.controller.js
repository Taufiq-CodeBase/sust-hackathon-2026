'use strict';

const { validateTicketRequest } = require('../validators/ticket.validator');
const { investigateTicket } = require('../services/investigation.service');
const { sanitizeRequestBody } = require('../utils/sanitizer');
const logger = require('../utils/logger');

async function analyzeTicket(req, res) {
  try {
    // 1. Sanitize
    const sanitizedBody = sanitizeRequestBody(req.body);

    // 2. Validate
    const { success, data, errors } = validateTicketRequest(sanitizedBody);
    if (!success) {
      logger.warn('Invalid request schema', { errors });
      return res.status(400).json({
        error: 'Invalid request schema',
        code: 'SCHEMA_VALIDATION_FAILED',
        details: errors,
      });
    }

    // 3. Semantic check
    if (!data.complaint || data.complaint.trim().length === 0) {
      return res.status(422).json({
        error: 'Complaint field cannot be empty',
        code: 'EMPTY_COMPLAINT',
      });
    }

    // 4. Investigate
    const result = await investigateTicket(data);
    return res.status(200).json(result);

  } catch (error) {
    // 🔍 PRINT EXACT ERROR TO CONSOLE FOR DEBUGGING
    console.error('❌ TICKET ANALYSIS FAILED:');
    console.error('Message:', error.message);
    console.error('Name:', error.name);
    if (error.status) console.error('HTTP Status:', error.status);
    if (error.stack) console.error('Stack:', error.stack);

    logger.error('Error in analyzeTicket controller', {
      error: error.message,
      ticketId: req.body?.ticket_id || 'unknown',
    });

    return res.status(500).json({
      error: 'Failed to analyze ticket. Please try again.',
      code: 'ANALYSIS_FAILED',
    });
  }
}

module.exports = { analyzeTicket };