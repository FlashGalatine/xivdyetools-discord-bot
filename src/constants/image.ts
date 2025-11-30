/**
 * Image processing constants
 * Single source of truth for all image-related limits
 *
 * SECURITY: These limits prevent decompression bombs and DoS attacks.
 * Any changes should be carefully reviewed for security implications.
 */

/**
 * Maximum dimension (width or height) in pixels
 * 4096 is chosen as it's:
 * - Large enough for high-quality Discord uploads
 * - Small enough to prevent memory exhaustion (4096^2 * 4 bytes = 67MB)
 * - Matches Discord's typical image size limits
 */
export const MAX_DIMENSION = 4096;

/**
 * Maximum total pixel count
 * 16,777,216 (4096^2) prevents memory exhaustion on decompression
 * A 4096x4096 RGBA image uses ~67MB of memory
 */
export const MAX_PIXEL_COUNT = 16_777_216;

/**
 * Allowed image formats (MIME type suffixes from Sharp)
 * - jpeg/jpg: Standard photo format
 * - png: Lossless with transparency
 * - webp: Modern efficient format
 * - gif: For simple images/animations
 *
 * Note: BMP is intentionally excluded as it's uncompressed and
 * could enable zip-bomb style attacks
 */
export const ALLOWED_FORMATS = ['jpeg', 'png', 'webp', 'gif'] as const;
export type AllowedFormat = (typeof ALLOWED_FORMATS)[number];

/**
 * Downsampling size for color extraction
 * 256x256 is sufficient for dominant color detection
 * and significantly reduces processing time
 */
export const COLOR_EXTRACTION_SIZE = 256;

/**
 * Default image processing timeout (milliseconds)
 */
export const PROCESSING_TIMEOUT_MS = 10_000;

/**
 * Helper to check if a format is allowed
 */
export function isAllowedFormat(format: string | undefined): format is AllowedFormat {
  return format !== undefined && ALLOWED_FORMATS.includes(format as AllowedFormat);
}
