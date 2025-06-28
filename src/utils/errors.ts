export interface ErrorResponse {
  error: string;
  code: number;
  message: string;
  details?: any;
  timestamp: string;
  requestId?: string;
}

export enum ErrorCode {
  // Client errors (4xx)
  VALIDATION_ERROR = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  RATE_LIMITED = 429,
  
  // Server errors (5xx)
  INTERNAL_ERROR = 500,
  SERVICE_UNAVAILABLE = 503,
  TIMEOUT = 504,
  
  // Valhalla specific errors
  VALHALLA_ERROR = 520,
  VALHALLA_TIMEOUT = 521,
  VALHALLA_INVALID_RESPONSE = 522
}

export class StandardError extends Error {
  public readonly code: ErrorCode;
  public readonly details?: any;
  public readonly timestamp: string;
  public readonly requestId?: string;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.INTERNAL_ERROR,
    details?: any,
    requestId?: string
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
    this.requestId = requestId;
  }

  toResponse(): ErrorResponse {
    return {
      error: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
      requestId: this.requestId
    };
  }
}

// Specific error classes
export class ValidationError extends StandardError {
  constructor(message: string, details?: any, requestId?: string) {
    super(message, ErrorCode.VALIDATION_ERROR, details, requestId);
  }
}

export class ValhallaError extends StandardError {
  constructor(message: string, details?: any, requestId?: string) {
    super(message, ErrorCode.VALHALLA_ERROR, details, requestId);
  }
}

export class ValhallaTimeoutError extends StandardError {
  constructor(message: string = 'Valhalla service timeout', details?: any, requestId?: string) {
    super(message, ErrorCode.VALHALLA_TIMEOUT, details, requestId);
  }
}

export class RateLimitError extends StandardError {
  constructor(message: string = 'Rate limit exceeded', details?: any, requestId?: string) {
    super(message, ErrorCode.RATE_LIMITED, details, requestId);
  }
}

// Error handler utility
export function handleError(error: any, requestId?: string): ErrorResponse {
  // If it's already a StandardError, just return its response
  if (error instanceof StandardError) {
    return error.toResponse();
  }

  // Handle Axios errors (Valhalla API errors)
  if (error.isAxiosError) {
    const details = {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      url: error.config?.url,
      method: error.config?.method
    };

    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return new ValhallaTimeoutError(undefined, details, requestId).toResponse();
    }

    if (error.response?.status >= 500) {
      return new ValhallaError(
        `Valhalla service error: ${error.response?.statusText || 'Unknown error'}`,
        details,
        requestId
      ).toResponse();
    }

    return new ValhallaError(
      `Valhalla API error: ${error.message}`,
      details,
      requestId
    ).toResponse();
  }

  // Handle validation errors
  if (error.name === 'ValidationError') {
    return new ValidationError(
      error.message,
      error.issues || error.details,
      requestId
    ).toResponse();
  }

  // Default error handling
  return new StandardError(
    error.message || 'An unexpected error occurred',
    ErrorCode.INTERNAL_ERROR,
    { originalError: error.name, stack: error.stack },
    requestId
  ).toResponse();
}

// Request ID generator
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
} 