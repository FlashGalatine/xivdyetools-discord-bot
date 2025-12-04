/**
 * Unit tests for emoji-service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Client } from 'discord.js';
import type { Dye } from 'xivdyetools-core';

// Mock logger
vi.mock('../utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock embed-builder
vi.mock('../utils/embed-builder.js', () => ({
  formatColorSwatch: vi.fn((hex: string, size: number) => `[swatch:${hex}:${size}]`),
}));

describe('EmojiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('getInstance', () => {
    it('should return singleton instance', async () => {
      const { emojiService } = await import('./emoji-service.js');
      expect(emojiService).toBeDefined();
    });

    it('should return same instance on multiple calls', async () => {
      const mod1 = await import('./emoji-service.js');
      const mod2 = await import('./emoji-service.js');
      expect(mod1.emojiService).toBe(mod2.emojiService);
    });
  });

  describe('initialize', () => {
    it('should initialize with emojis from client', async () => {
      const { emojiService } = await import('./emoji-service.js');
      const { logger } = await import('../utils/logger.js');

      const mockEmojis = new Map();
      mockEmojis.set('1', { id: '1', name: 'dye_123' });

      const mockClient = {
        application: {
          emojis: {
            fetch: vi.fn().mockResolvedValue(mockEmojis),
          },
        },
      } as unknown as Client;

      await emojiService.initialize(mockClient);

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('initialized'));
    });

    it('should skip if already initialized', async () => {
      vi.resetModules();
      const { emojiService } = await import('./emoji-service.js');

      const mockClient = {
        application: {
          emojis: {
            fetch: vi.fn().mockResolvedValue(new Map()),
          },
        },
      } as unknown as Client;

      await emojiService.initialize(mockClient);
      await emojiService.initialize(mockClient);

      // fetch should only be called once
      expect(mockClient.application?.emojis.fetch).toHaveBeenCalledTimes(1);
    });

    it('should handle missing application', async () => {
      vi.resetModules();
      const { emojiService } = await import('./emoji-service.js');
      const { logger } = await import('../utils/logger.js');

      const mockClient = {
        application: null,
      } as unknown as Client;

      await emojiService.initialize(mockClient);

      // Per Issue #7: Now logs specific warning about client.application being null
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('client.application is null')
      );
    });

    it('should handle fetch errors', async () => {
      vi.resetModules();
      const { emojiService } = await import('./emoji-service.js');
      const { logger } = await import('../utils/logger.js');

      const mockClient = {
        application: {
          emojis: {
            fetch: vi.fn().mockRejectedValue(new Error('Fetch failed')),
          },
        },
      } as unknown as Client;

      await emojiService.initialize(mockClient);

      expect(logger.error).toHaveBeenCalledWith(
        'EmojiService initialization failed:',
        expect.any(Error)
      );
    });
  });

  describe('getDyeEmoji', () => {
    it('should return undefined when not initialized', async () => {
      vi.resetModules();
      const { emojiService } = await import('./emoji-service.js');

      const mockDye = { itemID: 123, hex: '#FF0000' } as Dye;
      const result = emojiService.getDyeEmoji(mockDye);

      expect(result).toBeUndefined();
    });

    it('should return emoji when initialized and emoji exists', async () => {
      vi.resetModules();
      const { emojiService } = await import('./emoji-service.js');

      const mockEmoji = { id: '1', name: 'dye_123', toString: (): string => '<:dye_123:1>' };
      const mockEmojis = new Map();
      mockEmojis.set('1', mockEmoji);
      // Add find method to the Map (mimicking Collection behavior)
      (mockEmojis as any).find = (predicate: (e: unknown) => boolean): unknown => {
        for (const emoji of mockEmojis.values()) {
          if (predicate(emoji)) return emoji;
        }
        return undefined;
      };

      const mockClient = {
        application: {
          emojis: {
            fetch: vi.fn().mockResolvedValue(mockEmojis),
          },
        },
      } as unknown as Client;

      await emojiService.initialize(mockClient);

      const mockDye = { itemID: 123, hex: '#FF0000' } as Dye;
      const result = emojiService.getDyeEmoji(mockDye);

      expect(result).toBeDefined();
      expect(result?.name).toBe('dye_123');
    });
  });

  describe('getDyeEmojiString', () => {
    it('should return null when not initialized', async () => {
      vi.resetModules();
      const { emojiService } = await import('./emoji-service.js');

      const mockDye = { itemID: 123, hex: '#FF0000' } as Dye;
      const result = emojiService.getDyeEmojiString(mockDye);

      expect(result).toBeNull();
    });

    it('should return emoji string when initialized and emoji exists', async () => {
      vi.resetModules();
      const { emojiService } = await import('./emoji-service.js');

      const mockEmoji = { id: '1', name: 'dye_456', toString: (): string => '<:dye_456:1>' };
      const mockEmojis = new Map();
      mockEmojis.set('1', mockEmoji);
      (mockEmojis as any).find = (predicate: (e: unknown) => boolean): unknown => {
        for (const emoji of mockEmojis.values()) {
          if (predicate(emoji)) return emoji;
        }
        return undefined;
      };

      const mockClient = {
        application: {
          emojis: {
            fetch: vi.fn().mockResolvedValue(mockEmojis),
          },
        },
      } as unknown as Client;

      await emojiService.initialize(mockClient);

      const mockDye = { itemID: 456, hex: '#FF0000' } as Dye;
      const result = emojiService.getDyeEmojiString(mockDye);

      expect(result).toBe('<:dye_456:1>');
    });
  });

  describe('getDyeEmojiOrSwatch', () => {
    it('should return swatch when not initialized', async () => {
      vi.resetModules();
      const { emojiService } = await import('./emoji-service.js');

      const mockDye = { itemID: 123, hex: '#FF0000' } as Dye;
      const result = emojiService.getDyeEmojiOrSwatch(mockDye, 4);

      expect(result).toBe('[swatch:#FF0000:4]');
    });

    it('should use default swatch size', async () => {
      vi.resetModules();
      const { emojiService } = await import('./emoji-service.js');

      const mockDye = { itemID: 123, hex: '#00FF00' } as Dye;
      const result = emojiService.getDyeEmojiOrSwatch(mockDye);

      expect(result).toBe('[swatch:#00FF00:4]');
    });

    it('should return emoji when initialized and emoji exists', async () => {
      vi.resetModules();
      const { emojiService } = await import('./emoji-service.js');

      const mockEmoji = { id: '1', name: 'dye_789', toString: (): string => '<:dye_789:1>' };
      const mockEmojis = new Map();
      mockEmojis.set('1', mockEmoji);
      (mockEmojis as any).find = (predicate: (e: unknown) => boolean): unknown => {
        for (const emoji of mockEmojis.values()) {
          if (predicate(emoji)) return emoji;
        }
        return undefined;
      };

      const mockClient = {
        application: {
          emojis: {
            fetch: vi.fn().mockResolvedValue(mockEmojis),
          },
        },
      } as unknown as Client;

      await emojiService.initialize(mockClient);

      const mockDye = { itemID: 789, hex: '#00FF00' } as Dye;
      const result = emojiService.getDyeEmojiOrSwatch(mockDye, 4);

      expect(result).toBe('<:dye_789:1>');
    });
  });
});
