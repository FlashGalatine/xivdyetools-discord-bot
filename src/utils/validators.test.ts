/**
 * Unit tests for validator utilities
 */

import { describe, it, expect } from 'vitest';
import {
    validateHexColor,
    validateHexColorLegacy,
    validateDyeId,
    sanitizeSearchQuery,
    validateHarmonyType,
    validateDataCenter,
    validateIntRange,
    validateCommandInputs,
    findDyeByName,
} from './validators.js';
import type { ChatInputCommandInteraction, CommandInteractionOption } from 'discord.js';
import { ApplicationCommandOptionType } from 'discord.js';

describe('validateHexColor', () => {
    it('should accept valid hex colors with #', () => {
        expect(validateHexColor('#FF0000')).toEqual({ success: true, value: '#FF0000' });
        expect(validateHexColor('#00FF00')).toEqual({ success: true, value: '#00FF00' });
        expect(validateHexColor('#0000FF')).toEqual({ success: true, value: '#0000FF' });
        expect(validateHexColor('#ABCDEF')).toEqual({ success: true, value: '#ABCDEF' });
        expect(validateHexColor('#123456')).toEqual({ success: true, value: '#123456' });
    });

    it('should accept hex colors without # prefix and normalize them', () => {
        expect(validateHexColor('FF0000')).toEqual({ success: true, value: '#FF0000' });
        expect(validateHexColor('00FF00')).toEqual({ success: true, value: '#00FF00' });
        expect(validateHexColor('ABCDEF')).toEqual({ success: true, value: '#ABCDEF' });
    });

    it('should normalize lowercase hex colors to uppercase', () => {
        expect(validateHexColor('#ff0000')).toEqual({ success: true, value: '#FF0000' });
        expect(validateHexColor('#abcdef')).toEqual({ success: true, value: '#ABCDEF' });
        expect(validateHexColor('#FfAa00')).toEqual({ success: true, value: '#FFAA00' });
    });

    it('should trim whitespace and normalize', () => {
        expect(validateHexColor('  #ff0000  ')).toEqual({ success: true, value: '#FF0000' });
        expect(validateHexColor('  #ABCDEF  ')).toEqual({ success: true, value: '#ABCDEF' });
    });

    it('should reject invalid hex colors', () => {
        const invalid = validateHexColor('#GG0000');
        expect(invalid.success).toBe(false);
        if (!invalid.success) {
            expect(invalid.error).toContain('Invalid hex color format');
        }
    });

    it('should reject hex colors with wrong length', () => {
        expect(validateHexColor('#FFF').success).toBe(false);
        expect(validateHexColor('#FFFFFFF').success).toBe(false);
        expect(validateHexColor('FF').success).toBe(false);
    });

    it('should reject empty strings', () => {
        expect(validateHexColor('').success).toBe(false);
    });

    it('should reject non-hex characters', () => {
        expect(validateHexColor('#GGGGGG').success).toBe(false);
        expect(validateHexColor('#ZZZZZZ').success).toBe(false);
        expect(validateHexColor('HELLO!').success).toBe(false);
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
        if (!invalid.valid) {
            expect(invalid.error).toContain('Invalid harmony type');
        }
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
        if (!invalid.valid) {
            expect(invalid.error).toContain('Invalid data center');
        }
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
        if (!invalid.valid) {
            expect(invalid.error).toContain('must be between 1 and 10');
        }
    });

    it('should reject values above maximum', () => {
        const invalid = validateIntRange(11, 1, 10, 'Test');
        expect(invalid.valid).toBe(false);
        if (!invalid.valid) {
            expect(invalid.error).toContain('must be between 1 and 10');
        }
    });

    it('should use custom field name in error message', () => {
        const invalid = validateIntRange(0, 1, 10, 'Steps');
        if (!invalid.valid) {
            expect(invalid.error).toContain('Steps must be between 1 and 10');
        }
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

describe('validateDyeId', () => {
    it('should accept valid dye IDs in range', () => {
        expect(validateDyeId(1)).toEqual({ success: true, value: 1 });
        expect(validateDyeId(50)).toEqual({ success: true, value: 50 });
        expect(validateDyeId(125)).toEqual({ success: true, value: 125 });
        expect(validateDyeId(200)).toEqual({ success: true, value: 200 });
    });

    it('should reject non-integer values', () => {
        expect(validateDyeId(1.5).success).toBe(false);
        expect(validateDyeId(50.9).success).toBe(false);
    });

    it('should reject negative IDs', () => {
        expect(validateDyeId(-1).success).toBe(false);
        expect(validateDyeId(0).success).toBe(false);
    });

    it('should reject IDs out of range', () => {
        // Per Issue #6: Max ID is now derived from database with 20% headroom
        // Using extremely large IDs that will definitely be out of range (max is typically around 40000)
        expect(validateDyeId(9999999).success).toBe(false);
        expect(validateDyeId(99999999).success).toBe(false);
    });
});

describe('sanitizeSearchQuery', () => {
    it('should remove control characters', () => {
        const malicious = '\x00\x1F<script>alert(1)</script>';
        const sanitized = sanitizeSearchQuery(malicious);
        expect(sanitized).not.toContain('\x00');
        expect(sanitized).not.toContain('\x1F');
    });

    it('should limit length to 50 characters', () => {
        const longQuery = 'a'.repeat(100);
        const sanitized = sanitizeSearchQuery(longQuery);
        expect(sanitized.length).toBeLessThanOrEqual(50);
    });

    it('should trim whitespace', () => {
        expect(sanitizeSearchQuery('  test  ')).toBe('test');
        expect(sanitizeSearchQuery('\t\ntest\n\t')).toBe('test');
    });

    it('should preserve valid characters', () => {
        expect(sanitizeSearchQuery('Dalamud Red')).toBe('Dalamud Red');
        expect(sanitizeSearchQuery('Snow White-123')).toBe('Snow White-123');
    });
});

describe('validateHexColorLegacy', () => {
    it('should return valid: true for valid hex colors', () => {
        expect(validateHexColorLegacy('#FF0000')).toEqual({ valid: true });
        expect(validateHexColorLegacy('#00FF00')).toEqual({ valid: true });
        expect(validateHexColorLegacy('ABCDEF')).toEqual({ valid: true });
    });

    it('should return valid: false with error for invalid hex colors', () => {
        const result = validateHexColorLegacy('#GG0000');
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
    });

    it('should handle lowercase hex colors', () => {
        expect(validateHexColorLegacy('#ff0000')).toEqual({ valid: true });
    });
});

describe('validateIntRange - non-integer values', () => {
    it('should reject floating point values', () => {
        const result = validateIntRange(5.5, 1, 10, 'Count');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Count');
    });

    it('should reject NaN', () => {
        const result = validateIntRange(NaN, 1, 10, 'Test');
        expect(result.valid).toBe(false);
    });

    it('should reject Infinity', () => {
        const result = validateIntRange(Infinity, 1, 10, 'Test');
        expect(result.valid).toBe(false);
    });
});

/**
 * Create mock interaction for testing validateCommandInputs
 */
function createMockInteraction(options: {
    commandName: string;
    subcommand?: string;
    stringOptions?: Record<string, string | null>;
    integerOptions?: { name: string; value: number }[];
}): ChatInputCommandInteraction {
    const stringOptionsMap = options.stringOptions || {};
    const integerOptions = options.integerOptions || [];

    return {
        commandName: options.commandName,
        options: {
            getString: (name: string) => stringOptionsMap[name] ?? null,
            getSubcommand: () => options.subcommand || null,
            data: integerOptions.map((opt) => ({
                name: opt.name,
                type: ApplicationCommandOptionType.Integer,
                value: opt.value,
            })) as CommandInteractionOption[],
        },
    } as unknown as ChatInputCommandInteraction;
}

describe('validateCommandInputs', () => {
    describe('match command', () => {
        it('should accept valid hex color', () => {
            const interaction = createMockInteraction({
                commandName: 'match',
                stringOptions: { color: '#FF0000' },
            });
            const result = validateCommandInputs(interaction);
            expect(result.success).toBe(true);
        });

        it('should accept valid dye name', () => {
            const interaction = createMockInteraction({
                commandName: 'match',
                stringOptions: { color: 'Dalamud Red' },
            });
            const result = validateCommandInputs(interaction);
            expect(result.success).toBe(true);
        });

        it('should reject invalid hex color starting with #', () => {
            const interaction = createMockInteraction({
                commandName: 'match',
                stringOptions: { color: '#GGGGGG' },
            });
            const result = validateCommandInputs(interaction);
            expect(result.success).toBe(false);
        });

        it('should reject empty color input', () => {
            const interaction = createMockInteraction({
                commandName: 'match',
                stringOptions: { color: '   ' }, // whitespace only
            });
            const result = validateCommandInputs(interaction);
            expect(result.success).toBe(false);
        });
    });

    describe('harmony command', () => {
        it('should accept valid base_color option', () => {
            const interaction = createMockInteraction({
                commandName: 'harmony',
                stringOptions: { base_color: '#00FF00' },
            });
            const result = validateCommandInputs(interaction);
            expect(result.success).toBe(true);
        });
    });

    describe('comparison command', () => {
        it('should validate dye1 and dye2 options', () => {
            const interaction = createMockInteraction({
                commandName: 'comparison',
                stringOptions: { dye1: '#FF0000', dye2: '#00FF00' },
            });
            const result = validateCommandInputs(interaction);
            expect(result.success).toBe(true);
        });
    });

    describe('mixer command', () => {
        it('should validate start_color and end_color options', () => {
            const interaction = createMockInteraction({
                commandName: 'mixer',
                stringOptions: { start_color: '#FF0000', end_color: '#0000FF' },
            });
            const result = validateCommandInputs(interaction);
            expect(result.success).toBe(true);
        });
    });

    describe('accessibility command', () => {
        it('should validate color option', () => {
            const interaction = createMockInteraction({
                commandName: 'accessibility',
                stringOptions: { color: '#AABBCC' },
            });
            const result = validateCommandInputs(interaction);
            expect(result.success).toBe(true);
        });
    });

    describe('dye command', () => {
        it('should validate dye info subcommand with name', () => {
            const interaction = createMockInteraction({
                commandName: 'dye',
                subcommand: 'info',
                stringOptions: { name: 'Snow White' },
            });
            const result = validateCommandInputs(interaction);
            expect(result.success).toBe(true);
        });

        it('should validate dye search subcommand with query', () => {
            const interaction = createMockInteraction({
                commandName: 'dye',
                subcommand: 'search',
                stringOptions: { query: 'red' },
            });
            const result = validateCommandInputs(interaction);
            expect(result.success).toBe(true);
        });

        it('should reject empty search query', () => {
            const interaction = createMockInteraction({
                commandName: 'dye',
                subcommand: 'search',
                stringOptions: { query: '  ' }, // whitespace only
            });
            const result = validateCommandInputs(interaction);
            expect(result.success).toBe(false);
        });
    });

    describe('integer options validation', () => {
        it('should validate dye ID options', () => {
            const interaction = createMockInteraction({
                commandName: 'dye',
                integerOptions: [{ name: 'dye_id', value: 50 }],
            });
            const result = validateCommandInputs(interaction);
            expect(result.success).toBe(true);
        });

        it('should reject invalid dye ID (out of range)', () => {
            // Per Issue #6: Max ID is now derived from database with 20% headroom
            // Using an extremely large ID that will definitely be out of range
            const interaction = createMockInteraction({
                commandName: 'dye',
                integerOptions: [{ name: 'dye_id', value: 9999999 }],
            });
            const result = validateCommandInputs(interaction);
            expect(result.success).toBe(false);
        });
    });

    describe('unknown commands', () => {
        it('should pass validation for unknown commands without color inputs', () => {
            const interaction = createMockInteraction({
                commandName: 'unknown',
            });
            const result = validateCommandInputs(interaction);
            expect(result.success).toBe(true);
        });
    });

    describe('error handling', () => {
        it('should handle commands without options gracefully', () => {
            const interaction = createMockInteraction({
                commandName: 'match',
                stringOptions: {},
            });
            const result = validateCommandInputs(interaction);
            expect(result.success).toBe(true);
        });
    });
});
