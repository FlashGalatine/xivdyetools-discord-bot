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
  formatRGB: vi.fn((hex: string) => `RGB(255, 0, 0)`),
  formatHSV: vi.fn((hex: string) => `HSV(0°, 100%, 100%)`),
  formatColorSwatch: vi.fn((hex: string, size: number) => `⬛`.repeat(size)),
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
    findClosestDye: vi.fn((hex: string) => ({
      id: 1,
      name: 'Ruby Red',
      hex: '#E60026',
      category: 'Red',
      acquisition: 'Purchased from a vendor',
    })),
  })),
  ColorService: {
    rgbToHex: vi.fn((r: number, g: number, b: number) => '#FF0000'),
    getColorDistance: vi.fn(() => 5.5),
  },
  dyeDatabase: {},
  LocalizationService: {
    getDyeName: vi.fn((id: number) => null),
    getCategory: vi.fn((category: string) => null),
    getAcquisition: vi.fn((acq: string) => null),
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
function createMockInteraction(options: {
  attachment?: Partial<Attachment> | null;
} = {}): ChatInputCommandInteraction {
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
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
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
});
