/**
 * Tests for config.ts - environment validation and configuration
 * Targets uncovered branches: 64-65, 83-84, 88-91, 95-96, 105-106
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dotenv to prevent loading the real .env file
vi.mock('dotenv', () => ({
  config: vi.fn(),
}));

describe('Config Module', () => {
  // Store original env values
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset modules before each test to get fresh config loading
    vi.resetModules();
    // Clear mocks
    vi.clearAllMocks();
    // Clear all env variables that might affect config
    delete process.env.DISCORD_TOKEN;
    delete process.env.DISCORD_CLIENT_ID;
    delete process.env.DISCORD_GUILD_ID;
    delete process.env.REDIS_URL;
    delete process.env.LOG_LEVEL;
    delete process.env.PORT;
    delete process.env.ERROR_WEBHOOK_URL;
    delete process.env.IMAGE_MAX_SIZE_MB;
    delete process.env.IMAGE_CACHE_TTL;
    delete process.env.API_CACHE_TTL;
    delete process.env.API_TIMEOUT_MS;
    delete process.env.RATE_LIMIT_PER_MINUTE;
    delete process.env.RATE_LIMIT_PER_HOUR;
  });

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };
    vi.unstubAllEnvs();
  });

  describe('validateEnv', () => {
    it('should throw when DISCORD_TOKEN is missing', async () => {
      // Remove DISCORD_TOKEN
      delete process.env.DISCORD_TOKEN;
      process.env.DISCORD_CLIENT_ID = 'valid-client-id-12345';

      await expect(import('./config.js')).rejects.toThrow(
        'Missing required environment variables: DISCORD_TOKEN'
      );
    });

    it('should throw when DISCORD_CLIENT_ID is missing', async () => {
      process.env.DISCORD_TOKEN =
        'valid-token-that-is-long-enough-to-pass-length-check-12345678901234567890';
      delete process.env.DISCORD_CLIENT_ID;

      await expect(import('./config.js')).rejects.toThrow(
        'Missing required environment variables: DISCORD_CLIENT_ID'
      );
    });

    it('should throw when both required vars are missing', async () => {
      delete process.env.DISCORD_TOKEN;
      delete process.env.DISCORD_CLIENT_ID;

      await expect(import('./config.js')).rejects.toThrow('Missing required environment variables');
    });
  });

  describe('validateSecrets - placeholder detection', () => {
    beforeEach(() => {
      process.env.DISCORD_CLIENT_ID = 'valid-client-id-12345';
    });

    it('should throw when token contains "your_"', async () => {
      process.env.DISCORD_TOKEN = 'your_token_here_please_replace_with_actual_token_value';

      await expect(import('./config.js')).rejects.toThrow(
        'DISCORD_TOKEN appears to be a placeholder'
      );
    });

    it('should throw when token contains "example"', async () => {
      process.env.DISCORD_TOKEN = 'example_token_value_that_is_long_enough_to_pass_check';

      await expect(import('./config.js')).rejects.toThrow(
        'DISCORD_TOKEN appears to be a placeholder'
      );
    });

    it('should throw when token contains "placeholder"', async () => {
      process.env.DISCORD_TOKEN = 'this_is_a_placeholder_token_that_should_be_replaced_now';

      await expect(import('./config.js')).rejects.toThrow(
        'DISCORD_TOKEN appears to be a placeholder'
      );
    });
  });

  describe('validateSecrets - short token warning', () => {
    beforeEach(() => {
      process.env.DISCORD_CLIENT_ID = 'valid-client-id-12345';
    });

    it('should warn when token is unusually short (< 50 chars)', async () => {
      // Token shorter than 50 characters but not a placeholder
      process.env.DISCORD_TOKEN = 'short_token_value_here';
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // This should not throw but should warn
      const configModule = await import('./config.js');

      expect(configModule.config).toBeDefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('DISCORD_TOKEN appears unusually short')
      );

      consoleSpy.mockRestore();
    });

    it('should not warn when token is long enough', async () => {
      // Token longer than 50 characters
      process.env.DISCORD_TOKEN = 'this_is_a_valid_long_token_that_passes_the_length_check_easily';
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const configModule = await import('./config.js');

      expect(configModule.config).toBeDefined();
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('DISCORD_TOKEN appears unusually short')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('validateSecrets - test token values', () => {
    beforeEach(() => {
      process.env.DISCORD_CLIENT_ID = 'valid-client-id-12345';
    });

    it('should throw when token is "test"', async () => {
      process.env.DISCORD_TOKEN = 'test';

      await expect(import('./config.js')).rejects.toThrow(
        'DISCORD_TOKEN appears to be a test value'
      );
    });

    it('should throw when token is "TEST"', async () => {
      process.env.DISCORD_TOKEN = 'TEST';

      await expect(import('./config.js')).rejects.toThrow(
        'DISCORD_TOKEN appears to be a test value'
      );
    });

    it('should throw when token is "123"', async () => {
      process.env.DISCORD_TOKEN = '123';

      await expect(import('./config.js')).rejects.toThrow(
        'DISCORD_TOKEN appears to be a test value'
      );
    });
  });

  describe('getLogLevel', () => {
    beforeEach(() => {
      process.env.DISCORD_TOKEN = 'valid_token_that_is_definitely_long_enough_to_pass_all_checks';
      process.env.DISCORD_CLIENT_ID = 'valid-client-id-12345';
    });

    it('should return "debug" when LOG_LEVEL is "debug"', async () => {
      process.env.LOG_LEVEL = 'debug';

      const { config } = await import('./config.js');
      expect(config.logLevel).toBe('debug');
    });

    it('should return "info" when LOG_LEVEL is "info"', async () => {
      process.env.LOG_LEVEL = 'info';

      const { config } = await import('./config.js');
      expect(config.logLevel).toBe('info');
    });

    it('should return "warn" when LOG_LEVEL is "warn"', async () => {
      process.env.LOG_LEVEL = 'warn';

      const { config } = await import('./config.js');
      expect(config.logLevel).toBe('warn');
    });

    it('should return "error" when LOG_LEVEL is "error"', async () => {
      process.env.LOG_LEVEL = 'error';

      const { config } = await import('./config.js');
      expect(config.logLevel).toBe('error');
    });

    it('should return "info" (default) when LOG_LEVEL is invalid', async () => {
      process.env.LOG_LEVEL = 'invalid';

      const { config } = await import('./config.js');
      expect(config.logLevel).toBe('info');
    });

    it('should return "info" (default) when LOG_LEVEL is not set', async () => {
      delete process.env.LOG_LEVEL;

      const { config } = await import('./config.js');
      expect(config.logLevel).toBe('info');
    });

    it('should handle uppercase LOG_LEVEL (case insensitive)', async () => {
      process.env.LOG_LEVEL = 'DEBUG';

      const { config } = await import('./config.js');
      expect(config.logLevel).toBe('debug');
    });
  });

  describe('config values', () => {
    beforeEach(() => {
      process.env.DISCORD_TOKEN = 'valid_token_that_is_definitely_long_enough_to_pass_all_checks';
      process.env.DISCORD_CLIENT_ID = 'valid-client-id-12345';
    });

    it('should use default port when PORT is not set', async () => {
      delete process.env.PORT;

      const { config } = await import('./config.js');
      expect(config.port).toBe(3000);
    });

    it('should use custom port when PORT is set', async () => {
      process.env.PORT = '8080';

      const { config } = await import('./config.js');
      expect(config.port).toBe(8080);
    });

    it('should include command-specific rate limits', async () => {
      const { config } = await import('./config.js');

      expect(config.rateLimit.commandLimits).toBeDefined();
      expect(config.rateLimit.commandLimits.match_image).toEqual({
        perMinute: 3,
        perHour: 20,
      });
      expect(config.rateLimit.commandLimits.harmony).toEqual({
        perMinute: 8,
        perHour: 80,
      });
    });

    it('should set optional guildId when provided', async () => {
      process.env.DISCORD_GUILD_ID = 'my-test-guild-id';

      const { config } = await import('./config.js');
      expect(config.guildId).toBe('my-test-guild-id');
    });

    it('should set redisUrl when provided', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';

      const { config } = await import('./config.js');
      expect(config.redisUrl).toBe('redis://localhost:6379');
    });

    it('should set errorWebhookUrl when provided', async () => {
      process.env.ERROR_WEBHOOK_URL = 'https://discord.com/webhook/123';

      const { config } = await import('./config.js');
      expect(config.errorWebhookUrl).toBe('https://discord.com/webhook/123');
    });
  });

  describe('validateOptionalUrls - Redis URL validation', () => {
    beforeEach(() => {
      process.env.DISCORD_TOKEN = 'valid_token_that_is_definitely_long_enough_to_pass_all_checks';
      process.env.DISCORD_CLIENT_ID = 'valid-client-id-12345';
    });

    it('should accept valid redis:// URL', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';

      const configModule = await import('./config.js');
      expect(configModule.config.redisUrl).toBe('redis://localhost:6379');
    });

    it('should accept valid rediss:// URL', async () => {
      process.env.REDIS_URL = 'rediss://secure.redis.example.com:6379';

      const configModule = await import('./config.js');
      expect(configModule.config.redisUrl).toBe('rediss://secure.redis.example.com:6379');
    });

    it('should throw when REDIS_URL uses wrong protocol', async () => {
      process.env.REDIS_URL = 'http://localhost:6379';

      await expect(import('./config.js')).rejects.toThrow(
        'REDIS_URL must use redis:// or rediss:// protocol'
      );
    });

    it('should throw when REDIS_URL is invalid', async () => {
      process.env.REDIS_URL = 'not-a-valid-url';

      await expect(import('./config.js')).rejects.toThrow('REDIS_URL is not a valid URL');
    });
  });

  describe('validateOptionalUrls - Webhook URL validation', () => {
    beforeEach(() => {
      process.env.DISCORD_TOKEN = 'valid_token_that_is_definitely_long_enough_to_pass_all_checks';
      process.env.DISCORD_CLIENT_ID = 'valid-client-id-12345';
    });

    it('should throw when ERROR_WEBHOOK_URL uses HTTP instead of HTTPS', async () => {
      process.env.ERROR_WEBHOOK_URL = 'http://discord.com/api/webhooks/123/abc';

      await expect(import('./config.js')).rejects.toThrow(
        'ERROR_WEBHOOK_URL must use HTTPS protocol'
      );
    });

    it('should throw when ERROR_WEBHOOK_URL is invalid', async () => {
      process.env.ERROR_WEBHOOK_URL = 'not-a-valid-url';

      await expect(import('./config.js')).rejects.toThrow('ERROR_WEBHOOK_URL is not a valid URL');
    });

    it('should warn when webhook URL is not from discord.com', async () => {
      process.env.ERROR_WEBHOOK_URL = 'https://example.com/webhook/123';
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const configModule = await import('./config.js');

      expect(configModule.config.errorWebhookUrl).toBe('https://example.com/webhook/123');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('ERROR_WEBHOOK_URL does not appear to be a Discord webhook')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('validateNumericBounds', () => {
    beforeEach(() => {
      process.env.DISCORD_TOKEN = 'valid_token_that_is_definitely_long_enough_to_pass_all_checks';
      process.env.DISCORD_CLIENT_ID = 'valid-client-id-12345';
    });

    it('should throw when PORT is not a number', async () => {
      process.env.PORT = 'not-a-number';

      await expect(import('./config.js')).rejects.toThrow(
        'PORT must be a number between 1 and 65535'
      );
    });

    it('should throw when PORT is below 1', async () => {
      process.env.PORT = '0';

      await expect(import('./config.js')).rejects.toThrow(
        'PORT must be a number between 1 and 65535'
      );
    });

    it('should throw when PORT is above 65535', async () => {
      process.env.PORT = '70000';

      await expect(import('./config.js')).rejects.toThrow(
        'PORT must be a number between 1 and 65535'
      );
    });

    it('should throw when RATE_LIMIT_PER_MINUTE is out of bounds', async () => {
      process.env.RATE_LIMIT_PER_MINUTE = '0';

      await expect(import('./config.js')).rejects.toThrow(
        'RATE_LIMIT_PER_MINUTE must be between 1 and 100'
      );
    });

    it('should throw when RATE_LIMIT_PER_MINUTE is too high', async () => {
      process.env.RATE_LIMIT_PER_MINUTE = '200';

      await expect(import('./config.js')).rejects.toThrow(
        'RATE_LIMIT_PER_MINUTE must be between 1 and 100'
      );
    });

    it('should throw when RATE_LIMIT_PER_HOUR is out of bounds', async () => {
      process.env.RATE_LIMIT_PER_HOUR = '0';

      await expect(import('./config.js')).rejects.toThrow(
        'RATE_LIMIT_PER_HOUR must be between 1 and 1000'
      );
    });

    it('should throw when RATE_LIMIT_PER_HOUR is too high', async () => {
      process.env.RATE_LIMIT_PER_HOUR = '5000';

      await expect(import('./config.js')).rejects.toThrow(
        'RATE_LIMIT_PER_HOUR must be between 1 and 1000'
      );
    });

    it('should throw when IMAGE_MAX_SIZE_MB is out of bounds', async () => {
      process.env.IMAGE_MAX_SIZE_MB = '0';

      await expect(import('./config.js')).rejects.toThrow(
        'IMAGE_MAX_SIZE_MB must be between 1 and 50'
      );
    });

    it('should throw when IMAGE_MAX_SIZE_MB is too high', async () => {
      process.env.IMAGE_MAX_SIZE_MB = '100';

      await expect(import('./config.js')).rejects.toThrow(
        'IMAGE_MAX_SIZE_MB must be between 1 and 50'
      );
    });

    it('should throw when IMAGE_CACHE_TTL is out of bounds', async () => {
      process.env.IMAGE_CACHE_TTL = '0';

      await expect(import('./config.js')).rejects.toThrow(
        'IMAGE_CACHE_TTL must be between 1 and 3600 seconds'
      );
    });

    it('should throw when IMAGE_CACHE_TTL is too high', async () => {
      process.env.IMAGE_CACHE_TTL = '7200';

      await expect(import('./config.js')).rejects.toThrow(
        'IMAGE_CACHE_TTL must be between 1 and 3600 seconds'
      );
    });

    it('should throw when API_CACHE_TTL is out of bounds', async () => {
      process.env.API_CACHE_TTL = '0';

      await expect(import('./config.js')).rejects.toThrow(
        'API_CACHE_TTL must be between 1 and 3600 seconds'
      );
    });

    it('should throw when API_CACHE_TTL is too high', async () => {
      process.env.API_CACHE_TTL = '7200';

      await expect(import('./config.js')).rejects.toThrow(
        'API_CACHE_TTL must be between 1 and 3600 seconds'
      );
    });

    it('should throw when API_TIMEOUT_MS is too low', async () => {
      process.env.API_TIMEOUT_MS = '50';

      await expect(import('./config.js')).rejects.toThrow(
        'API_TIMEOUT_MS must be between 100 and 60000 milliseconds'
      );
    });

    it('should throw when API_TIMEOUT_MS is too high', async () => {
      process.env.API_TIMEOUT_MS = '120000';

      await expect(import('./config.js')).rejects.toThrow(
        'API_TIMEOUT_MS must be between 100 and 60000 milliseconds'
      );
    });
  });

  describe('statsAuthorizedUsers parsing', () => {
    beforeEach(() => {
      process.env.DISCORD_TOKEN = 'valid_token_that_is_definitely_long_enough_to_pass_all_checks';
      process.env.DISCORD_CLIENT_ID = 'valid-client-id-12345';
    });

    it('should parse comma-separated user IDs', async () => {
      process.env.STATS_AUTHORIZED_USERS = 'user1,user2,user3';

      const { config } = await import('./config.js');
      expect(config.statsAuthorizedUsers).toEqual(['user1', 'user2', 'user3']);
    });

    it('should trim whitespace from user IDs', async () => {
      process.env.STATS_AUTHORIZED_USERS = ' user1 , user2 , user3 ';

      const { config } = await import('./config.js');
      expect(config.statsAuthorizedUsers).toEqual(['user1', 'user2', 'user3']);
    });

    it('should filter out empty strings', async () => {
      process.env.STATS_AUTHORIZED_USERS = 'user1,,user2,';

      const { config } = await import('./config.js');
      expect(config.statsAuthorizedUsers).toEqual(['user1', 'user2']);
    });

    it('should return empty array when not set', async () => {
      delete process.env.STATS_AUTHORIZED_USERS;

      const { config } = await import('./config.js');
      expect(config.statsAuthorizedUsers).toEqual([]);
    });
  });
});
