/**
 * Unit tests for i18n service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MockRedisClient } from '../__tests__/helpers/mock-redis.js';
import { createMockInteraction } from '../__tests__/helpers/mock-interaction.js';
import { Locale } from 'discord.js';

// Mock logger
vi.mock('../utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock xivdyetools-core LocalizationService
vi.mock('xivdyetools-core', () => ({
  LocalizationService: {
    setLocale: vi.fn().mockResolvedValue(undefined),
    preloadLocales: vi.fn().mockResolvedValue(undefined),
  },
}));

// Create a mock Redis client
let mockRedisClient: MockRedisClient | null = null;

// Mock the redis module
vi.mock('./redis.js', () => ({
  getRedisClient: () => mockRedisClient,
}));

// Mock translations
const mockTranslations = {
  en: {
    errors: {
      invalidInput: 'Invalid input provided',
      notFound: 'Not found: {name}',
    },
    labels: {
      dye: 'Dye',
      color: 'Color',
    },
  },
  ja: {
    errors: {
      invalidInput: '無効な入力です',
    },
    labels: {
      dye: '染料',
    },
  },
  de: {
    errors: {
      invalidInput: 'Ungültige Eingabe',
    },
    labels: {
      dye: 'Farbstoff',
    },
  },
  fr: {
    errors: {
      invalidInput: 'Entrée invalide',
    },
    labels: {
      dye: 'Teinture',
    },
  },
};

// Mock fs module
vi.mock('fs', () => ({
  readFileSync: vi.fn((path: string) => {
    if (path.includes('en.json')) return JSON.stringify(mockTranslations.en);
    if (path.includes('ja.json')) return JSON.stringify(mockTranslations.ja);
    if (path.includes('de.json')) return JSON.stringify(mockTranslations.de);
    if (path.includes('fr.json')) return JSON.stringify(mockTranslations.fr);
    throw new Error(`File not found: ${path}`);
  }),
}));

describe('i18n Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedisClient = null;
  });

  afterEach(() => {
    vi.clearAllMocks();
    mockRedisClient = null;
  });

  describe('setLocale and getCurrentLocale', () => {
    it('should set locale to en', async () => {
      vi.resetModules();
      const { setLocale, getCurrentLocale } = await import('./i18n-service.js');

      setLocale('en');
      expect(getCurrentLocale()).toBe('en');
    });

    it('should set locale to ja', async () => {
      vi.resetModules();
      const { setLocale, getCurrentLocale } = await import('./i18n-service.js');

      setLocale('ja');
      expect(getCurrentLocale()).toBe('ja');
    });

    it('should set locale to de', async () => {
      vi.resetModules();
      const { setLocale, getCurrentLocale } = await import('./i18n-service.js');

      setLocale('de');
      expect(getCurrentLocale()).toBe('de');
    });

    it('should set locale to fr', async () => {
      vi.resetModules();
      const { setLocale, getCurrentLocale } = await import('./i18n-service.js');

      setLocale('fr');
      expect(getCurrentLocale()).toBe('fr');
    });

    it('should default to en for unsupported locales', async () => {
      vi.resetModules();
      const { setLocale, getCurrentLocale } = await import('./i18n-service.js');

      setLocale('unsupported' as any);
      expect(getCurrentLocale()).toBe('en');
    });
  });

  describe('t() translation function', () => {
    it('should return translated string for key', async () => {
      vi.resetModules();
      const { t, setLocale } = await import('./i18n-service.js');

      setLocale('en');
      const result = t('errors.invalidInput');
      expect(result).toBe('Invalid input provided');
    });

    it('should return English fallback when translation missing', async () => {
      vi.resetModules();
      const { t, setLocale } = await import('./i18n-service.js');

      setLocale('ja');
      // 'notFound' is only in English
      const result = t('errors.notFound', { name: 'test' });
      expect(result).toBe('Not found: test');
    });

    it('should interpolate parameters correctly', async () => {
      vi.resetModules();
      const { t, setLocale } = await import('./i18n-service.js');

      setLocale('en');
      const result = t('errors.notFound', { name: 'Dalamud Red' });
      expect(result).toBe('Not found: Dalamud Red');
    });

    it('should return formatted key when translation not found', async () => {
      vi.resetModules();
      const { t, setLocale } = await import('./i18n-service.js');

      setLocale('en');
      const result = t('some.nonExistent.deepKey');
      // Should format the last part of the key
      expect(result).toBe('Deep Key');
    });
  });

  describe('discordLocaleToLocaleCode', () => {
    it('should map en-US to en', async () => {
      vi.resetModules();
      const { i18nService } = await import('./i18n-service.js');

      const result = i18nService.discordLocaleToLocaleCode('en-US');
      expect(result).toBe('en');
    });

    it('should map en-GB to en', async () => {
      vi.resetModules();
      const { i18nService } = await import('./i18n-service.js');

      const result = i18nService.discordLocaleToLocaleCode('en-GB');
      expect(result).toBe('en');
    });

    it('should map ja to ja', async () => {
      vi.resetModules();
      const { i18nService } = await import('./i18n-service.js');

      const result = i18nService.discordLocaleToLocaleCode('ja');
      expect(result).toBe('ja');
    });

    it('should map de to de', async () => {
      vi.resetModules();
      const { i18nService } = await import('./i18n-service.js');

      const result = i18nService.discordLocaleToLocaleCode('de');
      expect(result).toBe('de');
    });

    it('should map fr to fr', async () => {
      vi.resetModules();
      const { i18nService } = await import('./i18n-service.js');

      const result = i18nService.discordLocaleToLocaleCode('fr');
      expect(result).toBe('fr');
    });

    it('should return null for unsupported locales', async () => {
      vi.resetModules();
      const { i18nService } = await import('./i18n-service.js');

      const result = i18nService.discordLocaleToLocaleCode('ko');
      expect(result).toBeNull();
    });
  });

  describe('User preferences', () => {
    describe('with memory fallback', () => {
      beforeEach(() => {
        mockRedisClient = null;
      });

      it('should return null when no preference set', async () => {
        vi.resetModules();
        const { i18nService } = await import('./i18n-service.js');

        const pref = await i18nService.getUserPreference('user-1');
        expect(pref).toBeNull();
      });

      it('should store and retrieve preference in memory', async () => {
        vi.resetModules();
        const { i18nService } = await import('./i18n-service.js');

        await i18nService.setUserPreference('user-1', 'ja');
        const pref = await i18nService.getUserPreference('user-1');
        expect(pref).toBe('ja');
      });

      it('should clear user preference', async () => {
        vi.resetModules();
        const { i18nService } = await import('./i18n-service.js');

        await i18nService.setUserPreference('user-1', 'de');
        await i18nService.clearUserPreference('user-1');
        const pref = await i18nService.getUserPreference('user-1');
        expect(pref).toBeNull();
      });
    });

    describe('with Redis', () => {
      beforeEach(() => {
        mockRedisClient = new MockRedisClient();
      });

      afterEach(() => {
        mockRedisClient = null;
      });

      it('should store preference in Redis', async () => {
        vi.resetModules();
        const { i18nService } = await import('./i18n-service.js');

        await i18nService.setUserPreference('user-1', 'fr');
        const stored = await mockRedisClient!.get('i18n:user:user-1');
        expect(stored).toBe('fr');
      });

      it('should retrieve preference from Redis', async () => {
        vi.resetModules();
        await mockRedisClient!.set('i18n:user:user-2', 'ja');

        const { i18nService } = await import('./i18n-service.js');
        const pref = await i18nService.getUserPreference('user-2');
        expect(pref).toBe('ja');
      });
    });
  });

  describe('setLocaleFromInteraction', () => {
    it('should prioritize user preference', async () => {
      vi.resetModules();
      const { i18nService, getCurrentLocale } = await import('./i18n-service.js');

      // Set user preference
      await i18nService.setUserPreference('test-user-123', 'de');

      // Create interaction with different Discord locale
      const interaction = createMockInteraction({
        userId: 'test-user-123',
        locale: 'en-US',
      });

      await i18nService.setLocaleFromInteraction(interaction);
      expect(getCurrentLocale()).toBe('de');
    });

    it('should fall back to Discord locale when no preference', async () => {
      vi.resetModules();
      const { i18nService, getCurrentLocale } = await import('./i18n-service.js');

      const interaction = createMockInteraction({
        userId: 'new-user',
        locale: 'ja',
      });

      await i18nService.setLocaleFromInteraction(interaction);
      expect(getCurrentLocale()).toBe('ja');
    });

    it('should fall back to English for unsupported Discord locale', async () => {
      vi.resetModules();
      const { i18nService, getCurrentLocale } = await import('./i18n-service.js');

      const interaction = createMockInteraction({
        userId: 'new-user',
        locale: 'ko', // Korean - not supported
      });

      await i18nService.setLocaleFromInteraction(interaction);
      expect(getCurrentLocale()).toBe('en');
    });
  });

  describe('getLocaleDisplayName', () => {
    it('should return English for en', async () => {
      vi.resetModules();
      const { getLocaleDisplayName } = await import('./i18n-service.js');

      expect(getLocaleDisplayName('en')).toBe('English');
    });

    it('should return 日本語 for ja', async () => {
      vi.resetModules();
      const { getLocaleDisplayName } = await import('./i18n-service.js');

      expect(getLocaleDisplayName('ja')).toBe('日本語');
    });

    it('should return Deutsch for de', async () => {
      vi.resetModules();
      const { getLocaleDisplayName } = await import('./i18n-service.js');

      expect(getLocaleDisplayName('de')).toBe('Deutsch');
    });

    it('should return Français for fr', async () => {
      vi.resetModules();
      const { getLocaleDisplayName } = await import('./i18n-service.js');

      expect(getLocaleDisplayName('fr')).toBe('Français');
    });
  });

  describe('getSupportedLocales', () => {
    it('should return all 4 supported locales', async () => {
      vi.resetModules();
      const { getSupportedLocales } = await import('./i18n-service.js');

      const locales = getSupportedLocales();
      expect(locales).toHaveLength(4);
      expect(locales.map((l) => l.code)).toContain('en');
      expect(locales.map((l) => l.code)).toContain('ja');
      expect(locales.map((l) => l.code)).toContain('de');
      expect(locales.map((l) => l.code)).toContain('fr');
    });
  });

  describe('initialize', () => {
    it('should preload all locales', async () => {
      vi.resetModules();
      const { LocalizationService } = await import('xivdyetools-core');
      const { i18nService } = await import('./i18n-service.js');

      await i18nService.initialize();

      expect(LocalizationService.preloadLocales).toHaveBeenCalledWith(['en', 'ja', 'de', 'fr']);
    });
  });
});
