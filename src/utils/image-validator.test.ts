/**
 * Unit tests for image validation utilities
 */

import { describe, it, expect, vi } from 'vitest';
import sharp from 'sharp';
import {
    validateImage,
    sanitizeImage,
    processWithTimeout,
    validateAndSanitizeImage,
} from './image-validator.js';

// Mock sharp for testing
vi.mock('sharp', () => {
    return {
        default: vi.fn((buffer: Buffer) => ({
            metadata: vi.fn(),
            rotate: vi.fn().mockReturnThis(),
            withMetadata: vi.fn().mockReturnThis(),
            webp: vi.fn().mockReturnThis(),
            toBuffer: vi.fn(),
        })),
    };
});

describe('validateImage', () => {
    it('should reject images exceeding size limit', async () => {
        const largeBuffer = Buffer.alloc(9 * 1024 * 1024); // 9MB
        const result = await validateImage(largeBuffer, 8 * 1024 * 1024);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error).toContain('exceeds');
        }
    });

    it('should reject images with invalid dimensions', async () => {
        const mockSharp = sharp as any;
        mockSharp.mockReturnValue({
            metadata: vi.fn().mockResolvedValue({
                width: 5000,
                height: 5000,
                format: 'jpeg',
            }),
        });

        const buffer = Buffer.from('fake image');
        const result = await validateImage(buffer, 8 * 1024 * 1024);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error).toContain('dimensions');
        }
    });

    it('should reject images with too many pixels', async () => {
        const mockSharp = sharp as any;
        // Use dimensions that exceed MAX_DIMENSION (4096) to test dimension validation
        // Note: Pixel count check would require dimensions within MAX_DIMENSION but exceeding
        // MAX_PIXEL_COUNT, which is impossible since MAX_PIXEL_COUNT = MAX_DIMENSION^2
        mockSharp.mockReturnValue({
            metadata: vi.fn().mockResolvedValue({
                width: 4097,
                height: 4097,
                format: 'jpeg',
            }),
        });

        const buffer = Buffer.from('fake image');
        const result = await validateImage(buffer, 8 * 1024 * 1024);
        expect(result.success).toBe(false);
        if (!result.success) {
            // Dimension check runs first, so we get dimension error
            expect(result.error).toContain('exceed');
            expect(result.error).toContain('4096');
        }
    });

    it('should reject unsupported formats', async () => {
        const mockSharp = sharp as any;
        mockSharp.mockReturnValue({
            metadata: vi.fn().mockResolvedValue({
                width: 100,
                height: 100,
                format: 'tiff',
            }),
        });

        const buffer = Buffer.from('fake image');
        const result = await validateImage(buffer, 8 * 1024 * 1024);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error).toContain('Unsupported image format');
        }
    });

    it('should accept valid images', async () => {
        const mockSharp = sharp as any;
        mockSharp.mockReturnValue({
            metadata: vi.fn().mockResolvedValue({
                width: 1000,
                height: 1000,
                format: 'jpeg',
            }),
        });

        const buffer = Buffer.from('fake image');
        const result = await validateImage(buffer, 8 * 1024 * 1024);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.metadata).toBeDefined();
            expect(result.metadata.width).toBe(1000);
            expect(result.metadata.height).toBe(1000);
        }
    });
});

describe('processWithTimeout', () => {
    it('should resolve if promise completes before timeout', async () => {
        const promise = Promise.resolve('success');
        const result = await processWithTimeout(promise, 1000);
        expect(result).toBe('success');
    });

    it('should reject if promise exceeds timeout', async () => {
        const promise = new Promise((resolve) => setTimeout(() => resolve('success'), 2000));
        await expect(processWithTimeout(promise, 100)).rejects.toThrow('timeout');
    });
});

describe('validateImage - edge cases', () => {
    it('should reject when sharp throws an error', async () => {
        const mockSharp = sharp as any;
        mockSharp.mockReturnValue({
            metadata: vi.fn().mockRejectedValue(new Error('Invalid image')),
        });

        const buffer = Buffer.from('not an image');
        const result = await validateImage(buffer, 8 * 1024 * 1024);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error).toContain('Failed to parse');
        }
    });

    it('should reject when width is missing', async () => {
        const mockSharp = sharp as any;
        mockSharp.mockReturnValue({
            metadata: vi.fn().mockResolvedValue({
                height: 100,
                format: 'jpeg',
            }),
        });

        const buffer = Buffer.from('fake image');
        const result = await validateImage(buffer, 8 * 1024 * 1024);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error).toContain('missing width or height');
        }
    });

    it('should reject when height is missing', async () => {
        const mockSharp = sharp as any;
        mockSharp.mockReturnValue({
            metadata: vi.fn().mockResolvedValue({
                width: 100,
                format: 'jpeg',
            }),
        });

        const buffer = Buffer.from('fake image');
        const result = await validateImage(buffer, 8 * 1024 * 1024);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error).toContain('missing width or height');
        }
    });

    it('should reject when format is missing', async () => {
        const mockSharp = sharp as any;
        mockSharp.mockReturnValue({
            metadata: vi.fn().mockResolvedValue({
                width: 100,
                height: 100,
            }),
        });

        const buffer = Buffer.from('fake image');
        const result = await validateImage(buffer, 8 * 1024 * 1024);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error).toContain('Unsupported image format');
        }
    });

    it('should accept png format', async () => {
        const mockSharp = sharp as any;
        mockSharp.mockReturnValue({
            metadata: vi.fn().mockResolvedValue({
                width: 100,
                height: 100,
                format: 'png',
            }),
        });

        const buffer = Buffer.from('fake image');
        const result = await validateImage(buffer, 8 * 1024 * 1024);
        expect(result.success).toBe(true);
    });

    it('should accept webp format', async () => {
        const mockSharp = sharp as any;
        mockSharp.mockReturnValue({
            metadata: vi.fn().mockResolvedValue({
                width: 100,
                height: 100,
                format: 'webp',
            }),
        });

        const buffer = Buffer.from('fake image');
        const result = await validateImage(buffer, 8 * 1024 * 1024);
        expect(result.success).toBe(true);
    });

    it('should accept gif format', async () => {
        const mockSharp = sharp as any;
        mockSharp.mockReturnValue({
            metadata: vi.fn().mockResolvedValue({
                width: 100,
                height: 100,
                format: 'gif',
            }),
        });

        const buffer = Buffer.from('fake image');
        const result = await validateImage(buffer, 8 * 1024 * 1024);
        expect(result.success).toBe(true);
    });
});

describe('sanitizeImage', () => {
    it('should sanitize and re-encode image', async () => {
        const mockSharp = sharp as any;
        const sanitizedBuffer = Buffer.from('sanitized image');
        mockSharp.mockReturnValue({
            rotate: vi.fn().mockReturnThis(),
            withMetadata: vi.fn().mockReturnThis(),
            webp: vi.fn().mockReturnThis(),
            toBuffer: vi.fn().mockResolvedValue(sanitizedBuffer),
        });

        const buffer = Buffer.from('original image');
        const result = await sanitizeImage(buffer);
        expect(result).toEqual(sanitizedBuffer);
    });

    it('should throw error when sanitization fails', async () => {
        const mockSharp = sharp as any;
        mockSharp.mockReturnValue({
            rotate: vi.fn().mockReturnThis(),
            withMetadata: vi.fn().mockReturnThis(),
            webp: vi.fn().mockReturnThis(),
            toBuffer: vi.fn().mockRejectedValue(new Error('Processing failed')),
        });

        const buffer = Buffer.from('bad image');
        await expect(sanitizeImage(buffer)).rejects.toThrow('Failed to sanitize image');
    });
});

describe('validateAndSanitizeImage', () => {
    it('should validate and sanitize valid image', async () => {
        const mockSharp = sharp as any;
        const sanitizedBuffer = Buffer.from('sanitized');

        // First call for validation
        mockSharp.mockReturnValueOnce({
            metadata: vi.fn().mockResolvedValue({
                width: 100,
                height: 100,
                format: 'jpeg',
            }),
        });

        // Second call for sanitization
        mockSharp.mockReturnValueOnce({
            rotate: vi.fn().mockReturnThis(),
            withMetadata: vi.fn().mockReturnThis(),
            webp: vi.fn().mockReturnThis(),
            toBuffer: vi.fn().mockResolvedValue(sanitizedBuffer),
        });

        const buffer = Buffer.from('valid image');
        const result = await validateAndSanitizeImage(buffer, 8 * 1024 * 1024, 5000);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.value.buffer).toEqual(sanitizedBuffer);
            expect(result.value.metadata.width).toBe(100);
        }
    });

    it('should return validation error for invalid image', async () => {
        const mockSharp = sharp as any;
        mockSharp.mockReturnValue({
            metadata: vi.fn().mockResolvedValue({
                width: 5000,
                height: 5000,
                format: 'jpeg',
            }),
        });

        const buffer = Buffer.from('large image');
        const result = await validateAndSanitizeImage(buffer, 8 * 1024 * 1024);

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error).toContain('dimensions');
        }
    });

    it('should handle timeout error', async () => {
        const mockSharp = sharp as any;
        mockSharp.mockReturnValue({
            metadata: vi.fn().mockImplementation(() =>
                new Promise((resolve) => setTimeout(resolve, 2000))
            ),
        });

        const buffer = Buffer.from('slow image');
        const result = await validateAndSanitizeImage(buffer, 8 * 1024 * 1024, 50);

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error).toContain('timed out');
        }
    });

    it('should handle generic processing error', async () => {
        const mockSharp = sharp as any;
        mockSharp.mockReturnValue({
            metadata: vi.fn().mockRejectedValue(new Error('Unknown error')),
        });

        const buffer = Buffer.from('bad image');
        const result = await validateAndSanitizeImage(buffer, 8 * 1024 * 1024);

        expect(result.success).toBe(false);
    });
});

