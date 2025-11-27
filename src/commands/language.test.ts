/**
 * Integration tests for /language command
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
    setUserPreference: vi.fn().mockResolvedValue(true),
    getUserPreference: vi.fn().mockResolvedValue(null),
    clearUserPreference: vi.fn().mockResolvedValue(true),
    getCurrentLocale: vi.fn(() => 'en'),
    setLocale: vi.fn(),
    getLocaleDisplayName: vi.fn((locale: string) => {
      const names: Record<string, string> = {
        en: 'English',
        ja: '日本語',
        de: 'Deutsch',
        fr: 'Français',
      };
      return names[locale] || locale;
    }),
    getSupportedLocales: vi.fn(() => [
      { code: 'en', name: 'English' },
      { code: 'ja', name: '日本語' },
      { code: 'de', name: 'Deutsch' },
      { code: 'fr', name: 'Français' },
    ]),
    discordLocaleToLocaleCode: vi.fn((locale: string) => {
      if (locale.startsWith('en')) return 'en';
      if (locale === 'ja') return 'ja';
      if (locale === 'de') return 'de';
      if (locale === 'fr') return 'fr';
      return null;
    }),
  },
  t: vi.fn((key: string) => key),
  setLocale: vi.fn(),
}));

vi.mock('../utils/embed-builder.js', () => ({
  createSuccessEmbed: vi.fn((title: string, description: string) => ({
    data: { title: `✅ ${title}`, description },
  })),
  createInfoEmbed: vi.fn((title: string, description: string) => ({
    data: { title: `ℹ️ ${title}`, description },
  })),
  createErrorEmbed: vi.fn((title: string, description: string) => ({
    data: { title: `❌ ${title}`, description },
  })),
  COLORS: {
    PRIMARY: 0x5865f2,
    SUCCESS: 0x57f287,
    WARNING: 0xfee75c,
    ERROR: 0xed4245,
    INFO: 0x5865f2,
  },
}));

/**
 * Create mock ChatInputCommandInteraction
 */
function createMockInteraction(options: {
  subcommand: string;
  stringOptions?: Record<string, string | null>;
  userId?: string;
  locale?: string;
}): ChatInputCommandInteraction {
  const deferReply = vi.fn().mockResolvedValue(undefined);
  const editReply = vi.fn().mockResolvedValue(undefined);
  const followUp = vi.fn().mockResolvedValue(undefined);
  const reply = vi.fn().mockResolvedValue(undefined);

  return {
    deferReply,
    editReply,
    followUp,
    reply,
    deferred: false,
    user: { id: options.userId || 'test-user-123' },
    locale: options.locale || 'en-US',
    options: {
      getSubcommand: vi.fn(() => options.subcommand),
      getString: vi.fn((name: string, _required?: boolean) => {
        return options.stringOptions?.[name] ?? null;
      }),
    },
  } as unknown as ChatInputCommandInteraction;
}

describe('Language Command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Set Subcommand', () => {
    it('should set language preference to en', async () => {
      const { execute } = await import('./language.js');
      const { i18nService } = await import('../services/i18n-service.js');

      const interaction = createMockInteraction({
        subcommand: 'set',
        stringOptions: { language: 'en' },
      });

      await execute(interaction);

      expect(i18nService.setUserPreference).toHaveBeenCalledWith('test-user-123', 'en');
      expect(interaction.reply).toHaveBeenCalled();
    });

    it('should set language preference to ja', async () => {
      const { execute } = await import('./language.js');
      const { i18nService } = await import('../services/i18n-service.js');

      const interaction = createMockInteraction({
        subcommand: 'set',
        stringOptions: { language: 'ja' },
      });

      await execute(interaction);

      expect(i18nService.setUserPreference).toHaveBeenCalledWith('test-user-123', 'ja');
    });

    it('should set language preference to de', async () => {
      const { execute } = await import('./language.js');
      const { i18nService } = await import('../services/i18n-service.js');

      const interaction = createMockInteraction({
        subcommand: 'set',
        stringOptions: { language: 'de' },
      });

      await execute(interaction);

      expect(i18nService.setUserPreference).toHaveBeenCalledWith('test-user-123', 'de');
    });

    it('should set language preference to fr', async () => {
      const { execute } = await import('./language.js');
      const { i18nService } = await import('../services/i18n-service.js');

      const interaction = createMockInteraction({
        subcommand: 'set',
        stringOptions: { language: 'fr' },
      });

      await execute(interaction);

      expect(i18nService.setUserPreference).toHaveBeenCalledWith('test-user-123', 'fr');
    });

    it('should show confirmation message', async () => {
      const { execute } = await import('./language.js');

      const interaction = createMockInteraction({
        subcommand: 'set',
        stringOptions: { language: 'en' },
      });

      await execute(interaction);

      expect(interaction.reply).toHaveBeenCalled();
    });

    it('should send ephemeral response', async () => {
      const { execute } = await import('./language.js');

      const interaction = createMockInteraction({
        subcommand: 'set',
        stringOptions: { language: 'en' },
      });

      await execute(interaction);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          flags: expect.anything(),
        })
      );
    });
  });

  describe('Show Subcommand', () => {
    it('should show current user preference when set', async () => {
      const { execute } = await import('./language.js');
      const { i18nService } = await import('../services/i18n-service.js');
      vi.mocked(i18nService.getUserPreference).mockResolvedValueOnce('ja');

      const interaction = createMockInteraction({
        subcommand: 'show',
      });

      await execute(interaction);

      expect(i18nService.getUserPreference).toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalled();
    });

    it('should show Discord locale when no preference', async () => {
      const { execute } = await import('./language.js');
      const { i18nService } = await import('../services/i18n-service.js');
      vi.mocked(i18nService.getUserPreference).mockResolvedValueOnce(null);

      const interaction = createMockInteraction({
        subcommand: 'show',
        locale: 'de',
      });

      await execute(interaction);

      expect(interaction.reply).toHaveBeenCalled();
    });

    it('should list all supported languages', async () => {
      const { execute } = await import('./language.js');
      const { i18nService } = await import('../services/i18n-service.js');

      const interaction = createMockInteraction({
        subcommand: 'show',
      });

      await execute(interaction);

      expect(i18nService.getSupportedLocales).toHaveBeenCalled();
    });

    it('should send ephemeral response', async () => {
      const { execute } = await import('./language.js');

      const interaction = createMockInteraction({
        subcommand: 'show',
      });

      await execute(interaction);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          flags: expect.anything(),
        })
      );
    });
  });

  describe('Reset Subcommand', () => {
    it('should clear user preference', async () => {
      const { execute } = await import('./language.js');
      const { i18nService } = await import('../services/i18n-service.js');

      const interaction = createMockInteraction({
        subcommand: 'reset',
      });

      await execute(interaction);

      expect(i18nService.clearUserPreference).toHaveBeenCalledWith('test-user-123');
    });

    it('should show confirmation message', async () => {
      const { execute } = await import('./language.js');

      const interaction = createMockInteraction({
        subcommand: 'reset',
      });

      await execute(interaction);

      expect(interaction.reply).toHaveBeenCalled();
    });

    it('should send ephemeral response', async () => {
      const { execute } = await import('./language.js');

      const interaction = createMockInteraction({
        subcommand: 'reset',
      });

      await execute(interaction);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          flags: expect.anything(),
        })
      );
    });
  });

  describe('Locale Detection', () => {
    it('should set locale from interaction at start', async () => {
      const { execute } = await import('./language.js');
      const { i18nService } = await import('../services/i18n-service.js');

      const interaction = createMockInteraction({
        subcommand: 'show',
      });

      await execute(interaction);

      expect(i18nService.setLocaleFromInteraction).toHaveBeenCalledWith(interaction);
    });
  });
});
