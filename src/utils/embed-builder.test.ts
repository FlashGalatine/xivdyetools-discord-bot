/**
 * Unit tests for embed builder utilities
 */

import { describe, it, expect } from 'vitest';
import {
  COLORS,
  formatColorSwatch,
  formatRGB,
  formatHSV,
  formatPrice,
  createErrorEmbed,
  createSuccessEmbed,
  createInfoEmbed,
  createDyeEmbed,
  createHarmonyEmbed,
  createDyeEmojiAttachment,
} from './embed-builder.js';
import { vi } from 'vitest';
import type { Dye } from 'xivdyetools-core';

// Mock xivdyetools-core LocalizationService to test fallback paths
vi.mock('xivdyetools-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('xivdyetools-core')>();
  return {
    ...actual,
    LocalizationService: {
      ...actual.LocalizationService,
      // Return null to let the code use dye.name as fallback
      getDyeName: vi.fn(() => null),
      getCategory: vi.fn((category: string) => category),
      getAcquisition: vi.fn((acquisition: string) => acquisition),
      getHarmonyType: vi.fn((type: string) => {
        // Return null for unknown harmony types to trigger formatHarmonyType fallback
        if (type === 'unknown_type' || type === 'split_complementary') return null;
        return type.charAt(0).toUpperCase() + type.slice(1);
      }),
    },
  };
});

// Mock emoji service
vi.mock('../services/emoji-service.js', () => ({
  emojiService: {
    getDyeEmoji: vi.fn((dye: Dye) => {
      if (dye.itemID === 5730) {
        return {
          url: 'https://cdn.discordapp.com/emojis/dye_5730.webp',
          imageURL: vi.fn(() => 'https://cdn.discordapp.com/emojis/dye_5730.webp'),
        };
      }
      return undefined;
    }),
    getDyeEmojiOrSwatch: vi.fn((dye: Dye) => {
      if (dye.itemID === 5730) {
        return '<:dye_5730:123456789>';
      }
      return '████ #D42F2F';
    }),
  },
}));

// Mock dye for testing
const mockDye: Dye = {
  id: 5730,
  name: 'Dalamud Red',
  hex: '#D42F2F',
  rgb: { r: 212, g: 47, b: 47 },
  hsv: { h: 0, s: 78, v: 83 },
  category: 'Reds',
  itemID: 5730,
  acquisition: 'Vendor (200 Gil)',
  cost: 200,
};

const mockDyeWithoutEmoji: Dye = {
  id: 99999,
  name: 'Test Dye',
  hex: '#FFFFFF',
  rgb: { r: 255, g: 255, b: 255 },
  hsv: { h: 0, s: 0, v: 100 },
  category: 'Special',
  itemID: 99999,
  acquisition: 'Unknown',
  cost: 0,
};

describe('COLORS constant', () => {
  it('should have all required color constants', () => {
    expect(COLORS).toHaveProperty('PRIMARY');
    expect(COLORS).toHaveProperty('SUCCESS');
    expect(COLORS).toHaveProperty('ERROR');
    expect(COLORS).toHaveProperty('WARNING');
    expect(COLORS).toHaveProperty('INFO');
  });

  it('should have valid hex color values', () => {
    expect(typeof COLORS.PRIMARY).toBe('number');
    expect(typeof COLORS.SUCCESS).toBe('number');
    expect(typeof COLORS.ERROR).toBe('number');
    expect(typeof COLORS.WARNING).toBe('number');
    expect(typeof COLORS.INFO).toBe('number');
  });

  it('should have Discord brand colors', () => {
    expect(COLORS.PRIMARY).toBe(0x5865f2); // Discord blurple
    expect(COLORS.SUCCESS).toBe(0x57f287); // Green
    expect(COLORS.ERROR).toBe(0xed4245); // Red
  });
});

describe('formatColorSwatch', () => {
  it('should format color with default size (4)', () => {
    const result = formatColorSwatch('#FF0000');
    expect(result).toBe('████ #FF0000');
  });

  it('should format color with custom size', () => {
    expect(formatColorSwatch('#FF0000', 2)).toBe('██ #FF0000');
    expect(formatColorSwatch('#FF0000', 6)).toBe('██████ #FF0000');
    expect(formatColorSwatch('#FF0000', 8)).toBe('████████ #FF0000');
  });

  it('should uppercase hex color', () => {
    expect(formatColorSwatch('#ff0000')).toContain('#FF0000');
    expect(formatColorSwatch('#abcdef', 4)).toContain('#ABCDEF');
  });

  it('should handle hex colors without # prefix', () => {
    // Function still works, just doesn't add #
    const result = formatColorSwatch('FF0000');
    expect(result).toContain('FF0000');
  });

  it('should use Unicode block character', () => {
    const result = formatColorSwatch('#FF0000', 3);
    expect(result).toMatch(/^█+\s/);
    expect(result.split(' ')[0]).toBe('███');
  });

  it('should handle size of 0', () => {
    const result = formatColorSwatch('#FF0000', 0);
    expect(result).toBe(' #FF0000');
  });
});

describe('formatRGB', () => {
  it('should format pure red correctly', () => {
    expect(formatRGB('#FF0000')).toBe('RGB(255, 0, 0)');
  });

  it('should format pure green correctly', () => {
    expect(formatRGB('#00FF00')).toBe('RGB(0, 255, 0)');
  });

  it('should format pure blue correctly', () => {
    expect(formatRGB('#0000FF')).toBe('RGB(0, 0, 255)');
  });

  it('should format white correctly', () => {
    expect(formatRGB('#FFFFFF')).toBe('RGB(255, 255, 255)');
  });

  it('should format black correctly', () => {
    expect(formatRGB('#000000')).toBe('RGB(0, 0, 0)');
  });

  it('should handle lowercase hex colors', () => {
    expect(formatRGB('#ff0000')).toBe('RGB(255, 0, 0)');
    expect(formatRGB('#abcdef')).toBe('RGB(171, 205, 239)');
  });

  it('should format arbitrary colors', () => {
    expect(formatRGB('#D42F2F')).toBe('RGB(212, 47, 47)');
    expect(formatRGB('#8A2BE2')).toBe('RGB(138, 43, 226)');
  });
});

describe('formatHSV', () => {
  it('should format pure red correctly', () => {
    const result = formatHSV('#FF0000');
    expect(result).toMatch(/^HSV\(\d+°, \d+%, \d+%\)$/);
    expect(result).toContain('0°'); // Red hue is 0°
    expect(result).toContain('100%'); // Full saturation
  });

  it('should format grayscale correctly', () => {
    const white = formatHSV('#FFFFFF');
    const black = formatHSV('#000000');

    expect(white).toContain('0%'); // Saturation should be 0%
    expect(black).toContain('0%'); // Value should be 0%
  });

  it('should round values', () => {
    const result = formatHSV('#D42F2F');
    // Should not contain decimal points
    expect(result).not.toContain('.');
  });

  it('should have correct format', () => {
    const result = formatHSV('#8A2BE2');
    expect(result).toMatch(/^HSV\(\d+°, \d+%, \d+%\)$/);
  });

  it('should handle different hues', () => {
    const red = formatHSV('#FF0000');
    const green = formatHSV('#00FF00');
    const blue = formatHSV('#0000FF');

    expect(red).toContain('0°'); // Red ≈ 0°
    expect(green).toContain('120°'); // Green ≈ 120°
    expect(blue).toContain('240°'); // Blue ≈ 240°
  });
});

describe('formatPrice', () => {
  it('should format basic prices', () => {
    expect(formatPrice(200)).toBe('200 Gil');
    expect(formatPrice(1000)).toBe('1,000 Gil');
    expect(formatPrice(5000)).toBe('5,000 Gil');
  });

  it('should use locale string formatting', () => {
    expect(formatPrice(1000000)).toContain(',');
    expect(formatPrice(10000)).toBe('10,000 Gil');
  });

  it('should handle zero', () => {
    expect(formatPrice(0)).toBe('0 Gil');
  });

  it('should handle large numbers', () => {
    const result = formatPrice(1234567);
    expect(result).toContain(',');
    expect(result).toContain('Gil');
  });

  it('should always append Gil', () => {
    expect(formatPrice(100)).toContain('Gil');
    expect(formatPrice(0)).toContain('Gil');
  });
});

describe('createErrorEmbed', () => {
  it('should create embed with error color', () => {
    const embed = createErrorEmbed('Test Error', 'Error description');
    expect(embed.data.color).toBe(COLORS.ERROR);
  });

  it('should prefix title with ❌', () => {
    const embed = createErrorEmbed('Test Error', 'Error description');
    expect(embed.data.title).toBe('❌ Test Error');
  });

  it('should include description', () => {
    const embed = createErrorEmbed('Test Error', 'Error description');
    expect(embed.data.description).toBe('Error description');
  });

  it('should have timestamp', () => {
    const embed = createErrorEmbed('Test Error', 'Error description');
    expect(embed.data.timestamp).toBeDefined();
  });

  it('should handle long descriptions', () => {
    const longDesc = 'A'.repeat(1000);
    const embed = createErrorEmbed('Error', longDesc);
    expect(embed.data.description).toBe(longDesc);
  });

  it('should handle special characters in title', () => {
    const embed = createErrorEmbed('Error: Invalid "Input"', 'Desc');
    expect(embed.data.title).toContain('Error: Invalid "Input"');
  });
});

describe('createSuccessEmbed', () => {
  it('should create embed with success color', () => {
    const embed = createSuccessEmbed('Success', 'Success message');
    expect(embed.data.color).toBe(COLORS.SUCCESS);
  });

  it('should prefix title with ✅', () => {
    const embed = createSuccessEmbed('Success', 'Success message');
    expect(embed.data.title).toBe('✅ Success');
  });

  it('should include description', () => {
    const embed = createSuccessEmbed('Success', 'Success message');
    expect(embed.data.description).toBe('Success message');
  });

  it('should have timestamp', () => {
    const embed = createSuccessEmbed('Success', 'Success message');
    expect(embed.data.timestamp).toBeDefined();
  });
});

describe('createInfoEmbed', () => {
  it('should create embed with info color', () => {
    const embed = createInfoEmbed('Info', 'Info message');
    expect(embed.data.color).toBe(COLORS.INFO);
  });

  it('should not prefix title (unlike error/success)', () => {
    const embed = createInfoEmbed('Info Title', 'Info message');
    expect(embed.data.title).toBe('Info Title');
  });

  it('should include description', () => {
    const embed = createInfoEmbed('Info', 'Info message');
    expect(embed.data.description).toBe('Info message');
  });

  it('should have timestamp', () => {
    const embed = createInfoEmbed('Info', 'Info message');
    expect(embed.data.timestamp).toBeDefined();
  });
});

describe('createDyeEmbed', () => {
  it('should create embed with dye color', () => {
    const embed = createDyeEmbed(mockDye);
    const expectedColor = parseInt(mockDye.hex.replace('#', ''), 16);
    expect(embed.data.color).toBe(expectedColor);
  });

  it('should include dye name in title', () => {
    const embed = createDyeEmbed(mockDye);
    expect(embed.data.title).toContain('Dalamud Red');
    expect(embed.data.title).toContain('🎨');
  });

  it('should include emoji in description when available', () => {
    const embed = createDyeEmbed(mockDye);
    expect(embed.data.description).toContain('<:dye_5730:123456789>');
  });

  it('should include color swatch in description when emoji unavailable', () => {
    // Mock service returns swatch for non-5730 items
    const embed = createDyeEmbed(mockDyeWithoutEmoji);
    expect(embed.data.description).toContain('█');
  });

  it('should include color information field', () => {
    const embed = createDyeEmbed(mockDye);
    const fields = embed.data.fields || [];
    const colorField = fields.find((f) => f.name === 'Color Information');

    expect(colorField).toBeDefined();
    expect(colorField?.value).toContain('Hex:');
    expect(colorField?.value).toContain('RGB:');
    expect(colorField?.value).toContain('HSV:');
    expect(colorField?.value).toContain('Category:');
  });

  it('should show acquisition when showExtended is true', () => {
    const embed = createDyeEmbed(mockDye, true);
    const fields = embed.data.fields || [];
    const acquisitionField = fields.find((f) => f.name === 'Acquisition');

    expect(acquisitionField).toBeDefined();
    expect(acquisitionField?.value).toBe(mockDye.acquisition);
  });

  it('should not show acquisition when showExtended is false', () => {
    const embed = createDyeEmbed(mockDye, false);
    const fields = embed.data.fields || [];
    const acquisitionField = fields.find((f) => f.name === 'Acquisition');

    expect(acquisitionField).toBeUndefined();
  });

  it('should set emoji thumbnail when useEmoji is true and emoji exists', () => {
    const embed = createDyeEmbed(mockDye, false, true);
    expect(embed.data.thumbnail?.url).toBe('https://cdn.discordapp.com/emojis/dye_5730.webp');
  });

  it('should not set thumbnail when useEmoji is false', () => {
    const embed = createDyeEmbed(mockDye, false, false);
    expect(embed.data.thumbnail).toBeUndefined();
  });

  it('should not set thumbnail when emoji does not exist', () => {
    const embed = createDyeEmbed(mockDyeWithoutEmoji, false, true);
    expect(embed.data.thumbnail).toBeUndefined();
  });

  it('should have timestamp', () => {
    const embed = createDyeEmbed(mockDye);
    expect(embed.data.timestamp).toBeDefined();
  });
});

describe('createHarmonyEmbed', () => {
  const companions = [
    {
      dye: { ...mockDye, name: 'Companion 1', hex: '#FF6B6B' },
      angle: 120,
      deviation: 3.5,
    },
    {
      dye: { ...mockDye, name: 'Companion 2', hex: '#4ECDC4' },
      angle: 240,
      deviation: 12.8,
    },
  ];

  it('should create embed with base color', () => {
    const embed = createHarmonyEmbed('#FF0000', mockDye, 'triadic', companions);
    const expectedColor = parseInt('FF0000', 16);
    expect(embed.data.color).toBe(expectedColor);
  });

  it('should format harmony type in title', () => {
    const embed = createHarmonyEmbed('#FF0000', mockDye, 'triadic', companions);
    expect(embed.data.title).toContain('Triadic');
    expect(embed.data.title).toContain('Color Harmony');
  });

  it('should format underscore-separated harmony types (lines 145-150)', () => {
    const embed = createHarmonyEmbed('#FF0000', mockDye, 'split_complementary', companions);
    // formatHarmonyType converts split_complementary to Split-Complementary
    expect(embed.data.title).toContain('Split-Complementary');
  });

  it('should handle single-word harmony types', () => {
    const embed = createHarmonyEmbed('#FF0000', mockDye, 'analogous', companions);
    expect(embed.data.title).toContain('Analogous');
  });

  it('should include base color in description', () => {
    const embed = createHarmonyEmbed('#FF0000', mockDye, 'triadic', companions);
    expect(embed.data.description).toContain('Base Color:');
    expect(embed.data.description).toContain('#FF0000');
  });

  it('should include base dye name', () => {
    const embed = createHarmonyEmbed('#FF0000', mockDye, 'triadic', companions);
    expect(embed.data.description).toContain('Dalamud Red');
  });

  it('should add base dye as first field', () => {
    const embed = createHarmonyEmbed('#FF0000', mockDye, 'triadic', companions);
    const fields = embed.data.fields || [];

    expect(fields[0].name).toContain('[Base]');
    expect(fields[0].name).toContain('Dalamud Red');
    expect(fields[0].name).toContain('1️⃣');
  });

  it('should add companion dyes as fields', () => {
    const embed = createHarmonyEmbed('#FF0000', mockDye, 'triadic', companions);
    const fields = embed.data.fields || [];

    // Should have base + 2 companions = 3 fields
    expect(fields.length).toBe(3);
    expect(fields[1].name).toContain('Companion 1');
    expect(fields[2].name).toContain('Companion 2');
  });

  it('should include angle information', () => {
    const embed = createHarmonyEmbed('#FF0000', mockDye, 'triadic', companions);
    const fields = embed.data.fields || [];

    expect(fields[1].value).toContain('120°');
    expect(fields[2].value).toContain('240°');
  });

  it('should categorize deviation as Excellent/Good/Fair', () => {
    const embed = createHarmonyEmbed('#FF0000', mockDye, 'triadic', companions);
    const fields = embed.data.fields || [];

    // Deviation 3.5 < 5 = Excellent
    expect(fields[1].value).toContain('Excellent match');
    // Deviation 12.8 between 5-15 = Good
    expect(fields[2].value).toContain('Good match');
  });

  it('should handle Fair match deviation', () => {
    const fairCompanion = [
      {
        dye: { ...mockDye, name: 'Fair Match' },
        angle: 60,
        deviation: 20, // > 15 = Fair
      },
    ];

    const embed = createHarmonyEmbed('#FF0000', mockDye, 'triadic', fairCompanion);
    const fields = embed.data.fields || [];

    expect(fields[1].value).toContain('Fair match');
  });

  it('should use numbered emojis for companions', () => {
    const embed = createHarmonyEmbed('#FF0000', mockDye, 'triadic', companions);
    const fields = embed.data.fields || [];

    expect(fields[0].name).toContain('1️⃣');
    expect(fields[1].name).toContain('2️⃣');
    expect(fields[2].name).toContain('3️⃣');
  });

  it('should have timestamp', () => {
    const embed = createHarmonyEmbed('#FF0000', mockDye, 'triadic', companions);
    expect(embed.data.timestamp).toBeDefined();
  });

  it('should show Unknown when baseDye has no acquisition (line 184)', () => {
    const dyeWithoutAcquisition = {
      ...mockDye,
      acquisition: undefined,
    };
    const embed = createHarmonyEmbed('#FF0000', dyeWithoutAcquisition, 'triadic', companions);
    const fields = embed.data.fields || [];

    // First field is the base dye
    expect(fields[0].value).toContain('Unknown');
  });

  it('should show Unknown when companion dye has no acquisition (line 201)', () => {
    const companionsWithoutAcquisition = [
      {
        dye: { ...mockDye, name: 'No Acquisition Dye', acquisition: undefined },
        angle: 120,
        deviation: 5,
      },
    ];

    const embed = createHarmonyEmbed('#FF0000', mockDye, 'triadic', companionsWithoutAcquisition);
    const fields = embed.data.fields || [];

    // Second field is the companion dye
    expect(fields[1].value).toContain('Unknown');
  });
});

describe('createDyeEmojiAttachment', () => {
  it('should return AttachmentBuilder for dye with emoji', () => {
    const attachment = createDyeEmojiAttachment(mockDye);
    expect(attachment).not.toBeNull();
    expect(attachment?.name).toBe('dye_5730.webp');
  });

  it('should return null for dye without emoji', () => {
    const attachment = createDyeEmojiAttachment(mockDyeWithoutEmoji);
    expect(attachment).toBeNull();
  });

  it('should create AttachmentBuilder with correct name', () => {
    const attachment = createDyeEmojiAttachment(mockDye);
    expect(attachment?.name).toContain('webp');
    expect(attachment?.name).toContain(String(mockDye.itemID));
  });
});
