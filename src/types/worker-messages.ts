/**
 * Worker communication type definitions
 *
 * Provides type-safe interfaces for communication between
 * the main thread and worker threads.
 *
 * Per R-2: Type safety for inter-thread communication
 */

/**
 * RGB color result
 */
export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

/**
 * Image validation result
 */
export interface ImageValidationResult {
  success: boolean;
  error?: string;
  width?: number;
  height?: number;
  format?: string;
}

// ============================================
// Worker Task Types (Main Thread -> Worker)
// ============================================

/**
 * Task to extract dominant color from an image
 */
export interface ExtractDominantColorTask {
  type: 'extractDominantColor';
  imageBuffer: Buffer;
}

/**
 * Task to validate an image
 */
export interface ValidateImageTask {
  type: 'validateImage';
  imageBuffer: Buffer;
  maxSizeBytes: number;
}

/**
 * Union of all worker task types
 */
export type WorkerTask = ExtractDominantColorTask | ValidateImageTask;

/**
 * Get the task type string from a task
 */
export type TaskType = WorkerTask['type'];

// ============================================
// Worker Response Types (Worker -> Main Thread)
// ============================================

/**
 * Base response structure from worker
 */
export interface WorkerResponseBase {
  success: boolean;
  error?: string;
}

/**
 * Successful color extraction response
 */
export interface ExtractDominantColorResponse extends WorkerResponseBase {
  success: true;
  data: RgbColor;
}

/**
 * Successful validation response
 */
export interface ValidateImageResponse extends WorkerResponseBase {
  success: true;
  data: ImageValidationResult;
}

/**
 * Error response from worker
 */
export interface WorkerErrorResponse extends WorkerResponseBase {
  success: false;
  error: string;
}

/**
 * Union of all worker response types
 */
export type WorkerResponse =
  | ExtractDominantColorResponse
  | ValidateImageResponse
  | WorkerErrorResponse;

// ============================================
// Type Guards
// ============================================

/**
 * Check if a response is successful
 */
export function isSuccessResponse(
  response: WorkerResponse
): response is ExtractDominantColorResponse | ValidateImageResponse {
  return response.success === true;
}

/**
 * Check if a response is an error
 */
export function isErrorResponse(response: WorkerResponse): response is WorkerErrorResponse {
  return response.success === false;
}

/**
 * Check if a task is an extract dominant color task
 */
export function isExtractDominantColorTask(task: WorkerTask): task is ExtractDominantColorTask {
  return task.type === 'extractDominantColor';
}

/**
 * Check if a task is a validate image task
 */
export function isValidateImageTask(task: WorkerTask): task is ValidateImageTask {
  return task.type === 'validateImage';
}

// ============================================
// Factory Functions
// ============================================

/**
 * Create an extract dominant color task
 */
export function createExtractDominantColorTask(imageBuffer: Buffer): ExtractDominantColorTask {
  return {
    type: 'extractDominantColor',
    imageBuffer,
  };
}

/**
 * Create a validate image task
 */
export function createValidateImageTask(
  imageBuffer: Buffer,
  maxSizeBytes: number
): ValidateImageTask {
  return {
    type: 'validateImage',
    imageBuffer,
    maxSizeBytes,
  };
}

/**
 * Create a success response for color extraction
 */
export function createColorResponse(color: RgbColor): ExtractDominantColorResponse {
  return {
    success: true,
    data: color,
  };
}

/**
 * Create a success response for validation
 */
export function createValidationResponse(result: ImageValidationResult): ValidateImageResponse {
  return {
    success: true,
    data: result,
  };
}

/**
 * Create an error response
 */
export function createErrorResponse(error: string): WorkerErrorResponse {
  return {
    success: false,
    error,
  };
}
