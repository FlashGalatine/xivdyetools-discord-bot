/**
 * Unit tests for validator utilities
 */

import { describe, it, expect } from 'vitest';
import {
    validateHexColor,
    validateHarmonyType,
    validateDataCenter,
    validateIntRange,
    findDyeByName,
} from './validators.js';

describe('validateHexColor', () => {
    it('should accept valid hex colors with #', () => {
        expect(validateHexColor('#FF0000')).toEqual({ valid: true });
        expect(validateHexColor('#00FF00')).toEqual({ valid: true });
        expect(validateHexColor('#0000FF')).toEqual({ valid: true });
        expect(validateHexColor('#ABCDEF')).toEqual({ valid: true });
        expect(validateHexColor('#123456')).toEqual({ valid: true });
    });

    it('should require # prefix', () => {
        expect(validateHexColor('FF0000').valid).toBe(false);
        expect(validateHexColor('00FF00').valid).toBe(false);
        expect(validateHexColor('ABCDEF').valid).toBe(false);
    });

    it('should accept lowercase hex colors with #', () => {
        expect(validateHexColor('#ff0000')).toEqual({ valid: true });
        expect(validateHexColor('#abcdef')).toEqual({ valid: true });
        expect(validateHexColor('#FfAa00')).toEqual({ valid: true });
    });

    it('should reject invalid hex colors', () => {
        const invalid = validateHexColor('#GG0000');
        expect(invalid.valid).toBe(false);
        expect(invalid.error).toContain('Invalid hex color format');
    });

    it('should reject hex colors with wrong length', () => {
        expect(validateHexColor('#FFF').valid).toBe(false);
        expect(validateHexColor('#FFFFFFF').valid).toBe(false);
        expect(validateHexColor('FF').valid).toBe(false);
    });

    it('should reject empty strings', () => {
        expect(validateHexColor('').valid).toBe(false);
    });

    it('should reject non-hex characters', () => {
        expect(validateHexColor('#GGGGGG').valid).toBe(false);
        expect(validateHexColor('#ZZZZZZ').valid).toBe(false);
        expect(validateHexColor('HELLO!').valid).toBe(false);
    });
});

describe('validateHarmonyType', () => {
    it('should accept all valid harmony types', () => {
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

        validTypes.forEach(type => {
            expect(validateHarmonyType(type)).toEqual({ valid: true });
        });
    });

    it('should reject invalid harmony types', () => {
        const invalid = validateHarmonyType('invalid_type');
        expect(invalid.valid).toBe(false);
        expect(invalid.error).toContain('Invalid harmony type');
    });

    it('should reject empty string', () => {
        expect(validateHarmonyType('').valid).toBe(false);
    });

    it('should be case-sensitive', () => {
        expect(validateHarmonyType('COMPLEMENTARY').valid).toBe(false);
        expect(validateHarmonyType('Triadic').valid).toBe(false);
    });
});

describe('validateDataCenter', () => {
    it('should accept all NA data centers', () => {
        const naCenters = ['Aether', 'Primal', 'Crystal', 'Dynamis'];
        naCenters.forEach(dc => {
            expect(validateDataCenter(dc)).toEqual({ valid: true });
        });
    });

    it('should accept all EU data centers', () => {
        const euCenters = ['Chaos', 'Light'];
        euCenters.forEach(dc => {
            expect(validateDataCenter(dc)).toEqual({ valid: true });
        });
    });

    it('should accept all JP data centers', () => {
        const jpCenters = ['Elemental', 'Gaia', 'Mana', 'Meteor'];
        jpCenters.forEach(dc => {
            expect(validateDataCenter(dc)).toEqual({ valid: true });
        });
    });

    it('should accept OCE data center', () => {
        expect(validateDataCenter('Materia')).toEqual({ valid: true });
    });

    it('should reject invalid data centers', () => {
        const invalid = validateDataCenter('InvalidDC');
        expect(invalid.valid).toBe(false);
        expect(invalid.error).toContain('Invalid data center');
    });

    it('should be case-sensitive', () => {
        expect(validateDataCenter('aether').valid).toBe(false);
        expect(validateDataCenter('PRIMAL').valid).toBe(false);
        expect(validateDataCenter('Aether').valid).toBe(true);
        expect(validateDataCenter('Primal').valid).toBe(true);
        expect(validateDataCenter('Chaos').valid).toBe(true);
    });
});

describe('validateIntRange', () => {
    it('should accept values within range', () => {
        expect(validateIntRange(5, 1, 10, 'Test')).toEqual({ valid: true });
        expect(validateIntRange(1, 1, 10, 'Test')).toEqual({ valid: true });
        expect(validateIntRange(10, 1, 10, 'Test')).toEqual({ valid: true });
    });

    it('should reject values below minimum', () => {
        const invalid = validateIntRange(0, 1, 10, 'Test');
        expect(invalid.valid).toBe(false);
        expect(invalid.error).toContain('must be between 1 and 10');
    });

    it('should reject values above maximum', () => {
        const invalid = validateIntRange(11, 1, 10, 'Test');
        expect(invalid.valid).toBe(false);
        expect(invalid.error).toContain('must be between 1 and 10');
    });

    it('should use custom field name in error message', () => {
        const invalid = validateIntRange(0, 1, 10, 'Steps');
        expect(invalid.error).toContain('Steps must be between 1 and 10');
    });

    it('should handle negative ranges', () => {
        expect(validateIntRange(-5, -10, 0, 'Test').valid).toBe(true);
        expect(validateIntRange(-11, -10, 0, 'Test').valid).toBe(false);
    });
});

describe('findDyeByName', () => {
    it('should find exact dye name matches', () => {
        const result = findDyeByName('Dalamud Red');
        expect(result.error).toBeUndefined();
        expect(result.dye).toBeDefined();
        expect(result.dye?.name).toBe('Dalamud Red');
    });

    it('should be case-insensitive', () => {
        const lower = findDyeByName('dalamud red');
        const upper = findDyeByName('DALAMUD RED');
        const mixed = findDyeByName('DaLaMuD rEd');

        expect(lower.dye?.name).toBe('Dalamud Red');
        expect(upper.dye?.name).toBe('Dalamud Red');
        expect(mixed.dye?.name).toBe('Dalamud Red');
    });

    it('should find dyes with partial matches', () => {
        // "Snow White" should be found
        const result = findDyeByName('Snow');
        expect(result.dye).toBeDefined();
        expect(result.dye?.name).toContain('Snow');
    });

    it('should return error for non-existent dyes', () => {
        const result = findDyeByName('Nonexistent Dye Name');
        expect(result.error).toBeDefined();
        expect(result.error).toContain('Dye not found');
        expect(result.dye).toBeUndefined();
    });

    it('should return error for empty string', () => {
        const result = findDyeByName('');
        expect(result.error).toBeDefined();
        expect(result.dye).toBeUndefined();
    });

    it('should find common dyes', () => {
        const commonDyes = [
            'Snow White',
            'Soot Black',
            'Dalamud Red',
            'Azure Blue',
            'Marsh Green',
        ];

        commonDyes.forEach(dyeName => {
            const result = findDyeByName(dyeName);
            expect(result.error).toBeUndefined();
            expect(result.dye?.name).toBe(dyeName);
        });
    });

    it('should handle dyes with special characters', () => {
        // Testing if dyes with apostrophes, hyphens, etc. work
        const result = findDyeByName('Hunter Green');
        expect(result.error).toBeUndefined();
        expect(result.dye).toBeDefined();
    });

    it('should trim whitespace', () => {
        const result = findDyeByName('  Dalamud Red  ');
        expect(result.error).toBeUndefined();
        expect(result.dye?.name).toBe('Dalamud Red');
    });
});
