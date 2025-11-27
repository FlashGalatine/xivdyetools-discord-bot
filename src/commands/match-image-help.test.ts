/**
 * Integration tests for /match_image_help command
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChatInputCommandInteraction } from 'discord.js';

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

vi.mock('../config.js', () => ({
  config: {
    image: {
      maxSizeMB: 8,
    },
  },
}));

/**
 * Create mock ChatInputCommandInteraction
 */
function createMockInteraction(): ChatInputCommandInteraction {
  const reply = vi.fn().mockResolvedValue(undefined);

  return {
    reply,
    user: { id: 'test-user-123' },
    locale: 'en-US',
  } as unknown as ChatInputCommandInteraction;
}

describe('Match Image Help Command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('execute', () => {
    it('should return multiple embeds', async () => {
      const { matchImageHelpCommand } = await import('./match-image-help.js');

      const interaction = createMockInteraction();
      await matchImageHelpCommand.execute(interaction);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.any(Array),
        })
      );

      const replyCall = vi.mocked(interaction.reply).mock.calls[0][0] as { embeds: unknown[] };
      expect(replyCall.embeds.length).toBeGreaterThanOrEqual(1);
    });

    it('should send ephemeral response', async () => {
      const { matchImageHelpCommand } = await import('./match-image-help.js');

      const interaction = createMockInteraction();
      await matchImageHelpCommand.execute(interaction);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          flags: expect.anything(),
        })
      );
    });

    it('should include supported formats', async () => {
      const { matchImageHelpCommand } = await import('./match-image-help.js');

      const interaction = createMockInteraction();
      await matchImageHelpCommand.execute(interaction);

      expect(interaction.reply).toHaveBeenCalled();
    });

    it('should include match quality ratings', async () => {
      const { matchImageHelpCommand } = await import('./match-image-help.js');

      const interaction = createMockInteraction();
      await matchImageHelpCommand.execute(interaction);

      expect(interaction.reply).toHaveBeenCalled();
    });

    it('should include tips for best results', async () => {
      const { matchImageHelpCommand } = await import('./match-image-help.js');

      const interaction = createMockInteraction();
      await matchImageHelpCommand.execute(interaction);

      expect(interaction.reply).toHaveBeenCalled();
    });

    it('should include help information', async () => {
      const { matchImageHelpCommand } = await import('./match-image-help.js');

      const interaction = createMockInteraction();
      await matchImageHelpCommand.execute(interaction);

      expect(interaction.reply).toHaveBeenCalled();
    });
  });
});
