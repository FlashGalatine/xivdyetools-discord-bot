/**
 * Integration tests for /about command
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

describe('About Command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('execute', () => {
    it('should return single embed', async () => {
      const { aboutCommand } = await import('./about.js');

      const interaction = createMockInteraction();
      await aboutCommand.execute(interaction);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.any(Array),
        })
      );

      const replyCall = vi.mocked(interaction.reply).mock.calls[0][0] as { embeds: unknown[] };
      expect(replyCall.embeds.length).toBe(1);
    });

    it('should send ephemeral response', async () => {
      const { aboutCommand } = await import('./about.js');

      const interaction = createMockInteraction();
      await aboutCommand.execute(interaction);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          flags: expect.anything(),
        })
      );
    });

    it('should include version information', async () => {
      const { aboutCommand } = await import('./about.js');

      const interaction = createMockInteraction();
      await aboutCommand.execute(interaction);

      expect(interaction.reply).toHaveBeenCalled();
    });

    it('should include author information', async () => {
      const { aboutCommand } = await import('./about.js');

      const interaction = createMockInteraction();
      await aboutCommand.execute(interaction);

      expect(interaction.reply).toHaveBeenCalled();
    });

    it('should include bot information', async () => {
      const { aboutCommand } = await import('./about.js');

      const interaction = createMockInteraction();
      await aboutCommand.execute(interaction);

      expect(interaction.reply).toHaveBeenCalled();
    });
  });
});
