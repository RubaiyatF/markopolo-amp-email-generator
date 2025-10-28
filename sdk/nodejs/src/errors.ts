/**
 * Error classes for AMP Email SDK
 */

export class AMPEmailError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'AMPEmailError';
    Object.setPrototypeOf(this, AMPEmailError.prototype);
  }
}

export class AuthenticationError extends AMPEmailError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401);
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

export class RateLimitError extends AMPEmailError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429);
    this.name = 'RateLimitError';
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

export class ValidationError extends AMPEmailError {
  constructor(message: string = 'Request validation failed') {
    super(message, 400);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}
