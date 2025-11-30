/**
 * Image Processor Worker
 * Per P-6: Processes images in a worker thread to avoid blocking the main event loop
 * Handles Sharp operations for image analysis
 *
 * Per R-2: Uses shared types from worker-messages.ts for type safety
 */

import { parentPort } from 'worker_threads';
import sharp from 'sharp';
import {
  MAX_DIMENSION,
  ALLOWED_FORMATS,
  isAllowedFormat,
  COLOR_EXTRACTION_SIZE,
} from '../constants/image.js';
import type { WorkerTask, WorkerResponse, RgbColor } from '../types/worker-messages.js';
import {
  createColorResponse,
  createValidationResponse,
  createErrorResponse,
} from '../types/worker-messages.js';

/**
 * Worker message handler
 * Per R-2: Uses typed WorkerResponse for type-safe communication
 */
parentPort?.on('message', (task: WorkerTask): void => {
  void (async (): Promise<void> => {
    try {
      let response: WorkerResponse;

      switch (task.type) {
        case 'extractDominantColor': {
          const dominantColor = await extractDominantColor(task.imageBuffer);
          response = createColorResponse(dominantColor);
          break;
        }

        case 'validateImage': {
          const validation = await validateImage(task.imageBuffer, task.maxSizeBytes);
          if (validation.success && validation.metadata) {
            response = createValidationResponse({
              success: true,
              width: validation.metadata.width,
              height: validation.metadata.height,
              format: validation.metadata.format,
            });
          } else {
            response = createErrorResponse(validation.error || 'Validation failed');
          }
          break;
        }

        default: {
          response = createErrorResponse(`Unknown task type: ${(task as { type: string }).type}`);
        }
      }

      parentPort?.postMessage(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      parentPort?.postMessage(createErrorResponse(errorMessage));
    }
  })().catch((error) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    parentPort?.postMessage(createErrorResponse(`Unhandled error: ${errorMessage}`));
  });
});

/**
 * Extract dominant color from image buffer
 * Per P-3: Optimized with downsampling before analysis
 * Per R-2: Returns typed RgbColor for type safety
 */
async function extractDominantColor(imageBuffer: Buffer): Promise<RgbColor> {
  try {
    // Downsample for faster processing (P-3 optimization)
    const stats = await sharp(imageBuffer)
      .resize(COLOR_EXTRACTION_SIZE, COLOR_EXTRACTION_SIZE, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .stats();

    return stats.dominant;
  } catch (error) {
    throw new Error(
      `Sharp processing error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Simplified image metadata
 */
interface ImageMetadata {
  width: number;
  height: number;
  format: string;
}

/**
 * Validate image buffer
 * Uses shared constants from ../constants/image.ts for security consistency
 */
async function validateImage(
  imageBuffer: Buffer,
  maxSizeBytes: number
): Promise<{ success: boolean; metadata?: ImageMetadata; error?: string }> {
  try {
    // Check size
    if (imageBuffer.length > maxSizeBytes) {
      return {
        success: false,
        error: `Image size (${(imageBuffer.length / 1024 / 1024).toFixed(2)}MB) exceeds maximum (${(maxSizeBytes / 1024 / 1024).toFixed(2)}MB)`,
      };
    }

    // Get metadata (this also validates the image format)
    const metadata = await sharp(imageBuffer).metadata();

    // Check dimensions
    if (!metadata.width || !metadata.height) {
      return {
        success: false,
        error: 'Invalid image: missing width or height',
      };
    }

    // Check for reasonable dimensions (prevent decompression bombs)
    // Uses unified MAX_DIMENSION from constants for security consistency
    if (metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION) {
      return {
        success: false,
        error: `Image dimensions (${metadata.width}x${metadata.height}) exceed maximum (${MAX_DIMENSION}x${MAX_DIMENSION})`,
      };
    }

    // Check format using unified ALLOWED_FORMATS from constants
    if (!isAllowedFormat(metadata.format)) {
      return {
        success: false,
        error: `Unsupported image format: ${metadata.format || 'unknown'}. Allowed: ${ALLOWED_FORMATS.join(', ')}`,
      };
    }

    return {
      success: true,
      metadata: {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format ?? 'unknown',
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Image validation failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
