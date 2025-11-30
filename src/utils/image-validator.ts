/**
 * Image validation and sanitization utilities
 * Per S-2: Image Upload Security - Multi-layer validation
 */

import sharp from 'sharp';
import type { ValidationResult } from './validators.js';
import {
  MAX_DIMENSION,
  MAX_PIXEL_COUNT,
  ALLOWED_FORMATS,
  isAllowedFormat,
  PROCESSING_TIMEOUT_MS,
} from '../constants/image.js';

/**
 * Image validation result with metadata
 */
export type ImageValidationResult =
  | { success: true; value: ImageMetadata; metadata: ImageMetadata }
  | { success: false; error: string };

/**
 * Image metadata
 */
export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  size: number;
  pixelCount: number;
}

/**
 * Validate image buffer with comprehensive security checks
 * Per S-2: Multi-layer validation to prevent DoS attacks
 */
export async function validateImage(
  buffer: Buffer,
  maxSizeBytes: number
): Promise<ImageValidationResult> {
  // 1. Size check (pre-processing)
  if (buffer.length > maxSizeBytes) {
    return {
      success: false,
      error: `Image exceeds ${(maxSizeBytes / 1024 / 1024).toFixed(0)}MB limit.`,
    };
  }

  // 2. Verify it's actually an image and get metadata
  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch (error) {
    return {
      success: false,
      error: 'Failed to parse image. File may be corrupted or not a valid image.',
    };
  }

  // 3. Dimension limits (prevent decompression bombs)
  if (!metadata.width || !metadata.height) {
    return {
      success: false,
      error: 'Invalid image metadata: missing width or height.',
    };
  }

  if (metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION) {
    return {
      success: false,
      error: `Image dimensions (${metadata.width}x${metadata.height}) exceed ${MAX_DIMENSION}x${MAX_DIMENSION} limit.`,
    };
  }

  // 4. Pixel count limit (prevents 4096x4096x3 = 50MB uncompressed)
  const pixelCount = metadata.width * metadata.height;
  if (pixelCount > MAX_PIXEL_COUNT) {
    return {
      success: false,
      error: `Image has too many pixels (${pixelCount.toLocaleString()}). Maximum: ${MAX_PIXEL_COUNT.toLocaleString()}.`,
    };
  }

  // 5. Format whitelist
  if (!isAllowedFormat(metadata.format)) {
    return {
      success: false,
      error: `Unsupported image format: ${metadata.format || 'unknown'}. Allowed formats: ${ALLOWED_FORMATS.join(', ')}.`,
    };
  }

  return {
    success: true,
    value: {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: buffer.length,
      pixelCount,
    },
    metadata: {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: buffer.length,
      pixelCount,
    },
  };
}

/**
 * Sanitize image by stripping metadata and re-encoding
 * Per S-2: EXIF stripping, privacy protection
 */
export async function sanitizeImage(buffer: Buffer): Promise<Buffer> {
  try {
    // Strip all metadata, re-encode as WebP (efficient, no metadata)
    // Auto-rotate based on EXIF (then strip it)
    return await sharp(buffer)
      .rotate() // Auto-rotate based on EXIF orientation
      .withMetadata({}) // Strip all metadata (EXIF, ICC, etc.)
      .webp({ quality: 90 }) // Re-encode as WebP
      .toBuffer();
  } catch (error) {
    throw new Error(
      `Failed to sanitize image: ${error instanceof Error ? error.message : 'unknown error'}`
    );
  }
}

/**
 * Process image with timeout protection
 * Per S-2: Prevent infinite processing
 */
export function processWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Processing timeout after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

/**
 * Validate and sanitize image in one operation
 * Combines validation and sanitization for convenience
 */
export async function validateAndSanitizeImage(
  buffer: Buffer,
  maxSizeBytes: number,
  timeoutMs: number = PROCESSING_TIMEOUT_MS
): Promise<ValidationResult<{ buffer: Buffer; metadata: ImageMetadata }>> {
  try {
    // Validate with timeout
    const validationResult = await processWithTimeout(
      validateImage(buffer, maxSizeBytes),
      timeoutMs
    );

    if (!validationResult.success) {
      return {
        success: false,
        error: validationResult.error,
      };
    }

    // Sanitize with timeout
    const sanitizedBuffer = await processWithTimeout(sanitizeImage(buffer), timeoutMs);

    return {
      success: true,
      value: {
        buffer: sanitizedBuffer,
        metadata: validationResult.metadata,
      },
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('timeout')) {
      return {
        success: false,
        error: `Image processing timed out after ${timeoutMs}ms.`,
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Image processing failed.',
    };
  }
}
