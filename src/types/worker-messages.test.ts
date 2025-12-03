/**
 * Tests for types/worker-messages.ts
 *
 * Tests type guards and factory functions for worker communication
 */

import { describe, it, expect } from 'vitest';
import {
  // Type guards
  isSuccessResponse,
  isErrorResponse,
  isExtractDominantColorTask,
  isValidateImageTask,
  // Factory functions
  createExtractDominantColorTask,
  createValidateImageTask,
  createColorResponse,
  createValidationResponse,
  createErrorResponse,
  // Types
  type WorkerResponse,
  type WorkerTask,
  type ExtractDominantColorResponse,
  type ValidateImageResponse,
  type WorkerErrorResponse,
} from './worker-messages.js';

describe('Worker Messages', () => {
  describe('Type Guards', () => {
    describe('isSuccessResponse', () => {
      it('should return true for color extraction success response', () => {
        const response: ExtractDominantColorResponse = {
          success: true,
          data: { r: 255, g: 0, b: 0 },
        };
        expect(isSuccessResponse(response)).toBe(true);
      });

      it('should return true for validation success response', () => {
        const response: ValidateImageResponse = {
          success: true,
          data: {
            success: true,
            width: 100,
            height: 100,
            format: 'png',
          },
        };
        expect(isSuccessResponse(response)).toBe(true);
      });

      it('should return false for error response', () => {
        const response: WorkerErrorResponse = {
          success: false,
          error: 'Test error',
        };
        expect(isSuccessResponse(response)).toBe(false);
      });
    });

    describe('isErrorResponse', () => {
      it('should return true for error response', () => {
        const response: WorkerErrorResponse = {
          success: false,
          error: 'Test error',
        };
        expect(isErrorResponse(response)).toBe(true);
      });

      it('should return false for success response', () => {
        const response: ExtractDominantColorResponse = {
          success: true,
          data: { r: 255, g: 0, b: 0 },
        };
        expect(isErrorResponse(response)).toBe(false);
      });
    });

    describe('isExtractDominantColorTask', () => {
      it('should return true for extract dominant color task', () => {
        const task = createExtractDominantColorTask(Buffer.from('test'));
        expect(isExtractDominantColorTask(task)).toBe(true);
      });

      it('should return false for validate image task', () => {
        const task = createValidateImageTask(Buffer.from('test'), 1024);
        expect(isExtractDominantColorTask(task)).toBe(false);
      });
    });

    describe('isValidateImageTask', () => {
      it('should return true for validate image task', () => {
        const task = createValidateImageTask(Buffer.from('test'), 1024);
        expect(isValidateImageTask(task)).toBe(true);
      });

      it('should return false for extract dominant color task', () => {
        const task = createExtractDominantColorTask(Buffer.from('test'));
        expect(isValidateImageTask(task)).toBe(false);
      });
    });
  });

  describe('Factory Functions', () => {
    describe('createExtractDominantColorTask', () => {
      it('should create a valid extract dominant color task', () => {
        const buffer = Buffer.from('test image data');
        const task = createExtractDominantColorTask(buffer);

        expect(task.type).toBe('extractDominantColor');
        expect(task.imageBuffer).toBe(buffer);
      });

      it('should preserve buffer content', () => {
        const content = 'test content';
        const buffer = Buffer.from(content);
        const task = createExtractDominantColorTask(buffer);

        expect(task.imageBuffer.toString()).toBe(content);
      });
    });

    describe('createValidateImageTask', () => {
      it('should create a valid validate image task', () => {
        const buffer = Buffer.from('test image data');
        const maxSize = 5 * 1024 * 1024; // 5MB
        const task = createValidateImageTask(buffer, maxSize);

        expect(task.type).toBe('validateImage');
        expect(task.imageBuffer).toBe(buffer);
        expect(task.maxSizeBytes).toBe(maxSize);
      });

      it('should handle different max sizes', () => {
        const buffer = Buffer.from('test');
        const sizes = [1024, 1024 * 1024, 10 * 1024 * 1024];

        sizes.forEach((size) => {
          const task = createValidateImageTask(buffer, size);
          expect(task.maxSizeBytes).toBe(size);
        });
      });
    });

    describe('createColorResponse', () => {
      it('should create a valid color response', () => {
        const color = { r: 255, g: 128, b: 64 };
        const response = createColorResponse(color);

        expect(response.success).toBe(true);
        expect(response.data).toEqual(color);
      });

      it('should handle black color', () => {
        const color = { r: 0, g: 0, b: 0 };
        const response = createColorResponse(color);

        expect(response.data.r).toBe(0);
        expect(response.data.g).toBe(0);
        expect(response.data.b).toBe(0);
      });

      it('should handle white color', () => {
        const color = { r: 255, g: 255, b: 255 };
        const response = createColorResponse(color);

        expect(response.data.r).toBe(255);
        expect(response.data.g).toBe(255);
        expect(response.data.b).toBe(255);
      });
    });

    describe('createValidationResponse', () => {
      it('should create a valid validation response', () => {
        const result = {
          success: true as const,
          width: 800,
          height: 600,
          format: 'jpeg',
        };
        const response = createValidationResponse(result);

        expect(response.success).toBe(true);
        expect(response.data).toEqual(result);
      });

      it('should handle validation failure result', () => {
        const result = {
          success: false as const,
          error: 'Image too large',
        };
        const response = createValidationResponse(result);

        expect(response.success).toBe(true); // Response is successful
        expect(response.data.success).toBe(false); // But validation failed
        expect(response.data.error).toBe('Image too large');
      });

      it('should handle all image formats', () => {
        const formats = ['png', 'jpeg', 'gif', 'webp'];

        formats.forEach((format) => {
          const response = createValidationResponse({
            success: true,
            width: 100,
            height: 100,
            format,
          });
          expect(response.data.format).toBe(format);
        });
      });
    });

    describe('createErrorResponse', () => {
      it('should create a valid error response', () => {
        const errorMessage = 'Something went wrong';
        const response = createErrorResponse(errorMessage);

        expect(response.success).toBe(false);
        expect(response.error).toBe(errorMessage);
      });

      it('should handle empty error message', () => {
        const response = createErrorResponse('');
        expect(response.success).toBe(false);
        expect(response.error).toBe('');
      });

      it('should handle long error messages', () => {
        const longMessage = 'A'.repeat(1000);
        const response = createErrorResponse(longMessage);
        expect(response.error).toBe(longMessage);
      });
    });
  });

  describe('WorkerTask Union Type', () => {
    it('should allow extractDominantColor task', () => {
      const task: WorkerTask = {
        type: 'extractDominantColor',
        imageBuffer: Buffer.from('test'),
      };
      expect(task.type).toBe('extractDominantColor');
    });

    it('should allow validateImage task', () => {
      const task: WorkerTask = {
        type: 'validateImage',
        imageBuffer: Buffer.from('test'),
        maxSizeBytes: 1024,
      };
      expect(task.type).toBe('validateImage');
    });
  });

  describe('WorkerResponse Union Type', () => {
    it('should allow color extraction success', () => {
      const response: WorkerResponse = {
        success: true,
        data: { r: 0, g: 0, b: 0 },
      };
      expect(response.success).toBe(true);
    });

    it('should allow validation success', () => {
      const response: WorkerResponse = {
        success: true,
        data: { success: true, width: 100, height: 100 },
      };
      expect(response.success).toBe(true);
    });

    it('should allow error response', () => {
      const response: WorkerResponse = {
        success: false,
        error: 'Failed',
      };
      expect(response.success).toBe(false);
    });
  });
});
