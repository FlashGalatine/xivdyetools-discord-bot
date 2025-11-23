/**
 * Input validation utilities
 */

import { DyeService, dyeDatabase, type Dye } from 'xivdyetools-core';

// Initialize DyeService
const dyeService = new DyeService(dyeDatabase);

/**
 * Validate hex color format
 */
export function validateHexColor(color: string): { valid: boolean; error?: string } {
    const hexRegex = /^#[0-9A-Fa-f]{6}$/;

    if (!hexRegex.test(color)) {
        return {
            valid: false,
            error: `Invalid hex color format: "${color}". Please use the format #RRGGBB (e.g., #FF0000 for red).`,
        };
    }

    return { valid: true };
}

/**
 * Find dye by name (case-insensitive, fuzzy matching)
 */
export function findDyeByName(name: string): { dye?: Dye; error?: string } {
    // Try search by name
    const searchResults = dyeService.searchByName(name);
    if (searchResults.length > 0) {
        // Return the best match
        return { dye: searchResults[0] };
    }

    return {
        error: `Dye not found: "${name}". Use autocomplete or search to find available dyes.`,
    };
}

/**
 * Validate data center name
 */
export function validateDataCenter(dc: string): { valid: boolean; error?: string } {
    const validDataCenters = [
        // North America
        'Aether', 'Crystal', 'Dynamis', 'Primal',
        // Europe
        'Chaos', 'Light',
        // Oceania
        'Materia',
        // Japan
        'Elemental', 'Gaia', 'Mana', 'Meteor',
        // China (CJK characters)
        '陆行鸟', '莫古力', '猫小胖', '豆豆柴',
        // Korea
        '한국',
    ];

    if (!validDataCenters.includes(dc)) {
        return {
            valid: false,
            error: `Invalid data center: "${dc}". Please choose from the available options.`,
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
            error: `Invalid harmony type: "${type}". Please choose from the available options.`,
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
            error: `${paramName} must be an integer.`,
        };
    }

    if (value < min || value > max) {
        return {
            valid: false,
            error: `${paramName} must be between ${min} and ${max}.`,
        };
    }

    return { valid: true };
}
