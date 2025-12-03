/**
 * Tests for errors/index.ts
 *
 * Tests custom error classes and helper functions
 */

import { describe, it, expect } from 'vitest';
import {
  // Error classes
  BotError,
  ValidationError,
  NotFoundError,
  RateLimitError,
  PermissionError,
  ExternalServiceError,
  TimeoutError,
  ProcessingError,
  ImageProcessingError,
  // Helper functions
  isBotError,
  getUserFriendlyMessage,
  getErrorTitle,
} from './index.js';

describe('Error Classes', () => {
  describe('ValidationError', () => {
    it('should create error with message', () => {
      const error = new ValidationError('Invalid input');
      expect(error.message).toBe('Invalid input');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.userFacing).toBe(true);
    });

    it('should store field name', () => {
      const error = new ValidationError('Invalid color', 'hexColor');
      expect(error.field).toBe('hexColor');
    });

    it('should store cause', () => {
      const cause = new Error('Original error');
      const error = new ValidationError('Invalid input', undefined, cause);
      expect(error.cause).toBe(cause);
    });

    it('should have correct name', () => {
      const error = new ValidationError('Test');
      expect(error.name).toBe('ValidationError');
    });
  });

  describe('NotFoundError', () => {
    it('should create error with message', () => {
      const error = new NotFoundError('Dye not found');
      expect(error.message).toBe('Dye not found');
      expect(error.code).toBe('NOT_FOUND');
      expect(error.statusCode).toBe(404);
      expect(error.userFacing).toBe(true);
    });

    it('should store resource type', () => {
      const error = new NotFoundError('Dye not found', 'Dye');
      expect(error.resourceType).toBe('Dye');
    });

    it('should store cause', () => {
      const cause = new Error('Original error');
      const error = new NotFoundError('Not found', 'Resource', cause);
      expect(error.cause).toBe(cause);
    });
  });

  describe('RateLimitError', () => {
    it('should create error with message', () => {
      const error = new RateLimitError('Too many requests');
      expect(error.message).toBe('Too many requests');
      expect(error.code).toBe('RATE_LIMITED');
      expect(error.statusCode).toBe(429);
      expect(error.userFacing).toBe(true);
    });

    it('should store retry after seconds', () => {
      const error = new RateLimitError('Rate limited', 60);
      expect(error.retryAfterSeconds).toBe(60);
    });

    it('should store cause', () => {
      const cause = new Error('Original');
      const error = new RateLimitError('Rate limited', 30, cause);
      expect(error.cause).toBe(cause);
    });
  });

  describe('PermissionError', () => {
    it('should create error with message', () => {
      const error = new PermissionError('Access denied');
      expect(error.message).toBe('Access denied');
      expect(error.code).toBe('PERMISSION_DENIED');
      expect(error.statusCode).toBe(403);
      expect(error.userFacing).toBe(true);
    });

    it('should store required permission', () => {
      const error = new PermissionError('Cannot use this', 'ADMINISTRATOR');
      expect(error.requiredPermission).toBe('ADMINISTRATOR');
    });

    it('should store cause', () => {
      const cause = new Error('Original');
      const error = new PermissionError('Denied', 'ADMIN', cause);
      expect(error.cause).toBe(cause);
    });
  });

  describe('ExternalServiceError', () => {
    it('should create error with message', () => {
      const error = new ExternalServiceError('API failed');
      expect(error.message).toBe('API failed');
      expect(error.code).toBe('EXTERNAL_SERVICE_ERROR');
      expect(error.statusCode).toBe(502);
      expect(error.userFacing).toBe(false); // Not user facing
    });

    it('should store service name', () => {
      const error = new ExternalServiceError('Failed', 'Discord API');
      expect(error.serviceName).toBe('Discord API');
    });

    it('should store cause', () => {
      const cause = new Error('Original');
      const error = new ExternalServiceError('Failed', 'API', cause);
      expect(error.cause).toBe(cause);
    });
  });

  describe('TimeoutError', () => {
    it('should create error with message', () => {
      const error = new TimeoutError('Request timed out');
      expect(error.message).toBe('Request timed out');
      expect(error.code).toBe('TIMEOUT');
      expect(error.statusCode).toBe(504);
      expect(error.userFacing).toBe(true);
    });

    it('should store timeout duration', () => {
      const error = new TimeoutError('Timed out', 5000);
      expect(error.timeoutMs).toBe(5000);
    });

    it('should store cause', () => {
      const cause = new Error('Original');
      const error = new TimeoutError('Timed out', 1000, cause);
      expect(error.cause).toBe(cause);
    });
  });

  describe('ProcessingError', () => {
    it('should create error with message', () => {
      const error = new ProcessingError('Processing failed');
      expect(error.message).toBe('Processing failed');
      expect(error.code).toBe('PROCESSING_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.userFacing).toBe(false); // Not user facing
    });

    it('should store cause', () => {
      const cause = new Error('Original');
      const error = new ProcessingError('Failed', cause);
      expect(error.cause).toBe(cause);
    });
  });

  describe('ImageProcessingError', () => {
    it('should create error with message', () => {
      const error = new ImageProcessingError('Image too large');
      expect(error.message).toBe('Image too large');
      expect(error.code).toBe('IMAGE_PROCESSING_ERROR');
      expect(error.statusCode).toBe(422);
      expect(error.userFacing).toBe(true);
    });

    it('should store image details', () => {
      const details = { width: 1920, height: 1080, format: 'png' };
      const error = new ImageProcessingError('Too large', details);
      expect(error.imageDetails).toEqual(details);
    });

    it('should handle partial image details', () => {
      const error = new ImageProcessingError('Invalid', { format: 'gif' });
      expect(error.imageDetails?.format).toBe('gif');
      expect(error.imageDetails?.width).toBeUndefined();
    });

    it('should store cause', () => {
      const cause = new Error('Original');
      const error = new ImageProcessingError('Failed', undefined, cause);
      expect(error.cause).toBe(cause);
    });
  });
});

describe('isBotError Type Guard', () => {
  it('should return true for ValidationError', () => {
    expect(isBotError(new ValidationError('test'))).toBe(true);
  });

  it('should return true for NotFoundError', () => {
    expect(isBotError(new NotFoundError('test'))).toBe(true);
  });

  it('should return true for RateLimitError', () => {
    expect(isBotError(new RateLimitError('test'))).toBe(true);
  });

  it('should return true for PermissionError', () => {
    expect(isBotError(new PermissionError('test'))).toBe(true);
  });

  it('should return true for ExternalServiceError', () => {
    expect(isBotError(new ExternalServiceError('test'))).toBe(true);
  });

  it('should return true for TimeoutError', () => {
    expect(isBotError(new TimeoutError('test'))).toBe(true);
  });

  it('should return true for ProcessingError', () => {
    expect(isBotError(new ProcessingError('test'))).toBe(true);
  });

  it('should return true for ImageProcessingError', () => {
    expect(isBotError(new ImageProcessingError('test'))).toBe(true);
  });

  it('should return false for standard Error', () => {
    expect(isBotError(new Error('test'))).toBe(false);
  });

  it('should return false for string', () => {
    expect(isBotError('error string')).toBe(false);
  });

  it('should return false for null', () => {
    expect(isBotError(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isBotError(undefined)).toBe(false);
  });

  it('should return false for object', () => {
    expect(isBotError({ message: 'error' })).toBe(false);
  });
});

describe('getUserFriendlyMessage', () => {
  describe('BotError handling', () => {
    it('should return message for user-facing ValidationError', () => {
      const error = new ValidationError('Invalid hex color');
      expect(getUserFriendlyMessage(error)).toBe('Invalid hex color');
    });

    it('should return generic message for non-user-facing ProcessingError', () => {
      const error = new ProcessingError('Internal stack trace');
      expect(getUserFriendlyMessage(error)).toContain('Something went wrong');
    });

    it('should return generic message for non-user-facing ExternalServiceError', () => {
      const error = new ExternalServiceError('Redis connection failed');
      expect(getUserFriendlyMessage(error)).toContain('external services');
    });

    it('should handle 504 status code', () => {
      const error = new TimeoutError('Request timeout');
      // TimeoutError is user-facing, so returns original message
      expect(getUserFriendlyMessage(error)).toBe('Request timeout');
    });
  });

  describe('Standard Error handling', () => {
    it('should pass through Invalid input messages', () => {
      const error = new Error('Invalid input: color not found');
      expect(getUserFriendlyMessage(error)).toBe('Invalid input: color not found');
    });

    it('should handle rate limit errors', () => {
      const error = new Error('rate limit exceeded');
      expect(getUserFriendlyMessage(error)).toContain('too quickly');
    });

    it('should handle permission errors', () => {
      const error = new Error('missing permission to execute');
      expect(getUserFriendlyMessage(error)).toContain('permission');
    });

    it('should handle timeout errors', () => {
      const error = new Error('operation timeout');
      expect(getUserFriendlyMessage(error)).toContain('too long');
    });

    it('should handle network errors', () => {
      const error = new Error('network unreachable');
      expect(getUserFriendlyMessage(error)).toContain('external services');
    });

    it('should handle fetch errors', () => {
      const error = new Error('fetch failed');
      expect(getUserFriendlyMessage(error)).toContain('external services');
    });

    it('should handle ECONNREFUSED errors', () => {
      const error = new Error('ECONNREFUSED');
      expect(getUserFriendlyMessage(error)).toContain('external services');
    });

    it('should handle ETIMEDOUT errors', () => {
      const error = new Error('ETIMEDOUT');
      expect(getUserFriendlyMessage(error)).toContain('external services');
    });

    it('should return generic message for unknown errors', () => {
      const error = new Error('Some random internal error');
      expect(getUserFriendlyMessage(error)).toContain('Something went wrong');
    });
  });

  describe('Non-Error handling', () => {
    it('should handle string errors', () => {
      expect(getUserFriendlyMessage('error string')).toContain('unexpected error');
    });

    it('should handle null', () => {
      expect(getUserFriendlyMessage(null)).toContain('unexpected error');
    });

    it('should handle undefined', () => {
      expect(getUserFriendlyMessage(undefined)).toContain('unexpected error');
    });

    it('should handle plain objects', () => {
      expect(getUserFriendlyMessage({ error: 'test' })).toContain('unexpected error');
    });
  });
});

describe('getErrorTitle', () => {
  describe('BotError handling', () => {
    it('should return "Invalid Input" for ValidationError', () => {
      expect(getErrorTitle(new ValidationError('test'))).toBe('Invalid Input');
    });

    it('should return "Not Found" for NotFoundError', () => {
      expect(getErrorTitle(new NotFoundError('test'))).toBe('Not Found');
    });

    it('should return "Rate Limit Exceeded" for RateLimitError', () => {
      expect(getErrorTitle(new RateLimitError('test'))).toBe('Rate Limit Exceeded');
    });

    it('should return "Permission Denied" for PermissionError', () => {
      expect(getErrorTitle(new PermissionError('test'))).toBe('Permission Denied');
    });

    it('should return "Network Error" for ExternalServiceError', () => {
      expect(getErrorTitle(new ExternalServiceError('test'))).toBe('Network Error');
    });

    it('should return "Request Timeout" for TimeoutError', () => {
      expect(getErrorTitle(new TimeoutError('test'))).toBe('Request Timeout');
    });

    it('should return "Image Processing Error" for ImageProcessingError', () => {
      expect(getErrorTitle(new ImageProcessingError('test'))).toBe('Image Processing Error');
    });

    it('should return "Command Error" for ProcessingError', () => {
      expect(getErrorTitle(new ProcessingError('test'))).toBe('Command Error');
    });
  });

  describe('Standard Error handling', () => {
    it('should return "Invalid Input" for Invalid input messages', () => {
      const error = new Error('Invalid input: bad color');
      expect(getErrorTitle(error)).toBe('Invalid Input');
    });

    it('should return "Rate Limit Exceeded" for rate limit messages', () => {
      const error = new Error('rate limit reached');
      expect(getErrorTitle(error)).toBe('Rate Limit Exceeded');
    });

    it('should return "Permission Denied" for permission messages', () => {
      const error = new Error('missing permission');
      expect(getErrorTitle(error)).toBe('Permission Denied');
    });

    it('should return "Request Timeout" for timeout messages', () => {
      const error = new Error('connection timeout');
      expect(getErrorTitle(error)).toBe('Request Timeout');
    });

    it('should return "Network Error" for network messages', () => {
      const error = new Error('network error occurred');
      expect(getErrorTitle(error)).toBe('Network Error');
    });

    it('should return "Network Error" for fetch messages', () => {
      const error = new Error('fetch failed');
      expect(getErrorTitle(error)).toBe('Network Error');
    });

    it('should return "Network Error" for ECONNREFUSED', () => {
      const error = new Error('ECONNREFUSED');
      expect(getErrorTitle(error)).toBe('Network Error');
    });

    it('should return "Network Error" for ETIMEDOUT', () => {
      const error = new Error('ETIMEDOUT');
      expect(getErrorTitle(error)).toBe('Network Error');
    });

    it('should return "Command Error" for unknown errors', () => {
      const error = new Error('random error');
      expect(getErrorTitle(error)).toBe('Command Error');
    });
  });

  describe('Non-Error handling', () => {
    it('should return "Command Error" for strings', () => {
      expect(getErrorTitle('error')).toBe('Command Error');
    });

    it('should return "Command Error" for null', () => {
      expect(getErrorTitle(null)).toBe('Command Error');
    });

    it('should return "Command Error" for undefined', () => {
      expect(getErrorTitle(undefined)).toBe('Command Error');
    });

    it('should return "Command Error" for objects', () => {
      expect(getErrorTitle({ error: 'test' })).toBe('Command Error');
    });
  });
});

describe('Error Inheritance', () => {
  it('ValidationError should be instanceof BotError', () => {
    const error = new ValidationError('test');
    expect(error instanceof BotError).toBe(true);
  });

  it('ValidationError should be instanceof Error', () => {
    const error = new ValidationError('test');
    expect(error instanceof Error).toBe(true);
  });

  it('All error types should be instanceof BotError', () => {
    const errors = [
      new ValidationError('test'),
      new NotFoundError('test'),
      new RateLimitError('test'),
      new PermissionError('test'),
      new ExternalServiceError('test'),
      new TimeoutError('test'),
      new ProcessingError('test'),
      new ImageProcessingError('test'),
    ];

    errors.forEach((error) => {
      expect(error instanceof BotError).toBe(true);
      expect(error instanceof Error).toBe(true);
    });
  });
});
