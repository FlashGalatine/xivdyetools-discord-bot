/**
 * Image Processor Worker
 * Per P-6: Processes images in a worker thread to avoid blocking the main event loop
 * Handles Sharp operations for image analysis
 */

import { parentPort } from 'worker_threads';
import sharp from 'sharp';

/**
 * Task types
 */
interface ExtractDominantColorTask {
  type: 'extractDominantColor';
  imageBuffer: Buffer;
}

interface ValidateImageTask {
  type: 'validateImage';
  imageBuffer: Buffer;
  maxSizeBytes: number;
}

type WorkerTask = ExtractDominantColorTask | ValidateImageTask;

/**
 * Worker message handler
 */
parentPort?.on('message', (task: WorkerTask): void => {
  void (async (): Promise<void> => {
    try {
      let result: { success: boolean; data?: unknown; error?: string };

      switch (task.type) {
        case 'extractDominantColor': {
          const dominantColor = await extractDominantColor(task.imageBuffer);
          result = {
            success: true,
            data: dominantColor,
          };
          break;
        }

        case 'validateImage': {
          const validation = await validateImage(task.imageBuffer, task.maxSizeBytes);
          result = {
            success: validation.success,
            data: validation,
            error: validation.error,
          };
          break;
        }

        default: {
          result = {
            success: false,
            error: `Unknown task type: ${(task as { type: string }).type}`,
          };
        }
      }

      parentPort?.postMessage(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      parentPort?.postMessage({
        success: false,
        error: errorMessage,
      });
    }
  })().catch((error) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    parentPort?.postMessage({
      success: false,
      error: `Unhandled error: ${errorMessage}`,
    });
  });
});

/**
 * Extract dominant color from image buffer
 * Per P-3: Optimized with downsampling to 256x256 before analysis
 */
async function extractDominantColor(
  imageBuffer: Buffer
): Promise<{ r: number; g: number; b: number }> {
  try {
    // Downsample to 256x256 for faster processing (P-3 optimization)
    const stats = await sharp(imageBuffer)
      .resize(256, 256, {
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
    const maxDimension = 10000; // 10k pixels
    if (metadata.width > maxDimension || metadata.height > maxDimension) {
      return {
        success: false,
        error: `Image dimensions (${metadata.width}x${metadata.height}) exceed maximum (${maxDimension}x${maxDimension})`,
      };
    }

    // Check format
    const allowedFormats = ['png', 'jpeg', 'jpg', 'gif', 'webp', 'bmp'];
    if (!metadata.format || !allowedFormats.includes(metadata.format)) {
      return {
        success: false,
        error: `Unsupported image format: ${metadata.format || 'unknown'}`,
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
