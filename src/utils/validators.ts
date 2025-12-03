/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any */
/**
 * Input validation utilities
 * Enhanced with strict validation per S-1 security requirements
 */

import { ChatInputCommandInteraction, ApplicationCommandOptionType } from 'discord.js';
import { DyeService, dyeDatabase, type Dye } from 'xivdyetools-core';
import { t } from '../services/i18n-service.js';

// Initialize DyeService
const dyeService = new DyeService(dyeDatabase);

/**
 * Result type for validation operations
 */
export type ValidationResult<T> = { success: true; value: T } | { success: false; error: string };

/**
 * Validate hex color format with strict normalization
 * Per S-1: Strict regex, normalization, prevents edge cases
 */
export function validateHexColor(hex: string): ValidationResult<string> {
  // Normalize: trim and uppercase
  let normalized = hex.trim().toUpperCase();

  // Check if it's a 6-character hex string without hash and prepend it
  if (/^[0-9A-F]{6}$/.test(normalized)) {
    normalized = `#${normalized}`;
  }

  // Strict regex: must be exactly #RRGGBB
  if (!/^#[0-9A-F]{6}$/.test(normalized)) {
    return {
      success: false,
      error: t('errors.invalidHexFormat', { hex }),
    };
  }

  return { success: true, value: normalized };
}

// Cache valid dye IDs for quick lookup
let validDyeIds: Set<number> | null = null;

/** Per Issue #6: Cache max dye ID derived from actual data */
let maxDyeId: number | null = null;

/**
 * Get the set of valid dye IDs (lazily initialized)
 */
function getValidDyeIds(): Set<number> {
  if (validDyeIds === null) {
    const allDyes = dyeService.getAllDyes();
    validDyeIds = new Set(allDyes.map((dye) => dye.id));
  }
  return validDyeIds;
}

/**
 * Get the maximum dye ID from actual database (lazily initialized)
 * Per Issue #6: Derives max from data instead of arbitrary hardcoded value
 */
function getMaxDyeId(): number {
  if (maxDyeId === null) {
    const validIds = getValidDyeIds();
    maxDyeId = Math.max(...validIds);
    // Add headroom for future dyes (20% buffer, minimum 10)
    maxDyeId = maxDyeId + Math.max(10, Math.floor(maxDyeId * 0.2));
  }
  return maxDyeId;
}

/**
 * Validate dye ID with optional database verification
 * Per S-1: Validates against real dye data when strict mode is enabled
 *
 * @param id - The dye ID to validate
 * @param strict - If true, validates ID exists in database. If false, only checks bounds. Default: false
 */
export function validateDyeId(id: number, strict = false): ValidationResult<number> {
  if (!Number.isInteger(id)) {
    return {
      success: false,
      error: t('errors.dyeIdMustBeInteger'),
    };
  }

  if (id < 1) {
    return {
      success: false,
      error: t('errors.dyeIdMustBePositive'),
    };
  }

  // Per Issue #6: Quick bounds check using max ID derived from actual data
  const maxId = getMaxDyeId();
  if (id > maxId) {
    return {
      success: false,
      error: t('errors.dyeIdOutOfRange'),
    };
  }

  // Strict validation: check if ID exists in database
  if (strict) {
    const validIds = getValidDyeIds();
    if (!validIds.has(id)) {
      return {
        success: false,
        error: t('errors.dyeIdNotFound', { id }),
      };
    }
  }

  return { success: true, value: id };
}

/**
 * Sanitize search query
 * Per S-1: Remove control characters, limit length, prevent ReDoS
 */
export function sanitizeSearchQuery(query: string): string {
  // Remove control characters (0x00-0x1F, 0x7F-0x9F)
  // eslint-disable-next-line no-control-regex
  const sanitized = query.replace(/[\x00-\x1F\x7F-\x9F]/g, '');

  // Limit length to 50 characters (prevent ReDoS via complex patterns)
  const limited = sanitized.substring(0, 50);

  // Trim whitespace
  return limited.trim();
}

/**
 * Legacy validateHexColor for backward compatibility
 * @deprecated Use validateHexColor which returns ValidationResult
 */
export function validateHexColorLegacy(color: string): { valid: boolean; error?: string } {
  const result = validateHexColor(color);
  if (result.success) {
    return { valid: true };
  }
  return { valid: false, error: result.error };
}

/**
 * Find dye by name (case-insensitive, fuzzy matching)
 * Enhanced with input sanitization per S-1
 */
export function findDyeByName(name: string): { dye?: Dye; error?: string } {
  // Sanitize input to prevent injection attacks
  const sanitized = sanitizeSearchQuery(name);

  if (sanitized.length === 0) {
    return {
      error: t('errors.dyeNameEmpty'),
    };
  }

  // Try search by name
  const searchResults = dyeService.searchByName(sanitized);
  if (searchResults.length > 0) {
    // Return the best match
    return { dye: searchResults[0] };
  }

  return {
    error: t('errors.dyeNotFoundSearch', { name: sanitized }),
  };
}

/**
 * Validate data center name
 */
export function validateDataCenter(dc: string): { valid: boolean; error?: string } {
  const validDataCenters = [
    // North America
    'Aether',
    'Crystal',
    'Dynamis',
    'Primal',
    // Europe
    'Chaos',
    'Light',
    // Oceania
    'Materia',
    // Japan
    'Elemental',
    'Gaia',
    'Mana',
    'Meteor',
    // China (CJK characters)
    '陆行鸟',
    '莫古力',
    '猫小胖',
    '豆豆柴',
    // Korea
    '한국',
  ];

  if (!validDataCenters.includes(dc)) {
    return {
      valid: false,
      error: t('errors.invalidDataCenter', { dc }),
    };
  }

  return { valid: true };
}

/**
 * Validate harmony type
 */
export function validateHarmonyType(type: string): { valid: boolean; error?: string } {
  const validTypes = [
    'complementary',
    'analogous',
    'triadic',
    'split_complementary',
    'tetradic',
    'square',
    'monochromatic',
    'compound',
    'shades',
  ];

  if (!validTypes.includes(type)) {
    return {
      valid: false,
      error: t('errors.invalidHarmonyTypeOption', { type }),
    };
  }

  return { valid: true };
}

/**
 * Validate integer in range
 */
export function validateIntRange(
  value: number,
  min: number,
  max: number,
  paramName: string
): { valid: boolean; error?: string } {
  if (!Number.isInteger(value)) {
    return {
      valid: false,
      error: t('errors.paramMustBeInteger', { param: paramName }),
    };
  }

  if (value < min || value > max) {
    return {
      valid: false,
      error: t('errors.paramMustBeBetween', { param: paramName, min, max }),
    };
  }

  return { valid: true };
}

/**
 * Validate all command inputs before execution
 * Per S-1: Pre-execution validation layer
 */
export function validateCommandInputs(
  interaction: ChatInputCommandInteraction
): ValidationResult<void> {
  const commandName = interaction.commandName;

  try {
    // Validate based on command type
    switch (commandName) {
      case 'match':
      case 'harmony':
      case 'comparison':
      case 'mixer':
      case 'accessibility': {
        // These commands accept color inputs (hex or dye name)
        const colorOption =
          interaction.options.getString('color') ||
          interaction.options.getString('base_color') ||
          interaction.options.getString('dye1') ||
          interaction.options.getString('dye2') ||
          interaction.options.getString('start_color') ||
          interaction.options.getString('end_color');

        if (colorOption) {
          // If it looks like a hex color, validate it strictly
          if (colorOption.trim().startsWith('#')) {
            const hexResult = validateHexColor(colorOption);
            if (!hexResult.success) {
              return hexResult;
            }
          }
          // Otherwise, it's a dye name - sanitize it
          const sanitized = sanitizeSearchQuery(colorOption);
          if (sanitized.length === 0) {
            return {
              success: false,
              error: t('errors.colorInputEmpty'),
            };
          }
        }
        break;
      }

      case 'dye': {
        // Dye command has subcommands
        const subcommand = interaction.options.getSubcommand();
        if (subcommand === 'info' || subcommand === 'search') {
          const query =
            interaction.options.getString('name') || interaction.options.getString('query');
          if (query) {
            const sanitized = sanitizeSearchQuery(query);
            if (sanitized.length === 0) {
              return {
                success: false,
                error: t('errors.searchQueryEmpty'),
              };
            }
          }
        }
        break;
      }
    }

    // Validate integer options (dye IDs, counts, etc.)
    // Note: Using non-strict validation for quick bounds check during pre-execution
    const integerOptions = interaction.options.data.filter(
      (opt) => opt.type === ApplicationCommandOptionType.Integer
    );
    for (const opt of integerOptions) {
      if (opt.value !== null && typeof opt.value === 'number') {
        // Check if it's a dye ID - use non-strict (bounds-only) for pre-execution validation
        if (opt.name.includes('dye') || opt.name.includes('id')) {
          const dyeIdResult = validateDyeId(opt.value, false);
          if (!dyeIdResult.success) {
            return dyeIdResult;
          }
        }
      }
    }

    return { success: true, value: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : t('errors.validationError'),
    };
  }
}
