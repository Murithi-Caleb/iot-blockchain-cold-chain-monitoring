'use strict';

// Error type for expected, user-facing failures in the application services
// (blockchain/ and coldchain/). Routes translate the `code` into an HTTP status.
class ServiceError extends Error {
  // `details` is optional structured data that is safe to show the caller (for example the
  // list of failed checks).
  constructor(code, message, details) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

// Codes not listed here map to 400 Bad Request.
const STATUS_BY_CODE = Object.freeze({
  BATCH_NOT_FOUND: 404,
  EVENT_NOT_FOUND: 404,
  PROFILE_NOT_FOUND: 404,
  DECISION_NOT_FOUND: 404,
  EVENT_NOT_RESOLVED: 409,
  DECISION_EXISTS: 409,
  NOT_ELIGIBLE: 409
});

function statusForServiceError(error) {
  return STATUS_BY_CODE[error.code] || 400;
}

module.exports = { STATUS_BY_CODE, ServiceError, statusForServiceError };
