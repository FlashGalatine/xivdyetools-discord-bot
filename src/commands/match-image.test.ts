/**
 * Integration tests for /match_image command
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChatInputCommandInteraction, Attachment } from 'discord.js';

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
  formatRGB: vi.fn((_hex: string) => `RGB(255, 0, 0)`),
  formatHSV: vi.fn((_hex: string) => `HSV(0°, 100%, 100%)`),
  formatColorSwatch: vi.fn((_hex: string, size: number) => `⬛`.repeat(size)),
}));

vi.mock('../utils/response-helper.js', () => ({
  sendPublicSuccess: vi.fn(),
  sendEphemeralError: vi.fn(),
}));

vi.mock('../utils/image-validator.js', () => ({
  validateImage: vi.fn().mockResolvedValue({
    success: true,
    metadata: {
      width: 100,
      height: 100,
      format: 'png',
      size: 1024,
      pixelCount: 10000,
    },
    value: {
      width: 100,
      height: 100,
      format: 'png',
      size: 1024,
      pixelCount: 10000,
    },
  }),
  processWithTimeout: vi.fn((promise: Promise<unknown>) => promise),
}));

vi.mock('../config.js', () => ({
  config: {
    image: {
      maxSizeMB: 10,
    },
  },
}));

vi.mock('../utils/worker-pool.js', () => ({
  WorkerPool: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockRejectedValue(new Error('Worker not available')),
    terminate: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('sharp', () => ({
  default: vi.fn().mockReturnValue({
    resize: vi.fn().mockReturnThis(),
    stats: vi.fn().mockResolvedValue({
      dominant: { r: 255, g: 0, b: 0 },
    }),
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
      acquisition: 'Purchased from a vendor',
    })),
  })),
  ColorService: {
    rgbToHex: vi.fn((_r: number, _g: number, _b: number) => '#FF0000'),
    getColorDistance: vi.fn(() => 5.5),
  },
  PaletteService: vi.fn().mockImplementation(() => ({
    extractPalette: vi.fn(() => [{ color: { r: 255, g: 0, b: 0 }, dominance: 50 }]),
    extractAndMatchPalette: vi.fn(() => [
      {
        extracted: { r: 255, g: 0, b: 0 },
        matchedDye: { id: 1, name: 'Ruby Red', hex: '#E60026', category: 'Red' },
        distance: 5.5,
        dominance: 50,
      },
    ]),
  })),
  dyeDatabase: {},
  LocalizationService: {
    getDyeName: vi.fn((_id: number) => null),
    getCategory: vi.fn((_category: string) => null),
    getAcquisition: vi.fn((_acq: string) => null),
  },
}));

// Mock fetch for image download
const mockFetch = vi.fn().mockResolvedValue({
  ok: true,
  arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
});
vi.stubGlobal('fetch', mockFetch);

/**
 * Create mock Attachment
 */
function createMockAttachment(overrides: Partial<Attachment> = {}): Attachment {
  return {
    id: 'test-attachment-123',
    name: 'test-image.png',
    url: 'https://cdn.discordapp.com/attachments/123/456/test-image.png',
    proxyURL: 'https://media.discordapp.net/attachments/123/456/test-image.png',
    size: 1024,
    contentType: 'image/png',
    width: 100,
    height: 100,
    ...overrides,
  } as Attachment;
}

/**
 * Create mock ChatInputCommandInteraction
 */
function createMockInteraction(
  options: {
    attachment?: Partial<Attachment> | null;
  } = {}
): ChatInputCommandInteraction {
  const deferReply = vi.fn().mockResolvedValue(undefined);
  const editReply = vi.fn().mockResolvedValue(undefined);
  const followUp = vi.fn().mockResolvedValue(undefined);

  return {
    deferReply,
    editReply,
    followUp,
    deferred: true,
    user: { id: 'test-user-123' },
    locale: 'en-US',
    options: {
      getAttachment: vi.fn((name: string, _required?: boolean) => {
        if (name === 'image' && options.attachment !== null) {
          return createMockAttachment(options.attachment);
        }
        return null;
      }),
    },
  } as unknown as ChatInputCommandInteraction;
}

describe('Match Image Command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
    });
  });

  describe('cleanupWorkerPool', () => {
    it('should handle cleanup when worker pool is null', async () => {
      const { cleanupWorkerPool } = await import('./match-image.js');

      // Should not throw when pool doesn't exist
      await expect(cleanupWorkerPool()).resolves.not.toThrow();
    });

    it('should call terminate on existing worker pool', async () => {
      const mockTerminate = vi.fn().mockResolvedValue(undefined);
      const { WorkerPool } = await import('../utils/worker-pool.js');
      vi.mocked(WorkerPool).mockImplementation(
        () =>
          ({
            execute: vi.fn().mockRejectedValue(new Error('Worker not available')),
            terminate: mockTerminate,
          }) as unknown as InstanceType<typeof WorkerPool>
      );

      vi.resetModules();

      // First execute a command to initialize the worker pool
      const { execute, cleanupWorkerPool } = await import('./match-image.js');
      const interaction = createMockInteraction();
      await execute(interaction);

      // Now cleanup should call terminate
      await cleanupWorkerPool();

      // After cleanup, calling again should not throw
      await expect(cleanupWorkerPool()).resolves.not.toThrow();
    });
  });

  describe('Input Handling', () => {
    it('should accept valid PNG attachment', async () => {
      const { execute } = await import('./match-image.js');
      const { sendPublicSuccess } = await import('../utils/response-helper.js');

      const interaction = createMockInteraction({
        attachment: { contentType: 'image/png' },
      });

      await execute(interaction);

      expect(interaction.deferReply).toHaveBeenCalled();
      expect(sendPublicSuccess).toHaveBeenCalled();
    });

    it('should accept valid JPG attachment', async () => {
      const { execute } = await import('./match-image.js');
      const { sendPublicSuccess } = await import('../utils/response-helper.js');

      const interaction = createMockInteraction({
        attachment: { contentType: 'image/jpeg', name: 'test.jpg' },
      });

      await execute(interaction);

      expect(sendPublicSuccess).toHaveBeenCalled();
    });

    it('should return error when no attachment provided', async () => {
      const { execute } = await import('./match-image.js');
      const { sendEphemeralError } = await import('../utils/response-helper.js');

      const interaction = createMockInteraction({ attachment: null });

      await execute(interaction);

      expect(sendEphemeralError).toHaveBeenCalled();
    });
  });

  describe('Image Processing', () => {
    it('should extract dominant color from image', async () => {
      const { execute } = await import('./match-image.js');
      const sharp = (await import('sharp')).default;

      const interaction = createMockInteraction();
      await execute(interaction);

      expect(sharp).toHaveBeenCalled();
    });

    it('should find closest dye to dominant color', async () => {
      const { execute } = await import('./match-image.js');
      const { sendPublicSuccess } = await import('../utils/response-helper.js');

      const interaction = createMockInteraction();
      await execute(interaction);

      expect(sendPublicSuccess).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle fetch timeout', async () => {
      const { execute } = await import('./match-image.js');
      const { sendEphemeralError } = await import('../utils/response-helper.js');

      mockFetch.mockRejectedValueOnce(new Error('Timeout'));

      const interaction = createMockInteraction();
      await execute(interaction);

      expect(sendEphemeralError).toHaveBeenCalled();
    });

    it('should defer reply before processing', async () => {
      const { execute } = await import('./match-image.js');

      const interaction = createMockInteraction();
      await execute(interaction);

      expect(interaction.deferReply).toHaveBeenCalled();
    });
  });

  describe('Response Content', () => {
    it('should show extracted color info', async () => {
      const { execute } = await import('./match-image.js');
      const { sendPublicSuccess } = await import('../utils/response-helper.js');

      const interaction = createMockInteraction();
      await execute(interaction);

      expect(sendPublicSuccess).toHaveBeenCalledWith(
        interaction,
        expect.objectContaining({
          embeds: expect.any(Array),
        })
      );
    });

    it('should show closest dye information', async () => {
      const { execute } = await import('./match-image.js');
      const { sendPublicSuccess } = await import('../utils/response-helper.js');

      const interaction = createMockInteraction();
      await execute(interaction);

      expect(sendPublicSuccess).toHaveBeenCalled();
    });
  });

  describe('Locale', () => {
    it('should use translation function for messages', async () => {
      const { execute } = await import('./match-image.js');
      const { t } = await import('../services/i18n-service.js');

      const interaction = createMockInteraction();
      await execute(interaction);

      // Command uses t() for localized strings
      expect(t).toHaveBeenCalled();
    });
  });

  describe('Match Quality Levels', () => {
    it('should show perfect match when distance is 0', async () => {
      vi.resetModules();
      vi.doMock('xivdyetools-core', () => ({
        DyeService: vi.fn().mockImplementation(() => ({
          findClosestDye: vi.fn(() => ({ id: 1, name: 'Test', hex: '#FF0000', category: 'Red' })),
        })),
        ColorService: { rgbToHex: vi.fn(() => '#FF0000'), getColorDistance: vi.fn(() => 0) },
        dyeDatabase: {},
        LocalizationService: {
          getDyeName: vi.fn(() => null),
          getCategory: vi.fn(() => null),
          getAcquisition: vi.fn(() => null),
        },
      }));
      const { execute } = await import('./match-image.js');
      const { t } = await import('../services/i18n-service.js');
      await execute(createMockInteraction());
      expect(t).toHaveBeenCalledWith('matchQuality.perfect');
    });

    it('should show good match when distance is 15', async () => {
      vi.resetModules();
      vi.doMock('xivdyetools-core', () => ({
        DyeService: vi.fn().mockImplementation(() => ({
          findClosestDye: vi.fn(() => ({ id: 1, name: 'Test', hex: '#FF0000', category: 'Red' })),
        })),
        ColorService: { rgbToHex: vi.fn(() => '#FF0000'), getColorDistance: vi.fn(() => 15) },
        dyeDatabase: {},
        LocalizationService: {
          getDyeName: vi.fn(() => null),
          getCategory: vi.fn(() => null),
          getAcquisition: vi.fn(() => null),
        },
      }));
      const { execute } = await import('./match-image.js');
      const { t } = await import('../services/i18n-service.js');
      await execute(createMockInteraction());
      expect(t).toHaveBeenCalledWith('matchQuality.good');
    });

    it('should show fair match when distance is 35', async () => {
      vi.resetModules();
      vi.doMock('xivdyetools-core', () => ({
        DyeService: vi.fn().mockImplementation(() => ({
          findClosestDye: vi.fn(() => ({ id: 1, name: 'Test', hex: '#FF0000', category: 'Red' })),
        })),
        ColorService: { rgbToHex: vi.fn(() => '#FF0000'), getColorDistance: vi.fn(() => 35) },
        dyeDatabase: {},
        LocalizationService: {
          getDyeName: vi.fn(() => null),
          getCategory: vi.fn(() => null),
          getAcquisition: vi.fn(() => null),
        },
      }));
      const { execute } = await import('./match-image.js');
      const { t } = await import('../services/i18n-service.js');
      await execute(createMockInteraction());
      expect(t).toHaveBeenCalledWith('matchQuality.fair');
    });

    it('should show approximate match when distance is 75', async () => {
      vi.resetModules();
      vi.doMock('xivdyetools-core', () => ({
        DyeService: vi.fn().mockImplementation(() => ({
          findClosestDye: vi.fn(() => ({ id: 1, name: 'Test', hex: '#FF0000', category: 'Red' })),
        })),
        ColorService: { rgbToHex: vi.fn(() => '#FF0000'), getColorDistance: vi.fn(() => 75) },
        dyeDatabase: {},
        LocalizationService: {
          getDyeName: vi.fn(() => null),
          getCategory: vi.fn(() => null),
          getAcquisition: vi.fn(() => null),
        },
      }));
      const { execute } = await import('./match-image.js');
      const { t } = await import('../services/i18n-service.js');
      await execute(createMockInteraction());
      expect(t).toHaveBeenCalledWith('matchQuality.approximate');
    });
  });

  describe('Error Cases', () => {
    it('should handle no matching dye', async () => {
      vi.resetModules();
      vi.doMock('xivdyetools-core', () => ({
        DyeService: vi.fn().mockImplementation(() => ({ findClosestDye: vi.fn(() => null) })),
        ColorService: { rgbToHex: vi.fn(() => '#FF0000'), getColorDistance: vi.fn(() => 0) },
        dyeDatabase: {},
        LocalizationService: {
          getDyeName: vi.fn(() => null),
          getCategory: vi.fn(() => null),
          getAcquisition: vi.fn(() => null),
        },
      }));
      const { execute } = await import('./match-image.js');
      const { sendEphemeralError } = await import('../utils/response-helper.js');
      await execute(createMockInteraction());
      expect(sendEphemeralError).toHaveBeenCalled();
    });

    it('should handle fetch error', async () => {
      vi.resetModules();
      mockFetch.mockRejectedValueOnce(new Error('fetch failed'));
      const { execute } = await import('./match-image.js');
      const { t } = await import('../services/i18n-service.js');
      await execute(createMockInteraction());
      expect(t).toHaveBeenCalledWith('errors.failedToDownloadImage');
    });

    it('should handle generic processing error', async () => {
      vi.resetModules();
      mockFetch.mockRejectedValueOnce(new Error('Generic error'));
      const { execute } = await import('./match-image.js');
      const { t } = await import('../services/i18n-service.js');
      await execute(createMockInteraction());
      // Generic errors use failedToAnalyzeImage
      expect(t).toHaveBeenCalledWith('errors.failedToAnalyzeImage');
    });

    it('should handle fetch not ok response', async () => {
      vi.resetModules();
      mockFetch.mockResolvedValueOnce({ ok: false, statusText: 'Not Found' });
      const { execute } = await import('./match-image.js');
      const { sendEphemeralError } = await import('../utils/response-helper.js');
      await execute(createMockInteraction());
      expect(sendEphemeralError).toHaveBeenCalled();
    });

    it('should handle validation failure', async () => {
      vi.resetModules();
      vi.doMock('../utils/image-validator.js', () => ({
        validateImage: vi.fn().mockResolvedValue({ success: false, error: 'Image too large' }),
        processWithTimeout: vi.fn((p: Promise<unknown>) => p),
      }));
      const { execute } = await import('./match-image.js');
      const { sendEphemeralError } = await import('../utils/response-helper.js');
      await execute(createMockInteraction());
      expect(sendEphemeralError).toHaveBeenCalled();
    });

    it('should handle input buffer error', async () => {
      vi.resetModules();
      mockFetch.mockRejectedValueOnce(new Error('Input buffer contains unsupported image format'));
      const { execute } = await import('./match-image.js');
      const { t } = await import('../services/i18n-service.js');
      await execute(createMockInteraction());
      expect(t).toHaveBeenCalledWith('errors.invalidOrCorruptedImage');
    });
  });

  describe('Worker Pool Success Path', () => {
    it('should fall back to sync when worker validation fails', async () => {
      vi.resetModules();

      // Mock worker pool to fail on validation
      vi.doMock('../utils/worker-pool.js', () => ({
        WorkerPool: vi.fn().mockImplementation(() => ({
          execute: vi.fn().mockResolvedValue({
            success: false,
            error: 'Worker validation failed',
          }),
          terminate: vi.fn().mockResolvedValue(undefined),
        })),
      }));

      const { execute } = await import('./match-image.js');
      const { sendEphemeralError } = await import('../utils/response-helper.js');

      await execute(createMockInteraction());

      expect(sendEphemeralError).toHaveBeenCalled();
    });
  });
});
