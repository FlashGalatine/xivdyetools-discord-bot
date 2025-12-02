/**
 * Unit tests for emoji utility functions
 */

import { describe, it, expect } from 'vitest';
import { getDyeEmojiPath, getDyeEmojiBuffer, getDyeEmojiFilename, hasDyeEmoji } from './emoji.js';
import type { Dye } from 'xivdyetools-core';

// Mock dye objects for testing
const mockDyeWithEmoji: Dye = {
  id: 5730,
  name: 'Dalamud Red',
  hex: '#D42F2F',
  rgb: { r: 212, g: 47, b: 47 },
  hsv: { h: 0, s: 78, v: 83 },
  category: 'Reds',
  itemID: 5730,
  acquisition: 'Vendor',
  cost: 200,
  isMetallic: false,
  isPastel: false,
  isDark: false,
  isCosmic: false,
};

const mockDyeWithoutEmoji: Dye = {
  id: 99999,
  name: 'Nonexistent Dye',
  hex: '#FFFFFF',
  rgb: { r: 255, g: 255, b: 255 },
  hsv: { h: 0, s: 0, v: 100 },
  category: 'Special',
  itemID: 99999, // This itemID should not have an emoji file
  acquisition: 'Unknown',
  cost: 0,
  isMetallic: false,
  isPastel: false,
  isDark: false,
  isCosmic: false,
};

describe('getDyeEmojiFilename', () => {
  it('should generate correct filename format', () => {
    const filename = getDyeEmojiFilename(mockDyeWithEmoji);
    expect(filename).toBe('dye_5730.webp');
  });

  it('should handle different itemIDs', () => {
    const dye1 = { ...mockDyeWithEmoji, itemID: 1234 };
    const dye2 = { ...mockDyeWithEmoji, itemID: 5678 };

    expect(getDyeEmojiFilename(dye1)).toBe('dye_1234.webp');
    expect(getDyeEmojiFilename(dye2)).toBe('dye_5678.webp');
  });

  it('should always return .webp extension', () => {
    const filename = getDyeEmojiFilename(mockDyeWithEmoji);
    expect(filename).toMatch(/\.webp$/);
  });

  it('should use itemID directly without modification', () => {
    const dye = { ...mockDyeWithEmoji, itemID: 12345 };
    const filename = getDyeEmojiFilename(dye);
    expect(filename).toContain('12345');
  });
});

describe('hasDyeEmoji', () => {
  it('should return boolean', () => {
    const result = hasDyeEmoji(mockDyeWithEmoji);
    expect(typeof result).toBe('boolean');
  });

  it('should return true for dyes with emoji files', () => {
    // Dalamud Red (itemID 5730) should have an emoji
    const result = hasDyeEmoji(mockDyeWithEmoji);
    expect(result).toBe(true);
  });

  it('should return false for dyes without emoji files', () => {
    const result = hasDyeEmoji(mockDyeWithoutEmoji);
    expect(result).toBe(false);
  });

  it('should be consistent with getDyeEmojiPath', () => {
    const hasEmoji = hasDyeEmoji(mockDyeWithEmoji);
    const path = getDyeEmojiPath(mockDyeWithEmoji);

    if (hasEmoji) {
      expect(path).not.toBeNull();
    } else {
      expect(path).toBeNull();
    }
  });
});

describe('getDyeEmojiPath', () => {
  it('should return string path for existing emoji', () => {
    const path = getDyeEmojiPath(mockDyeWithEmoji);
    if (path) {
      expect(typeof path).toBe('string');
      expect(path).toContain('emoji');
      expect(path).toContain('5730.webp');
    }
  });

  it('should return null for non-existent emoji', () => {
    const path = getDyeEmojiPath(mockDyeWithoutEmoji);
    expect(path).toBeNull();
  });

  it('should return absolute path when emoji exists', () => {
    const path = getDyeEmojiPath(mockDyeWithEmoji);
    if (path) {
      // Should be absolute path (contains drive letter on Windows or starts with / on Unix)
      expect(path).toMatch(/^([a-zA-Z]:|\/).*emoji.*5730\.webp$/);
    }
  });

  it('should use itemID to locate file', () => {
    const dye = { ...mockDyeWithEmoji, itemID: 5731 };
    const path = getDyeEmojiPath(dye);
    if (path) {
      expect(path).toContain('5731.webp');
    }
  });
});

describe('getDyeEmojiBuffer', () => {
  it('should return Buffer for existing emoji', () => {
    const buffer = getDyeEmojiBuffer(mockDyeWithEmoji);
    if (buffer) {
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);
    }
  });

  it('should return null for non-existent emoji', () => {
    const buffer = getDyeEmojiBuffer(mockDyeWithoutEmoji);
    expect(buffer).toBeNull();
  });

  it('should return valid WebP data', () => {
    const buffer = getDyeEmojiBuffer(mockDyeWithEmoji);
    if (buffer) {
      // WebP files start with "RIFF" header
      const header = buffer.toString('ascii', 0, 4);
      expect(header).toBe('RIFF');

      // WebP signature at offset 8-11
      const webpSignature = buffer.toString('ascii', 8, 12);
      expect(webpSignature).toBe('WEBP');
    }
  });

  it('should be consistent with hasDyeEmoji', () => {
    const hasEmoji = hasDyeEmoji(mockDyeWithEmoji);
    const buffer = getDyeEmojiBuffer(mockDyeWithEmoji);

    if (hasEmoji) {
      expect(buffer).not.toBeNull();
    } else {
      expect(buffer).toBeNull();
    }
  });

  it('should handle multiple calls correctly', () => {
    const buffer1 = getDyeEmojiBuffer(mockDyeWithEmoji);
    const buffer2 = getDyeEmojiBuffer(mockDyeWithEmoji);

    if (buffer1 && buffer2) {
      expect(buffer1.length).toBe(buffer2.length);
      expect(buffer1.equals(buffer2)).toBe(true);
    }
  });
});

describe('emoji integration', () => {
  it('should have consistent behavior across all functions', () => {
    const hasEmoji = hasDyeEmoji(mockDyeWithEmoji);
    const path = getDyeEmojiPath(mockDyeWithEmoji);
    const buffer = getDyeEmojiBuffer(mockDyeWithEmoji);
    const filename = getDyeEmojiFilename(mockDyeWithEmoji);

    if (hasEmoji) {
      expect(path).not.toBeNull();
      expect(buffer).not.toBeNull();
      expect(filename).toContain('5730');
    }
  });

  it('should handle dyes without emoji gracefully', () => {
    expect(() => hasDyeEmoji(mockDyeWithoutEmoji)).not.toThrow();
    expect(() => getDyeEmojiPath(mockDyeWithoutEmoji)).not.toThrow();
    expect(() => getDyeEmojiBuffer(mockDyeWithoutEmoji)).not.toThrow();
    expect(() => getDyeEmojiFilename(mockDyeWithoutEmoji)).not.toThrow();
  });
});
