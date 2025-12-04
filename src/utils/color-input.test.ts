/**
 * Tests for utils/color-input.ts
 *
 * Tests color input parsing and autocomplete handling
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import {
  parseColorInput,
  parseColorToHex,
  handleDyeAutocomplete,
  getAllDyesForAutocomplete,
} from './color-input.js';
import type { AutocompleteInteraction, ApplicationCommandOptionChoiceData } from 'discord.js';

describe('Color Input Utilities', () => {
  describe('parseColorInput', () => {
    describe('hex color input', () => {
      it('should parse valid hex color with hash', () => {
        const result = parseColorInput('#FF0000');
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.hex).toBe('#FF0000');
          expect(result.wasHexInput).toBe(true);
          expect(result.dye).toBeDefined();
        }
      });

      it('should parse lowercase hex color', () => {
        const result = parseColorInput('#ff0000');
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.hex).toBe('#FF0000');
          expect(result.wasHexInput).toBe(true);
        }
      });

      it('should parse mixed case hex color', () => {
        const result = parseColorInput('#Ff00Bb');
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.wasHexInput).toBe(true);
        }
      });

      it('should find closest dye for hex color', () => {
        const result = parseColorInput('#FF0000');
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.dye).toHaveProperty('name');
          expect(result.dye).toHaveProperty('hex');
          expect(result.dye).toHaveProperty('id');
        }
      });
    });

    describe('dye name input', () => {
      it('should parse valid dye name', () => {
        const result = parseColorInput('Dalamud Red');
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.wasHexInput).toBe(false);
          expect(result.dye.name).toBe('Dalamud Red');
        }
      });

      it('should parse dye name case-insensitively', () => {
        const result = parseColorInput('dalamud red');
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.dye.name).toBe('Dalamud Red');
        }
      });

      it('should parse dye name with extra whitespace', () => {
        const result = parseColorInput('  Snow White  ');
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.dye.name).toBe('Snow White');
        }
      });

      it('should return dye hex color for dye name input', () => {
        const result = parseColorInput('Snow White');
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.hex).toMatch(/^#[A-Fa-f0-9]{6}$/);
        }
      });
    });

    describe('invalid input', () => {
      it('should fail for invalid hex color', () => {
        const result = parseColorInput('#GGGGGG');
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBeDefined();
          expect(result.input).toBe('#GGGGGG');
        }
      });

      it('should fail for non-existent dye name', () => {
        const result = parseColorInput('Nonexistent Dye 12345');
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBeDefined();
        }
      });

      it('should fail for empty string', () => {
        const result = parseColorInput('');
        expect(result.success).toBe(false);
      });

      it('should fail for random characters', () => {
        const result = parseColorInput('!@#$%^&*()');
        expect(result.success).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should reject 3-character hex color (not supported)', () => {
        // The validator only supports 6-character hex
        const result = parseColorInput('#F00');
        expect(result.success).toBe(false);
      });

      it('should handle hex without hash by adding it', () => {
        // The validator normalizes by adding # to 6-char hex
        const result = parseColorInput('FF0000');
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.hex).toBe('#FF0000');
        }
      });

      it('should fail when findClosestDye returns null for hex input', async () => {
        vi.resetModules();
        vi.doMock('xivdyetools-core', () => ({
          DyeService: vi.fn().mockImplementation(() => ({
            findClosestDye: vi.fn().mockReturnValue(null),
            getAllDyes: vi.fn(() => []),
          })),
          dyeDatabase: {},
          LocalizationService: {
            getDyeName: vi.fn(() => null),
            getCategory: vi.fn(() => null),
          },
        }));

        const { parseColorInput: testParseColorInput } = await import('./color-input.js');
        const result = testParseColorInput('#FF0000');
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain('Could not find a matching dye');
        }
      });
    });
  });

  describe('parseColorToHex', () => {
    it('should return hex for valid hex input', () => {
      const hex = parseColorToHex('#FF0000');
      expect(hex).toBe('#FF0000');
    });

    it('should return hex for valid dye name', () => {
      const hex = parseColorToHex('Dalamud Red');
      expect(hex).toMatch(/^#[A-Fa-f0-9]{6}$/);
    });

    it('should return null for invalid input', () => {
      const hex = parseColorToHex('Invalid Dye Name 12345');
      expect(hex).toBeNull();
    });

    it('should return null for invalid hex', () => {
      const hex = parseColorToHex('#ZZZZZZ');
      expect(hex).toBeNull();
    });
  });

  describe('handleDyeAutocomplete', () => {
    let mockInteraction: Partial<AutocompleteInteraction>;
    let respondSpy: Mock<
      [readonly ApplicationCommandOptionChoiceData<string | number>[]],
      Promise<void>
    >;

    beforeEach(() => {
      respondSpy = vi
        .fn<[readonly ApplicationCommandOptionChoiceData<string | number>[]], Promise<void>>()
        .mockResolvedValue(undefined);
      mockInteraction = {
        options: {
          getFocused: vi.fn().mockReturnValue(''),
        } as unknown as AutocompleteInteraction['options'],
        respond: respondSpy,
      } as unknown as Partial<AutocompleteInteraction>;
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should return empty for hex color query', async () => {
      (mockInteraction.options!.getFocused as ReturnType<typeof vi.fn>).mockReturnValue('#FF');

      await handleDyeAutocomplete(mockInteraction as AutocompleteInteraction, 'color');

      expect(respondSpy).toHaveBeenCalledWith([]);
    });

    it('should return matches for valid query', async () => {
      (mockInteraction.options!.getFocused as ReturnType<typeof vi.fn>).mockReturnValue('red');

      await handleDyeAutocomplete(mockInteraction as AutocompleteInteraction, 'color');

      expect(respondSpy).toHaveBeenCalled();
      const results = respondSpy.mock.calls[0][0];
      expect(Array.isArray(results)).toBe(true);
    });

    it('should filter by query string', async () => {
      (mockInteraction.options!.getFocused as ReturnType<typeof vi.fn>).mockReturnValue('dalamud');

      await handleDyeAutocomplete(mockInteraction as AutocompleteInteraction, 'color');

      expect(respondSpy).toHaveBeenCalled();
      const results = respondSpy.mock.calls[0][0];
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r: { name: string }) => r.name.toLowerCase().includes('dalamud'))).toBe(
        true
      );
    });

    it('should respect maxResults option', async () => {
      (mockInteraction.options!.getFocused as ReturnType<typeof vi.fn>).mockReturnValue('');

      await handleDyeAutocomplete(mockInteraction as AutocompleteInteraction, 'color', {
        maxResults: 5,
      });

      expect(respondSpy).toHaveBeenCalled();
      const results = respondSpy.mock.calls[0][0];
      expect(results.length).toBeLessThanOrEqual(5);
    });

    it('should respect minQueryLength option', async () => {
      (mockInteraction.options!.getFocused as ReturnType<typeof vi.fn>).mockReturnValue('a');

      await handleDyeAutocomplete(mockInteraction as AutocompleteInteraction, 'color', {
        minQueryLength: 2,
      });

      expect(respondSpy).toHaveBeenCalledWith([]);
    });

    it('should pass when query meets minQueryLength', async () => {
      (mockInteraction.options!.getFocused as ReturnType<typeof vi.fn>).mockReturnValue('re');

      await handleDyeAutocomplete(mockInteraction as AutocompleteInteraction, 'color', {
        minQueryLength: 2,
      });

      expect(respondSpy).toHaveBeenCalled();
      const results = respondSpy.mock.calls[0][0];
      // Should return results since query length >= minQueryLength
      expect(Array.isArray(results)).toBe(true);
    });

    it('should exclude specified categories', async () => {
      (mockInteraction.options!.getFocused as ReturnType<typeof vi.fn>).mockReturnValue('');

      await handleDyeAutocomplete(mockInteraction as AutocompleteInteraction, 'color', {
        excludeCategories: ['Facewear'],
        maxResults: 100,
      });

      expect(respondSpy).toHaveBeenCalled();
      const results = respondSpy.mock.calls[0][0];
      // No result should contain Facewear in its name
      expect(results.every((r: { name: string }) => !r.name.includes('Facewear'))).toBe(true);
    });

    it('should use English name as value for lookup', async () => {
      (mockInteraction.options!.getFocused as ReturnType<typeof vi.fn>).mockReturnValue('dalamud');

      await handleDyeAutocomplete(mockInteraction as AutocompleteInteraction, 'color');

      expect(respondSpy).toHaveBeenCalled();
      const results = respondSpy.mock.calls[0][0];
      if (results.length > 0) {
        // Value should be the English name
        expect(results[0]).toHaveProperty('value');
        expect(typeof results[0].value).toBe('string');
      }
    });
  });

  describe('getAllDyesForAutocomplete', () => {
    it('should return an array of dyes', () => {
      const dyes = getAllDyesForAutocomplete();
      expect(Array.isArray(dyes)).toBe(true);
      expect(dyes.length).toBeGreaterThan(0);
    });

    it('should respect maxResults', () => {
      const dyes = getAllDyesForAutocomplete({ maxResults: 5 });
      expect(dyes.length).toBeLessThanOrEqual(5);
    });

    it('should have name and value properties', () => {
      const dyes = getAllDyesForAutocomplete({ maxResults: 1 });
      expect(dyes[0]).toHaveProperty('name');
      expect(dyes[0]).toHaveProperty('value');
    });

    it('should exclude specified categories', () => {
      const dyes = getAllDyesForAutocomplete({
        excludeCategories: ['Facewear'],
        maxResults: 100,
      });
      expect(dyes.every((d) => !d.name.includes('Facewear'))).toBe(true);
    });

    it('should use default excludeCategories when not specified', () => {
      const dyes = getAllDyesForAutocomplete({ maxResults: 200 });
      // Facewear is excluded by default
      expect(dyes.every((d) => !d.name.includes('Facewear'))).toBe(true);
    });

    it('should include category in display name', () => {
      const dyes = getAllDyesForAutocomplete({ maxResults: 1 });
      // Name should include category in parentheses
      expect(dyes[0].name).toMatch(/\(.+\)$/);
    });
  });
});
