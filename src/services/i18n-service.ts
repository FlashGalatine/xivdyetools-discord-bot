/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
/**
 * i18n Service - Internationalization service for the Discord bot
 *
 * Provides:
 * - Hybrid locale detection (user preference -> Discord locale -> fallback)
 * - Bot-specific string translations
 * - Integration with xivdyetools-core LocalizationService for dye data
 * - Redis storage for user language preferences
 */

import { ChatInputCommandInteraction, AutocompleteInteraction, Locale } from 'discord.js';
import { LocalizationService } from 'xivdyetools-core';
import { getRedis } from './redis.js';
import { logger } from '../utils/logger.js';

// Import translation files
import enTranslations from '../i18n/translations/en.json' with { type: 'json' };
import jaTranslations from '../i18n/translations/ja.json' with { type: 'json' };
import deTranslations from '../i18n/translations/de.json' with { type: 'json' };
import frTranslations from '../i18n/translations/fr.json' with { type: 'json' };

/**
 * Supported locale codes (matching xivdyetools-core)
 */
export type LocaleCode = 'en' | 'ja' | 'de' | 'fr';

/**
 * Array of supported locales
 */
const SUPPORTED_LOCALES: readonly LocaleCode[] = ['en', 'ja', 'de', 'fr'] as const;

/**
 * Type for translation data structure
 */
type TranslationData = typeof enTranslations;

/**
 * Map of locale codes to translation data
 */
const translations: Record<LocaleCode, TranslationData> = {
  en: enTranslations,
  ja: jaTranslations,
  de: deTranslations,
  fr: frTranslations,
};

/**
 * Redis key prefix for user language preferences
 */
const REDIS_PREFIX = 'i18n:user:';

/**
 * Current active locale (thread-local concept - set per request)
 */
let currentLocale: LocaleCode = 'en';

/**
 * Map Discord Locale enum to our LocaleCode
 */
function discordLocaleToLocaleCode(discordLocale: Locale | string): LocaleCode | null {
  const localeMap: Record<string, LocaleCode> = {
    // English variants
    'en-US': 'en',
    'en-GB': 'en',
    // Japanese
    ja: 'ja',
    // German
    de: 'de',
    // French
    fr: 'fr',
  };

  // Try direct mapping first
  if (localeMap[discordLocale]) {
    return localeMap[discordLocale];
  }

  // Try extracting base language (e.g., 'ja-JP' -> 'ja')
  const baseLocale = discordLocale.split('-')[0].toLowerCase();
  if (SUPPORTED_LOCALES.includes(baseLocale as LocaleCode)) {
    return baseLocale as LocaleCode;
  }

  return null;
}

/**
 * Get user language preference from Redis
 */
async function getUserPreference(userId: string): Promise<LocaleCode | null> {
  try {
    const redis = getRedis();
    if (!redis) {
      return null;
    }

    const preference = await redis.get(`${REDIS_PREFIX}${userId}`);
    if (preference && SUPPORTED_LOCALES.includes(preference as LocaleCode)) {
      return preference as LocaleCode;
    }

    return null;
  } catch (error) {
    logger.warn('Failed to get user language preference from Redis:', error);
    return null;
  }
}

/**
 * Set user language preference in Redis
 */
async function setUserPreference(userId: string, locale: LocaleCode): Promise<boolean> {
  try {
    const redis = getRedis();
    if (!redis) {
      return false;
    }

    await redis.set(`${REDIS_PREFIX}${userId}`, locale);
    return true;
  } catch (error) {
    logger.error('Failed to set user language preference in Redis:', error);
    return false;
  }
}

/**
 * Clear user language preference from Redis
 */
async function clearUserPreference(userId: string): Promise<boolean> {
  try {
    const redis = getRedis();
    if (!redis) {
      return false;
    }

    await redis.del(`${REDIS_PREFIX}${userId}`);
    return true;
  } catch (error) {
    logger.error('Failed to clear user language preference from Redis:', error);
    return false;
  }
}

/**
 * Set the current locale
 */
function setLocale(locale: LocaleCode): void {
  if (SUPPORTED_LOCALES.includes(locale)) {
    currentLocale = locale;
  } else {
    currentLocale = 'en';
  }
}

/**
 * Get the current locale
 */
function getCurrentLocale(): LocaleCode {
  return currentLocale;
}

/**
 * Resolve locale from Discord interaction using hybrid detection
 * Priority: User preference (Redis) > Discord locale > English fallback
 */
async function setLocaleFromInteraction(
  interaction: ChatInputCommandInteraction | AutocompleteInteraction
): Promise<LocaleCode> {
  const userId = interaction.user.id;

  // 1. Check user preference in Redis (highest priority)
  const userPreference = await getUserPreference(userId);
  if (userPreference) {
    setLocale(userPreference);
    await LocalizationService.setLocale(userPreference);
    return userPreference;
  }

  // 2. Check Discord interaction locale
  const discordLocale = discordLocaleToLocaleCode(interaction.locale);
  if (discordLocale) {
    setLocale(discordLocale);
    await LocalizationService.setLocale(discordLocale);
    return discordLocale;
  }

  // 3. Fallback to English
  setLocale('en');
  await LocalizationService.setLocale('en');
  return 'en';
}

/**
 * Get a nested value from an object using dot notation
 */
function getNestedValue(obj: unknown, path: string): unknown {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Translate a key with optional parameter interpolation
 *
 * @param key - Dot-notation key (e.g., 'errors.invalidInput')
 * @param params - Optional parameters for interpolation (e.g., { name: 'Snow White' })
 * @returns Translated string or key if not found
 */
function t(key: string, params?: Record<string, string | number>): string {
  // Get translation from current locale
  let value = getNestedValue(translations[currentLocale], key);

  // Fallback to English if not found
  if (value === undefined && currentLocale !== 'en') {
    value = getNestedValue(translations.en, key);
  }

  // If still not found, return the key formatted
  if (value === undefined || typeof value !== 'string') {
    // Convert camelCase/dot.notation to readable format
    return key
      .split('.')
      .pop()!
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  }

  // Interpolate parameters
  if (params) {
    for (const [paramKey, paramValue] of Object.entries(params)) {
      value = value.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue));
    }
  }

  return value;
}

/**
 * Get display name for a locale
 */
function getLocaleDisplayName(locale: LocaleCode): string {
  const names: Record<LocaleCode, string> = {
    en: 'English',
    ja: '日本語',
    de: 'Deutsch',
    fr: 'Français',
  };
  return names[locale] || locale;
}

/**
 * Get all supported locales with display names
 */
function getSupportedLocales(): Array<{ code: LocaleCode; name: string }> {
  return SUPPORTED_LOCALES.map((code: LocaleCode) => ({
    code,
    name: getLocaleDisplayName(code),
  }));
}

/**
 * Initialize localization services
 * Should be called on bot startup
 */
async function initialize(): Promise<void> {
  try {
    // Preload all locales in core library
    const locales: LocaleCode[] = [...SUPPORTED_LOCALES];
    await LocalizationService.preloadLocales(locales);
    logger.info(`Localization initialized with ${locales.length} locales`);
  } catch (error) {
    logger.error('Failed to initialize localization:', error);
    throw error;
  }
}

/**
 * Export the i18n service
 */
export const i18nService = {
  // Locale management
  setLocale,
  getCurrentLocale,
  setLocaleFromInteraction,
  initialize,

  // Translation
  t,

  // User preferences
  getUserPreference,
  setUserPreference,
  clearUserPreference,

  // Utilities
  getLocaleDisplayName,
  getSupportedLocales,
  discordLocaleToLocaleCode,
};

// Also export individual functions for convenience
export {
  t,
  setLocale,
  getCurrentLocale,
  setLocaleFromInteraction,
  getLocaleDisplayName,
  getSupportedLocales,
};
