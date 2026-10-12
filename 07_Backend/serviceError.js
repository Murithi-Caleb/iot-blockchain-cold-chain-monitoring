'use strict';

// Error type for expected, user-facing failures in the application services
// (blockchain/ and coldchain/). Routes translate the `code` into an HTTP status.
class ServiceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
  }
}

// Codes not listed here map to 400 Bad Request.
const STATUS_BY_CODE = Object.freeze({
  BATCH_NOT_FOUND: 404,
  EVENT_NOT_FOUND: 404,
  PROFILE_NOT_FOUND: 404,
  EVENT_NOT_RESOLVED: 409
});

function statusForServiceError(error) {
  return STATUS_BY_CODE[error.code] || 400;
}

module.exports = { STATUS_BY_CODE, ServiceError, statusForServiceError };
