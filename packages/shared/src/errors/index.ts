/**
 * Custom error classes for DealerBDC
 * Provides typed, semantic errors for better error handling
 */

export class DealerBDCError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
    };
  }
}

// ============================================================
// DEALER ERRORS
// ============================================================

export class DealerNotFoundError extends DealerBDCError {
  constructor(dealerId: string) {
    super(`Dealer not found: ${dealerId}`, 'DEALER_NOT_FOUND', 404, { dealerId });
  }
}

export class DealerInactiveError extends DealerBDCError {
  constructor(dealerId: string) {
    super(`Dealer is not active: ${dealerId}`, 'DEALER_INACTIVE', 403, { dealerId });
  }
}

// ============================================================
// LEAD ERRORS
// ============================================================

export class LeadNotFoundError extends DealerBDCError {
  constructor(leadId: string) {
    super(`Lead not found: ${leadId}`, 'LEAD_NOT_FOUND', 404, { leadId });
  }
}

export class LeadOwnershipError extends DealerBDCError {
  constructor(leadId: string, message: string) {
    super(message, 'LEAD_OWNERSHIP_ERROR', 403, { leadId });
  }
}

// ============================================================
// CALLING ERRORS
// ============================================================

export class CallingWindowError extends DealerBDCError {
  constructor(dealerId: string, reason: string) {
    super(`Cannot call outside calling window: ${reason}`, 'CALLING_WINDOW_ERROR', 400, {
      dealerId,
      reason,
    });
  }
}

export class RateLimitError extends DealerBDCError {
  constructor(dealerId: string, limitType: string) {
    super(`Rate limit exceeded: ${limitType}`, 'RATE_LIMIT_ERROR', 429, {
      dealerId,
      limitType,
    });
  }
}

export class OptOutError extends DealerBDCError {
  constructor(dealerId: string, phone: string) {
    super(`Cannot contact opted-out number: ${phone}`, 'OPT_OUT_ERROR', 403, {
      dealerId,
      phone,
    });
  }
}

export class MaxAttemptsError extends DealerBDCError {
  constructor(leadId: string, maxAttempts: number) {
    super(
      `Maximum call attempts reached for lead: ${leadId}`,
      'MAX_ATTEMPTS_ERROR',
      400,
      { leadId, maxAttempts }
    );
  }
}

// ============================================================
// ROUTING ERRORS
// ============================================================

export class NoRoutingRuleError extends DealerBDCError {
  constructor(dealerId: string, context: Record<string, unknown>) {
    super('No routing rule matches the given context', 'NO_ROUTING_RULE', 404, {
      dealerId,
      context,
    });
  }
}

export class NoAvailableRepError extends DealerBDCError {
  constructor(dealerId: string) {
    super('No available sales rep found for transfer', 'NO_AVAILABLE_REP', 404, { dealerId });
  }
}

// ============================================================
// VALIDATION ERRORS
// ============================================================

export class ValidationError extends DealerBDCError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

// ============================================================
// EXTERNAL SERVICE ERRORS
// ============================================================

export class TwilioError extends DealerBDCError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(`Twilio error: ${message}`, 'TWILIO_ERROR', 500, details);
  }
}

export class VapiError extends DealerBDCError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(`Vapi error: ${message}`, 'VAPI_ERROR', 500, details);
  }
}

export class InngestError extends DealerBDCError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(`Inngest error: ${message}`, 'INNGEST_ERROR', 500, details);
  }
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Check if an error is a DealerBDC error
 */
export function isDealerBDCError(error: unknown): error is DealerBDCError {
  return error instanceof DealerBDCError;
}

/**
 * Format error for logging
 */
export function formatError(error: unknown): Record<string, unknown> {
  if (isDealerBDCError(error)) {
    return error.toJSON();
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    message: String(error),
  };
}
