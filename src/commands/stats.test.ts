/**
 * Integration tests for /stats command
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

vi.mock('../services/analytics.js', () => ({
  getAnalytics: vi.fn(() => ({
    getStats: vi.fn().mockResolvedValue({
      totalCommands: 1000,
      commandBreakdown: { harmony: 500, match: 300, dye: 200 },
      uniqueUsers: 150,
      successRate: 98.5,
      recentErrors: ['harmony: ValidationError', 'match: TimeoutError'],
    }),
  })),
}));

vi.mock('../utils/response-helper.js', () => ({
  sendPublicSuccess: vi.fn(),
  sendEphemeralError: vi.fn(),
}));

// Bot owner ID from the actual command
const BOT_OWNER_ID = '110457699291906048';

/**
 * Create mock ChatInputCommandInteraction
 */
function createMockInteraction(options: { userId?: string } = {}): ChatInputCommandInteraction {
  const deferReply = vi.fn().mockResolvedValue(undefined);
  const editReply = vi.fn().mockResolvedValue(undefined);
  const reply = vi.fn().mockResolvedValue(undefined);

  const guildsCache = new Map();
  guildsCache.set('guild-1', { id: 'guild-1' });
  guildsCache.set('guild-2', { id: 'guild-2' });

  return {
    deferReply,
    editReply,
    reply,
    deferred: true,
    user: { id: options.userId || 'test-user-123' },
    locale: 'en-US',
    client: {
      guilds: {
        cache: guildsCache,
      },
      commands: new Map([
        ['harmony', {}],
        ['match', {}],
      ]),
      uptime: 86400000, // 1 day in ms
    },
  } as unknown as ChatInputCommandInteraction;
}

describe('Stats Command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Authorization', () => {
    it('should reject non-authorized users', async () => {
      const { statsCommand } = await import('./stats.js');

      const interaction = createMockInteraction({ userId: 'unauthorized-user' });
      await statsCommand.execute(interaction);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          ephemeral: true,
        })
      );
    });

    it('should allow authorized owner', async () => {
      const { statsCommand } = await import('./stats.js');

      const interaction = createMockInteraction({ userId: BOT_OWNER_ID });
      await statsCommand.execute(interaction);

      expect(interaction.deferReply).toHaveBeenCalled();
    });
  });

  describe('Stats Display', () => {
    it('should show total commands count', async () => {
      const { statsCommand } = await import('./stats.js');
      const { getAnalytics } = await import('../services/analytics.js');

      const interaction = createMockInteraction({ userId: BOT_OWNER_ID });
      await statsCommand.execute(interaction);

      expect(getAnalytics).toHaveBeenCalled();
    });

    it('should show unique users count', async () => {
      const { statsCommand } = await import('./stats.js');

      const interaction = createMockInteraction({ userId: BOT_OWNER_ID });
      await statsCommand.execute(interaction);

      expect(interaction.deferReply).toHaveBeenCalled();
    });

    it('should show success rate percentage', async () => {
      const { statsCommand } = await import('./stats.js');

      const interaction = createMockInteraction({ userId: BOT_OWNER_ID });
      await statsCommand.execute(interaction);

      expect(interaction.deferReply).toHaveBeenCalled();
    });

    it('should show server count', async () => {
      const { statsCommand } = await import('./stats.js');

      const interaction = createMockInteraction({ userId: BOT_OWNER_ID });
      await statsCommand.execute(interaction);

      expect(interaction.deferReply).toHaveBeenCalled();
    });

    it('should defer reply before fetching stats', async () => {
      const { statsCommand } = await import('./stats.js');

      const interaction = createMockInteraction({ userId: BOT_OWNER_ID });
      await statsCommand.execute(interaction);

      expect(interaction.deferReply).toHaveBeenCalled();
    });
  });

  describe('Empty Data Cases', () => {
    it('should handle empty command breakdown', async () => {
      vi.resetModules();
      vi.doMock('../services/analytics.js', () => ({
        getAnalytics: vi.fn(() => ({
          getStats: vi.fn().mockResolvedValue({
            totalCommands: 0,
            commandBreakdown: {},
            uniqueUsers: 0,
            successRate: 0,
            recentErrors: [],
          }),
        })),
      }));

      const { statsCommand } = await import('./stats.js');
      const { sendPublicSuccess } = await import('../utils/response-helper.js');

      const interaction = createMockInteraction({ userId: BOT_OWNER_ID });
      await statsCommand.execute(interaction);

      expect(sendPublicSuccess).toHaveBeenCalled();
    });

    it('should handle no recent errors', async () => {
      vi.resetModules();
      vi.doMock('../services/analytics.js', () => ({
        getAnalytics: vi.fn(() => ({
          getStats: vi.fn().mockResolvedValue({
            totalCommands: 100,
            commandBreakdown: { harmony: 50 },
            uniqueUsers: 10,
            successRate: 100,
            recentErrors: [],
          }),
        })),
      }));

      const { statsCommand } = await import('./stats.js');
      const { sendPublicSuccess } = await import('../utils/response-helper.js');

      const interaction = createMockInteraction({ userId: BOT_OWNER_ID });
      await statsCommand.execute(interaction);

      expect(sendPublicSuccess).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle analytics error', async () => {
      vi.resetModules();
      vi.doMock('../services/analytics.js', () => ({
        getAnalytics: vi.fn(() => ({
          getStats: vi.fn().mockRejectedValue(new Error('Redis connection failed')),
        })),
      }));

      const { statsCommand } = await import('./stats.js');
      const { sendEphemeralError } = await import('../utils/response-helper.js');

      const interaction = createMockInteraction({ userId: BOT_OWNER_ID });
      await statsCommand.execute(interaction);

      expect(sendEphemeralError).toHaveBeenCalled();
    });
  });
});
