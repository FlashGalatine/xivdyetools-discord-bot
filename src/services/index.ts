/**
 * Service singletons module
 *
 * Provides centralized, singleton instances of commonly used services.
 * This prevents redundant instantiation and ensures consistent state.
 *
 * Per R-2: DRY principle - single source of service instances
 */

import { DyeService, dyeDatabase } from 'xivdyetools-core';

/**
 * Singleton DyeService instance
 *
 * DyeService is stateless and thread-safe, so a single instance
 * can be safely shared across all commands and utilities.
 *
 * @example
 * ```typescript
 * import { dyeService } from '../services/index.js';
 *
 * const closestDye = dyeService.findClosestDye('#FF0000');
 * ```
 */
export const dyeService = new DyeService(dyeDatabase);

// Re-export commonly used services for convenience
export { emojiService } from './emoji-service.js';
export { i18nService, t } from './i18n-service.js';
export { logger } from '../utils/logger.js';

// Re-export types
export type { BotCommand } from '../types/index.js';
