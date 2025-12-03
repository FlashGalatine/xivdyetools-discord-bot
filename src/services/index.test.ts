/**
 * Tests for services/index.ts
 *
 * Verifies the singleton exports and re-exports work correctly
 */

import { describe, it, expect } from 'vitest';
import { dyeService, emojiService, i18nService, t, logger } from './index.js';

describe('Services Index Module', () => {
  describe('dyeService singleton', () => {
    it('should export dyeService', () => {
      expect(dyeService).toBeDefined();
    });

    it('should have findClosestDye method', () => {
      expect(typeof dyeService.findClosestDye).toBe('function');
    });

    it('should have getAllDyes method', () => {
      expect(typeof dyeService.getAllDyes).toBe('function');
    });

    it('should find closest dye for a hex color', () => {
      const result = dyeService.findClosestDye('#FF0000');
      expect(result).toBeDefined();
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('hex');
    });

    it('should return all dyes', () => {
      const dyes = dyeService.getAllDyes();
      expect(Array.isArray(dyes)).toBe(true);
      expect(dyes.length).toBeGreaterThan(0);
    });

    it('should return the same instance on multiple imports', async () => {
      // Re-import to check singleton behavior
      const { dyeService: dyeService2 } = await import('./index.js');
      expect(dyeService).toBe(dyeService2);
    });
  });

  describe('emojiService re-export', () => {
    it('should export emojiService', () => {
      expect(emojiService).toBeDefined();
    });

    it('should have getDyeEmoji method', () => {
      expect(typeof emojiService.getDyeEmoji).toBe('function');
    });

    it('should have getDyeEmojiString method', () => {
      expect(typeof emojiService.getDyeEmojiString).toBe('function');
    });

    it('should have getDyeEmojiOrSwatch method', () => {
      expect(typeof emojiService.getDyeEmojiOrSwatch).toBe('function');
    });
  });

  describe('i18nService re-export', () => {
    it('should export i18nService', () => {
      expect(i18nService).toBeDefined();
    });

    it('should have t method', () => {
      expect(typeof t).toBe('function');
    });

    it('should translate keys', () => {
      // t function should return a string for any key
      const result = t('common.error');
      expect(typeof result).toBe('string');
    });
  });

  describe('logger re-export', () => {
    it('should export logger', () => {
      expect(logger).toBeDefined();
    });

    it('should have info method', () => {
      expect(typeof logger.info).toBe('function');
    });

    it('should have warn method', () => {
      expect(typeof logger.warn).toBe('function');
    });

    it('should have error method', () => {
      expect(typeof logger.error).toBe('function');
    });

    it('should have debug method', () => {
      expect(typeof logger.debug).toBe('function');
    });
  });
});
