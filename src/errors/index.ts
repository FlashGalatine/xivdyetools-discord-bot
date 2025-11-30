/**
 * Custom error classes for the Discord bot
 *
 * Provides typed errors that CommandBase can handle differently,
 * enabling better error messages and logging categorization.
 *
 * Per R-2: Error classification for improved error handling
 */

/**
 * Base class for all bot errors
 */
export abstract class BotError extends Error {
  /** Error code for logging and debugging */
  abstract readonly code: string;

  /** Whether this error should be shown to the user (vs logged only) */
  readonly userFacing: boolean = true;

  /** HTTP-like status code for categorization */
  abstract readonly statusCode: number;

  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Validation error - user provided invalid input
 * Status: 400 (Bad Request)
 */
export class ValidationError extends BotError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 400;

  constructor(
    message: string,
    public readonly field?: string,
    cause?: unknown
  ) {
    super(message, cause);
  }
}

/**
 * Not found error - requested resource doesn't exist
 * Status: 404 (Not Found)
 */
export class NotFoundError extends BotError {
  readonly code = 'NOT_FOUND';
  readonly statusCode = 404;

  constructor(
    message: string,
    public readonly resourceType?: string,
    cause?: unknown
  ) {
    super(message, cause);
  }
}

/**
 * Rate limit error - user hit rate limits
 * Status: 429 (Too Many Requests)
 */
export class RateLimitError extends BotError {
  readonly code = 'RATE_LIMITED';
  readonly statusCode = 429;

  constructor(
    message: string,
    public readonly retryAfterSeconds?: number,
    cause?: unknown
  ) {
    super(message, cause);
  }
}

/**
 * Permission error - user lacks permission
 * Status: 403 (Forbidden)
 */
export class PermissionError extends BotError {
  readonly code = 'PERMISSION_DENIED';
  readonly statusCode = 403;

  constructor(
    message: string,
    public readonly requiredPermission?: string,
    cause?: unknown
  ) {
    super(message, cause);
  }
}

/**
 * External service error - third-party API failed
 * Status: 502 (Bad Gateway)
 */
export class ExternalServiceError extends BotError {
  readonly code = 'EXTERNAL_SERVICE_ERROR';
  readonly statusCode = 502;
  readonly userFacing = false; // Don't expose external service details

  constructor(
    message: string,
    public readonly serviceName?: string,
    cause?: unknown
  ) {
    super(message, cause);
  }
}

/**
 * Timeout error - operation took too long
 * Status: 504 (Gateway Timeout)
 */
export class TimeoutError extends BotError {
  readonly code = 'TIMEOUT';
  readonly statusCode = 504;

  constructor(
    message: string,
    public readonly timeoutMs?: number,
    cause?: unknown
  ) {
    super(message, cause);
  }
}

/**
 * Processing error - error during command processing
 * Status: 500 (Internal Server Error)
 */
export class ProcessingError extends BotError {
  readonly code = 'PROCESSING_ERROR';
  readonly statusCode = 500;
  readonly userFacing = false; // Don't expose internal errors

  constructor(message: string, cause?: unknown) {
    super(message, cause);
  }
}

/**
 * Image processing error - error during image operations
 * Status: 422 (Unprocessable Entity)
 */
export class ImageProcessingError extends BotError {
  readonly code = 'IMAGE_PROCESSING_ERROR';
  readonly statusCode = 422;

  constructor(
    message: string,
    public readonly imageDetails?: { width?: number; height?: number; format?: string },
    cause?: unknown
  ) {
    super(message, cause);
  }
}

/**
 * Type guard to check if an error is a BotError
 */
export function isBotError(error: unknown): error is BotError {
  return error instanceof BotError;
}

/**
 * Get user-friendly error message based on error type
 * Maintains backwards compatibility with expected error message formats
 */
export function getUserFriendlyMessage(error: unknown): string {
  if (isBotError(error)) {
    if (error.userFacing) {
      return error.message;
    }
    // Non-user-facing errors get generic messages
    switch (error.statusCode) {
      case 500:
        return 'Something went wrong. Please try again or contact support if the issue persists.';
      case 502:
        return 'Failed to connect to external services. Please try again later.';
      case 504:
        return 'The request took too long to process. Please try again.';
      default:
        return 'Something went wrong. Please try again or contact support if the issue persists.';
    }
  }

  // Standard Error - pattern matching for specific error types
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Invalid input errors - pass through the message
    if (error.message.includes('Invalid input')) {
      return error.message;
    }

    // Rate limit errors
    if (message.includes('rate limit')) {
      return "You're sending commands too quickly. Please wait a moment and try again.";
    }

    // Permission errors
    if (message.includes('permission') || message.includes('missing')) {
      return "You don't have permission to use this command.";
    }

    // Timeout errors
    if (message.includes('timeout')) {
      return 'The request took too long to process. Please try again.';
    }

    // Network/fetch errors
    if (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('econnrefused') ||
      message.includes('etimedout')
    ) {
      return 'Failed to connect to external services. Please try again later.';
    }

    // Generic error - don't expose internal details
    return 'Something went wrong. Please try again or contact support if the issue persists.';
  }

  // Non-Error objects (strings, etc.)
  return 'An unexpected error occurred while executing this command.';
}

/**
 * Get error title based on error type
 * Maintains backwards compatibility with expected error title formats
 */
export function getErrorTitle(error: unknown): string {
  if (isBotError(error)) {
    switch (error.code) {
      case 'VALIDATION_ERROR':
        return 'Invalid Input';
      case 'NOT_FOUND':
        return 'Not Found';
      case 'RATE_LIMITED':
        return 'Rate Limit Exceeded';
      case 'PERMISSION_DENIED':
        return 'Permission Denied';
      case 'EXTERNAL_SERVICE_ERROR':
        return 'Network Error';
      case 'TIMEOUT':
        return 'Request Timeout';
      case 'IMAGE_PROCESSING_ERROR':
        return 'Image Processing Error';
      default:
        return 'Command Error';
    }
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Invalid input errors
    if (error.message.includes('Invalid input')) {
      return 'Invalid Input';
    }

    // Rate limit errors
    if (message.includes('rate limit')) {
      return 'Rate Limit Exceeded';
    }

    // Permission errors
    if (message.includes('permission') || message.includes('missing')) {
      return 'Permission Denied';
    }

    // Timeout errors
    if (message.includes('timeout')) {
      return 'Request Timeout';
    }

    // Network/fetch errors
    if (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('econnrefused') ||
      message.includes('etimedout')
    ) {
      return 'Network Error';
    }
  }

  // Default title for all other errors
  return 'Command Error';
}
