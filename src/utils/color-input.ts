/**
 * Unified color input parsing utilities
 *
 * Consolidates the common pattern of parsing user input that can be either:
 * - A hex color (e.g., "#FF0000")
 * - A dye name (e.g., "Dalamud Red")
 *
 * Per R-2: DRY principle - shared parsing logic across commands
 */

import { AutocompleteInteraction } from 'discord.js';
import { LocalizationService, type Dye } from 'xivdyetools-core';
import { validateHexColor, findDyeByName } from './validators.js';
import { dyeService } from '../services/index.js';

/**
 * Result of parsing a color input
 */
export type ColorParseResult =
  | {
      success: true;
      /** The hex color (either from direct input or from the matched dye) */
      hex: string;
      /** The matched dye (if input was a dye name, or closest match if hex input) */
      dye: Dye;
      /** Whether the input was a hex color (true) or dye name (false) */
      wasHexInput: boolean;
    }
  | {
      success: false;
      error: string;
      /** The original input for error messages */
      input: string;
    };

/**
 * Parse a user's color input (hex or dye name) into a color and dye
 *
 * This unified function handles both:
 * - Hex colors: Validates, normalizes, and finds the closest dye
 * - Dye names: Looks up the dye by name
 *
 * @param input - The user's input (hex color or dye name)
 * @returns ColorParseResult with either success data or error
 *
 * @example
 * ```typescript
 * const result = parseColorInput('#FF0000');
 * if (result.success) {
 *   console.log(result.hex);  // '#FF0000'
 *   console.log(result.dye);  // closest dye object
 * }
 *
 * const result2 = parseColorInput('Dalamud Red');
 * if (result2.success) {
 *   console.log(result2.hex);  // dye's hex color
 *   console.log(result2.dye);  // Dalamud Red dye object
 * }
 * ```
 */
export function parseColorInput(input: string): ColorParseResult {
  const hexValidation = validateHexColor(input);

  if (hexValidation.success) {
    // Input is a valid hex color
    const hex = hexValidation.value;
    const closestDye = dyeService.findClosestDye(hex);

    if (!closestDye) {
      return {
        success: false,
        error: `Could not find a matching dye for hex color ${hex}`,
        input,
      };
    }

    return {
      success: true,
      hex,
      dye: closestDye,
      wasHexInput: true,
    };
  }

  // Input is not a hex color, try as dye name
  const dyeResult = findDyeByName(input);

  if (dyeResult.error || !dyeResult.dye) {
    return {
      success: false,
      error: dyeResult.error || `Could not find dye "${input}"`,
      input,
    };
  }

  return {
    success: true,
    hex: dyeResult.dye.hex,
    dye: dyeResult.dye,
    wasHexInput: false,
  };
}

/**
 * Parse a color input and return the hex color only
 * Useful when you only need the color value
 *
 * @param input - The user's input (hex color or dye name)
 * @returns The hex color string, or null if parsing failed
 */
export function parseColorToHex(input: string): string | null {
  const result = parseColorInput(input);
  return result.success ? result.hex : null;
}

/**
 * Options for dye autocomplete filtering
 */
export interface DyeAutocompleteOptions {
  /** Minimum query length to start returning results (default: 0) */
  minQueryLength?: number;
  /** Maximum number of results (default: 25, max Discord allows) */
  maxResults?: number;
  /** Categories to exclude (default: ['Facewear']) */
  excludeCategories?: string[];
}

/**
 * Standard dye autocomplete handler
 *
 * This unified function handles the common pattern of:
 * 1. Skip if query looks like a hex color
 * 2. Search dyes by both English and localized names
 * 3. Exclude certain categories (Facewear by default)
 * 4. Return localized display names with category
 *
 * @param interaction - The autocomplete interaction
 * @param focusedOptionName - The name of the focused option
 * @param options - Optional configuration
 *
 * @example
 * ```typescript
 * async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
 *   const focused = interaction.options.getFocused(true);
 *   if (['dye', 'color', 'base_color'].includes(focused.name)) {
 *     await handleDyeAutocomplete(interaction, focused.name);
 *   }
 * }
 * ```
 */
export async function handleDyeAutocomplete(
  interaction: AutocompleteInteraction,
  _focusedOptionName: string,
  options: DyeAutocompleteOptions = {}
): Promise<void> {
  const { minQueryLength = 0, maxResults = 25, excludeCategories = ['Facewear'] } = options;

  const query = interaction.options.getFocused().toLowerCase();

  // If it looks like a hex color, don't suggest dyes
  if (query.startsWith('#')) {
    await interaction.respond([]);
    return;
  }

  // Check minimum query length
  if (query.length < minQueryLength) {
    await interaction.respond([]);
    return;
  }

  // Search for matching dyes
  const allDyes = dyeService.getAllDyes();
  const matches = allDyes
    .filter((dye) => {
      // Exclude specified categories
      if (excludeCategories.includes(dye.category)) {
        return false;
      }

      // Match both localized and English names (case-insensitive)
      const localizedName = LocalizationService.getDyeName(dye.id);
      return (
        dye.name.toLowerCase().includes(query) ||
        (localizedName && localizedName.toLowerCase().includes(query))
      );
    })
    .slice(0, maxResults)
    .map((dye) => {
      const localizedName = LocalizationService.getDyeName(dye.id);
      const localizedCategory = LocalizationService.getCategory(dye.category);
      return {
        name: `${localizedName || dye.name} (${localizedCategory || dye.category})`,
        value: dye.name, // Keep English name as value for lookup
      };
    });

  await interaction.respond(matches);
}

/**
 * Get all dyes for autocomplete without filtering
 * Useful for showing all options when query is empty
 */
export function getAllDyesForAutocomplete(
  options: DyeAutocompleteOptions = {}
): Array<{ name: string; value: string }> {
  const { maxResults = 25, excludeCategories = ['Facewear'] } = options;

  const allDyes = dyeService.getAllDyes();
  return allDyes
    .filter((dye) => !excludeCategories.includes(dye.category))
    .slice(0, maxResults)
    .map((dye) => {
      const localizedName = LocalizationService.getDyeName(dye.id);
      const localizedCategory = LocalizationService.getCategory(dye.category);
      return {
        name: `${localizedName || dye.name} (${localizedCategory || dye.category})`,
        value: dye.name,
      };
    });
}

// Note: For direct DyeService access, import { dyeService } from '../services/index.js'
