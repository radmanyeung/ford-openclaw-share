#!/usr/bin/env node
/**
 * API Error Classes
 */

export class APIError extends Error {
  constructor(message, status, data, code) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.data = data;
    this.code = code;
  }
}

export class RateLimitError extends APIError {
  constructor(message, limit, remaining, resetAfter) {
    super(message, 429, { limit, remaining, resetAfter });
    this.name = 'RateLimitError';
    this.limit = limit;
    this.remaining = remaining;
    this.resetAfter = resetAfter;
  }
}

export class AuthError extends APIError {
  constructor(message, data) {
    super(message, 401, data);
    this.name = 'AuthError';
  }
}

export class ValidationError extends APIError {
  constructor(message, errors) {
    super(message, 400, { errors });
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

export class NetworkError extends Error {
  constructor(message, originalError) {
    super(message);
    this.name = 'NetworkError';
    this.originalError = originalError;
  }
}

// Error handler wrapper
export async function withErrorHandling(fn) {
  try {
    return await fn();
  } catch (error) {
    if (error.status) {
      // API error
      if (error.status === 401) {
        throw new AuthError(error.message, error.data);
      }
      if (error.status === 429) {
        const resetAfter = error.data?.resetAfter || 60;
        throw new RateLimitError(error.message, error.data?.limit, 0, resetAfter);
      }
      if (error.status === 400) {
        throw new ValidationError(error.message, error.data);
      }
      throw new APIError(error.message, error.status, error.data);
    }
    if (error.name === 'AbortError') {
      throw new NetworkError('Request timeout', error);
    }
    throw new NetworkError(error.message, error);
  }
}
