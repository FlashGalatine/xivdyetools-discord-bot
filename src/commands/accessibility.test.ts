/**
 * Integration tests for /accessibility command
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';

// Mock dependencies
vi.mock('../utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../services/i18n-service.js', () => ({
  i18nService: {
    setLocaleFromInteraction: vi.fn().mockResolvedValue('en'),
  },
  t: vi.fn((key: string) => key),
}));

vi.mock('../services/emoji-service.js', () => ({
  emojiService: {
    getDyeEmoji: vi.fn(() => null),
    getDyeEmojiOrSwatch: vi.fn((dye: { hex: string }) => `[${dye.hex}]`),
  },
}));

vi.mock('../utils/embed-builder.js', () => ({
  createErrorEmbed: vi.fn((title: string, description: string) => ({
    data: { title: `❌ ${title}`, description },
  })),
  createDyeEmojiAttachment: vi.fn(() => null),
  formatColorSwatch: vi.fn((hex: string, size: number) => `⬛`.repeat(size)),
}));

vi.mock('../utils/response-helper.js', () => ({
  sendPublicSuccess: vi.fn(),
  sendEphemeralError: vi.fn(),
}));

vi.mock('../renderers/accessibility-comparison.js', () => ({
  renderAccessibilityComparison: vi.fn().mockResolvedValue(Buffer.from([0x89, 0x50, 0x4e, 0x47])),
}));

vi.mock('../renderers/accessibility-matrix.js', () => ({
  renderContrastMatrix: vi.fn().mockReturnValue(Buffer.from([0x89, 0x50, 0x4e, 0x47])),
  calculateContrast: vi.fn().mockReturnValue({
    ratio: 4.5,
    level: 'AA' as const,
  }),
}));

// Mock validators
vi.mock('../utils/validators.js', () => ({
  validateHexColor: vi.fn((hex: string) => {
    if (hex.startsWith('#') && /^#[0-9A-Fa-f]{6}$/.test(hex)) {
      return { success: true, value: hex.toUpperCase() };
    }
    // Check for invalid hex
    if (hex.includes('G') || hex.includes('g')) {
      return { success: false, error: 'Invalid hex format' };
    }
    return { success: false, error: 'Invalid hex format' };
  }),
  findDyeByName: vi.fn((name: string) => {
    // Simulate known dyes
    const knownDyes: Record<string, { id: number; name: string; hex: string; category: string }> = {
      'dalamud red': { id: 1, name: 'Dalamud Red', hex: '#FF0000', category: 'Red' },
      'ruby red': { id: 2, name: 'Ruby Red', hex: '#E60026', category: 'Red' },
    };
    const lowerName = name.toLowerCase();
    if (knownDyes[lowerName]) {
      return { dye: knownDyes[lowerName] };
    }
    return { error: 'Dye not found' };
  }),
}));

// Mock xivdyetools-core
vi.mock('xivdyetools-core', () => ({
  DyeService: vi.fn().mockImplementation(() => ({
    findClosestDye: vi.fn((_hex: string) => ({
      id: 1,
      name: 'Ruby Red',
      hex: '#E60026',
      category: 'Red',
    })),
    getAllDyes: vi.fn(() => [
      { id: 1, name: 'Ruby Red', hex: '#E60026', category: 'Red' },
      { id: 2, name: 'Dalamud Red', hex: '#FF0000', category: 'Red' },
    ]),
  })),
  ColorService: {
    hexToRgb: vi.fn((_hex: string) => ({ r: 255, g: 0, b: 0 })),
    rgbToHex: vi.fn((_r: number, _g: number, _b: number) => '#FF0000'),
    simulateColorblindness: vi.fn((_rgb: { r: number; g: number; b: number }, _type: string) => ({
      r: 200,
      g: 100,
      b: 50,
    })),
    getContrastRatio: vi.fn((_hex1: string, _hex2: string) => 4.5),
  },
  dyeDatabase: {
    getAllDyes: vi.fn(() => []),
  },
  LocalizationService: {
    getDyeName: vi.fn((_id: number) => null),
    getCategory: vi.fn((_category: string) => null),
  },
}));

/**
 * Create mock ChatInputCommandInteraction
 * Updated for CommandBase compatibility (needs user.id, guildId, deferred/replied state)
 */
function createMockInteraction(options: {
  stringOptions?: Record<string, string | null>;
}): ChatInputCommandInteraction {
  const mockInteraction = {
    editReply: vi.fn().mockResolvedValue(undefined),
    followUp: vi.fn().mockResolvedValue(undefined),
    deferred: false,
    replied: false,
    user: { id: 'test-user-123' },
    guildId: 'test-guild-123',
    options: {
      getString: vi.fn((name: string, _required?: boolean) => {
        return options.stringOptions?.[name] ?? null;
      }),
    },
  };

  // deferReply mock must update deferred state for sendEphemeralError to work correctly
  (mockInteraction as any).deferReply = vi.fn().mockImplementation(() => {
    (mockInteraction as any).deferred = true;
    return Promise.resolve();
  });

  return mockInteraction as unknown as ChatInputCommandInteraction;
}

/**
 * Create mock AutocompleteInteraction
 */
function createMockAutocompleteInteraction(focusedOption: {
  name: string;
  value: string;
}): AutocompleteInteraction {
  const respond = vi.fn().mockResolvedValue(undefined);

  return {
    respond,
    options: {
      getFocused: vi.fn((returnFullOption?: boolean) => {
        if (returnFullOption) {
          return focusedOption;
        }
        return focusedOption.value;
      }),
    },
  } as unknown as AutocompleteInteraction;
}

describe('Accessibility Command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Input Validation', () => {
    it('should accept valid hex color input', async () => {
      const { execute } = await import('./accessibility.js');
      const { sendPublicSuccess } = await import('../utils/response-helper.js');

      const interaction = createMockInteraction({
        stringOptions: { dye: '#FF0000' },
      });

      await execute(interaction);

      expect(interaction.deferReply).toHaveBeenCalled();
      expect(sendPublicSuccess).toHaveBeenCalled();
    });

    it('should accept valid dye name input', async () => {
      const { execute } = await import('./accessibility.js');
      const { sendPublicSuccess } = await import('../utils/response-helper.js');

      const interaction = createMockInteraction({
        stringOptions: { dye: 'Dalamud Red' },
      });

      await execute(interaction);

      expect(sendPublicSuccess).toHaveBeenCalled();
    });

    it('should reject invalid hex color', async () => {
      const { execute } = await import('./accessibility.js');
      const { sendEphemeralError } = await import('../utils/response-helper.js');

      const interaction = createMockInteraction({
        stringOptions: { dye: '#GGGGGG' },
      });

      await execute(interaction);

      expect(sendEphemeralError).toHaveBeenCalled();
    });

    it('should reject invalid dye name', async () => {
      const { execute } = await import('./accessibility.js');
      const { sendEphemeralError } = await import('../utils/response-helper.js');

      const interaction = createMockInteraction({
        stringOptions: { dye: 'NonexistentDye12345' },
      });

      await execute(interaction);

      expect(sendEphemeralError).toHaveBeenCalled();
    });
  });

  describe('Vision Type Filtering', () => {
    it('should show all vision types by default', async () => {
      const { execute } = await import('./accessibility.js');
      const { renderAccessibilityComparison } = await import(
        '../renderers/accessibility-comparison.js'
      );

      const interaction = createMockInteraction({
        stringOptions: { dye: '#FF0000' },
      });

      await execute(interaction);

      expect(renderAccessibilityComparison).toHaveBeenCalled();
    });

    it('should show only protanopia when specified', async () => {
      const { execute } = await import('./accessibility.js');
      const { sendPublicSuccess } = await import('../utils/response-helper.js');

      const interaction = createMockInteraction({
        stringOptions: { dye: '#FF0000', vision_type: 'protanopia' },
      });

      await execute(interaction);

      expect(sendPublicSuccess).toHaveBeenCalled();
    });

    it('should show only deuteranopia when specified', async () => {
      const { execute } = await import('./accessibility.js');
      const { sendPublicSuccess } = await import('../utils/response-helper.js');

      const interaction = createMockInteraction({
        stringOptions: { dye: '#00FF00', vision_type: 'deuteranopia' },
      });

      await execute(interaction);

      expect(sendPublicSuccess).toHaveBeenCalled();
    });

    it('should show only tritanopia when specified', async () => {
      const { execute } = await import('./accessibility.js');
      const { sendPublicSuccess } = await import('../utils/response-helper.js');

      const interaction = createMockInteraction({
        stringOptions: { dye: '#0000FF', vision_type: 'tritanopia' },
      });

      await execute(interaction);

      expect(sendPublicSuccess).toHaveBeenCalled();
    });
  });

  describe('Response Content', () => {
    it('should include rendered image attachment', async () => {
      const { execute } = await import('./accessibility.js');
      const { sendPublicSuccess } = await import('../utils/response-helper.js');

      const interaction = createMockInteraction({
        stringOptions: { dye: '#FF0000' },
      });

      await execute(interaction);

      expect(sendPublicSuccess).toHaveBeenCalledWith(
        interaction,
        expect.objectContaining({
          files: expect.any(Array),
        })
      );
    });
  });

  describe('Autocomplete', () => {
    it('should return matching dyes', async () => {
      const { autocomplete } = await import('./accessibility.js');

      const interaction = createMockAutocompleteInteraction({
        name: 'dye',
        value: 'red',
      });

      await autocomplete(interaction);

      expect(interaction.respond).toHaveBeenCalled();
    });

    it('should limit to 25 results', async () => {
      const { autocomplete } = await import('./accessibility.js');

      const interaction = createMockAutocompleteInteraction({
        name: 'dye',
        value: 'a',
      });

      await autocomplete(interaction);

      const responseArg = vi.mocked(interaction.respond).mock.calls[0][0] as Array<unknown>;
      expect(responseArg.length).toBeLessThanOrEqual(25);
    });

    it('should return empty array for hex color query', async () => {
      const { autocomplete } = await import('./accessibility.js');

      const interaction = createMockAutocompleteInteraction({
        name: 'dye',
        value: '#FF0000',
      });

      await autocomplete(interaction);

      expect(interaction.respond).toHaveBeenCalledWith([]);
    });

    it('should work for dye2 parameter', async () => {
      const { autocomplete } = await import('./accessibility.js');

      const interaction = createMockAutocompleteInteraction({
        name: 'dye2',
        value: 'red',
      });

      await autocomplete(interaction);

      expect(interaction.respond).toHaveBeenCalled();
    });

    it('should work for dye3 parameter', async () => {
      const { autocomplete } = await import('./accessibility.js');

      const interaction = createMockAutocompleteInteraction({
        name: 'dye3',
        value: 'red',
      });

      await autocomplete(interaction);

      expect(interaction.respond).toHaveBeenCalled();
    });

    it('should work for dye4 parameter', async () => {
      const { autocomplete } = await import('./accessibility.js');

      const interaction = createMockAutocompleteInteraction({
        name: 'dye4',
        value: 'red',
      });

      await autocomplete(interaction);

      expect(interaction.respond).toHaveBeenCalled();
    });
  });

  describe('Multi-Dye Contrast Matrix', () => {
    it('should handle 2 dyes for contrast comparison', async () => {
      const { execute } = await import('./accessibility.js');
      const { sendPublicSuccess } = await import('../utils/response-helper.js');

      const interaction = createMockInteraction({
        stringOptions: { dye: 'Dalamud Red', dye2: 'Ruby Red' },
      });

      await execute(interaction);

      expect(sendPublicSuccess).toHaveBeenCalled();
    });

    it('should handle 3 dyes for contrast comparison', async () => {
      const { execute } = await import('./accessibility.js');
      const { sendPublicSuccess } = await import('../utils/response-helper.js');

      const interaction = createMockInteraction({
        stringOptions: { dye: '#FF0000', dye2: '#00FF00', dye3: '#0000FF' },
      });

      await execute(interaction);

      expect(sendPublicSuccess).toHaveBeenCalled();
    });

    it('should handle 4 dyes for contrast comparison', async () => {
      const { execute } = await import('./accessibility.js');
      const { sendPublicSuccess } = await import('../utils/response-helper.js');

      const interaction = createMockInteraction({
        stringOptions: { dye: '#FF0000', dye2: '#00FF00', dye3: '#0000FF', dye4: '#FFFF00' },
      });

      await execute(interaction);

      expect(sendPublicSuccess).toHaveBeenCalled();
    });

    it('should use renderContrastMatrix for multi-dye comparison', async () => {
      const { execute } = await import('./accessibility.js');
      const { renderContrastMatrix } = await import('../renderers/accessibility-matrix.js');

      const interaction = createMockInteraction({
        stringOptions: { dye: '#FF0000', dye2: '#0000FF' },
      });

      await execute(interaction);

      expect(renderContrastMatrix).toHaveBeenCalled();
    });
  });

  describe('WCAG Badge Levels', () => {
    it('should show AAA badge for high contrast', async () => {
      vi.resetModules();
      vi.doMock('../renderers/accessibility-matrix.js', () => ({
        renderContrastMatrix: vi.fn().mockReturnValue(Buffer.from([0x89, 0x50, 0x4e, 0x47])),
        calculateContrast: vi.fn().mockReturnValue({
          ratio: 7.5,
          level: 'AAA' as const,
        }),
      }));

      const { execute } = await import('./accessibility.js');
      const { sendPublicSuccess } = await import('../utils/response-helper.js');

      const interaction = createMockInteraction({
        stringOptions: { dye: '#000000', dye2: '#FFFFFF' },
      });

      await execute(interaction);

      expect(sendPublicSuccess).toHaveBeenCalled();
    });

    it('should show Fail badge for low contrast', async () => {
      vi.resetModules();
      vi.doMock('../renderers/accessibility-matrix.js', () => ({
        renderContrastMatrix: vi.fn().mockReturnValue(Buffer.from([0x89, 0x50, 0x4e, 0x47])),
        calculateContrast: vi.fn().mockReturnValue({
          ratio: 1.5,
          level: 'Fail' as const,
        }),
      }));

      const { execute } = await import('./accessibility.js');
      const { sendPublicSuccess } = await import('../utils/response-helper.js');

      const interaction = createMockInteraction({
        stringOptions: { dye: '#777777', dye2: '#888888' },
      });

      await execute(interaction);

      expect(sendPublicSuccess).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should defer reply before processing', async () => {
      const { execute } = await import('./accessibility.js');

      const interaction = createMockInteraction({
        stringOptions: { dye: '#FF0000' },
      });

      await execute(interaction);

      expect(interaction.deferReply).toHaveBeenCalled();
    });

    it('should handle invalid second dye in multi-dye mode', async () => {
      const { execute } = await import('./accessibility.js');
      const { sendEphemeralError } = await import('../utils/response-helper.js');

      const interaction = createMockInteraction({
        stringOptions: { dye: '#FF0000', dye2: 'InvalidDye12345' },
      });

      await execute(interaction);

      expect(sendEphemeralError).toHaveBeenCalled();
    });

    it('should handle invalid hex in dye2', async () => {
      const { execute } = await import('./accessibility.js');
      const { sendEphemeralError } = await import('../utils/response-helper.js');

      const interaction = createMockInteraction({
        stringOptions: { dye: '#FF0000', dye2: '#GGGGGG' },
      });

      await execute(interaction);

      expect(sendEphemeralError).toHaveBeenCalled();
    });
  });
});
