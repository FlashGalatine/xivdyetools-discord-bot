/**
 * Configuration module for XIV Dye Tools Discord Bot
 * Loads and validates environment variables
 */

import { config as loadEnv } from 'dotenv';

// Load environment variables
loadEnv();

export interface BotConfig {
  // Discord
  token: string;
  clientId: string;
  guildId?: string; // Optional: for testing commands in a specific guild

  // Stats Command Authorization
  // Per Security Audit: Configurable list of user IDs allowed to access /stats
  statsAuthorizedUsers: string[];

  // Redis (optional - will use in-memory cache if not provided)
  redisUrl?: string;

  // Logging
  logLevel: 'debug' | 'info' | 'warn' | 'error';

  // Health Check
  port: number;

  // Error Notifications
  errorWebhookUrl?: string;

  // Rate Limiting
  rateLimit: {
    commandsPerMinute: number;
    commandsPerHour: number;
    // Per S-6: Command-specific rate limits
    commandLimits: {
      [commandName: string]: {
        perMinute: number;
        perHour: number;
      };
    };
  };

  // Image Processing
  image: {
    maxSizeMB: number;
    cacheTTL: number; // seconds
  };

  // API
  api: {
    cacheTTL: number; // seconds
    timeout: number; // milliseconds
  };

  // Community Presets API
  communityPresets: {
    /** API base URL */
    apiUrl: string;
    /** Shared secret for API authentication */
    apiSecret: string;
    /** Discord user IDs who can moderate presets */
    moderatorIds: string[];
    /** Discord role IDs that grant moderator access */
    moderatorRoleIds: string[];
    /** Channel ID for moderation notifications */
    moderationChannelId?: string;
    /** Channel ID for submission logs */
    submissionLogChannelId?: string;
    /** Bot owner Discord ID for DM alerts */
    ownerDiscordId?: string;
    /** Whether the feature is enabled */
    enabled: boolean;
  };

  // Internal Webhook (for web app notifications)
  internalWebhook: {
    /** Secret for authenticating incoming webhook calls */
    secret: string;
    /** Whether the internal webhook is enabled */
    enabled: boolean;
  };
}

/**
 * Validate required environment variables
 * Per S-5: Secret validation on startup
 */
function validateEnv(): void {
  const required = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Validate secrets are not placeholders
  validateSecrets();

  // Validate optional URLs have correct format
  validateOptionalUrls();

  // Validate numeric bounds
  validateNumericBounds();
}

/**
 * Validate optional URL environment variables
 * Per S-5: Ensure URLs are well-formed if provided
 */
function validateOptionalUrls(): void {
  // Validate Redis URL format if provided
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    try {
      const parsed = new URL(redisUrl);
      if (!['redis:', 'rediss:'].includes(parsed.protocol)) {
        throw new Error('REDIS_URL must use redis:// or rediss:// protocol');
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes('redis://')) {
        throw e;
      }
      throw new Error('REDIS_URL is not a valid URL');
    }
  }

  // Validate webhook URL format if provided
  const webhookUrl = process.env.ERROR_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      const parsed = new URL(webhookUrl);
      if (parsed.protocol !== 'https:') {
        throw new Error('ERROR_WEBHOOK_URL must use HTTPS protocol');
      }
      // Discord webhooks should be from discord.com
      if (!parsed.hostname.endsWith('discord.com')) {
        console.warn('⚠️  WARNING: ERROR_WEBHOOK_URL does not appear to be a Discord webhook');
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes('HTTPS')) {
        throw e;
      }
      throw new Error('ERROR_WEBHOOK_URL is not a valid URL');
    }
  }
}

/**
 * Validate numeric environment variables have reasonable bounds
 * Per S-5: Prevent misconfiguration
 */
function validateNumericBounds(): void {
  // Port number bounds
  const port = parseInt(process.env.PORT || '3000', 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a number between 1 and 65535');
  }

  // Rate limit bounds
  const rateLimitMinute = parseInt(process.env.RATE_LIMIT_PER_MINUTE || '10', 10);
  if (isNaN(rateLimitMinute) || rateLimitMinute < 1 || rateLimitMinute > 100) {
    throw new Error('RATE_LIMIT_PER_MINUTE must be between 1 and 100');
  }

  const rateLimitHour = parseInt(process.env.RATE_LIMIT_PER_HOUR || '100', 10);
  if (isNaN(rateLimitHour) || rateLimitHour < 1 || rateLimitHour > 1000) {
    throw new Error('RATE_LIMIT_PER_HOUR must be between 1 and 1000');
  }

  // Image size bounds (1-50 MB)
  const imageSizeMB = parseInt(process.env.IMAGE_MAX_SIZE_MB || '8', 10);
  if (isNaN(imageSizeMB) || imageSizeMB < 1 || imageSizeMB > 50) {
    throw new Error('IMAGE_MAX_SIZE_MB must be between 1 and 50');
  }

  // Cache TTL bounds (1 second to 1 hour)
  const imageCacheTTL = parseInt(process.env.IMAGE_CACHE_TTL || '300', 10);
  if (isNaN(imageCacheTTL) || imageCacheTTL < 1 || imageCacheTTL > 3600) {
    throw new Error('IMAGE_CACHE_TTL must be between 1 and 3600 seconds');
  }

  const apiCacheTTL = parseInt(process.env.API_CACHE_TTL || '300', 10);
  if (isNaN(apiCacheTTL) || apiCacheTTL < 1 || apiCacheTTL > 3600) {
    throw new Error('API_CACHE_TTL must be between 1 and 3600 seconds');
  }

  // API timeout bounds (100ms to 60s)
  const apiTimeout = parseInt(process.env.API_TIMEOUT_MS || '5000', 10);
  if (isNaN(apiTimeout) || apiTimeout < 100 || apiTimeout > 60000) {
    throw new Error('API_TIMEOUT_MS must be between 100 and 60000 milliseconds');
  }
}

/**
 * Validate secrets are not placeholders or suspicious values
 * Per S-5: Prevents accidental use of placeholder tokens
 */
function validateSecrets(): void {
  const token = process.env.DISCORD_TOKEN;

  // Check for placeholder values
  if (
    token &&
    (token.includes('your_') || token.includes('example') || token.includes('placeholder'))
  ) {
    throw new Error('DISCORD_TOKEN appears to be a placeholder. Please set a real token.');
  }

  // Check for suspicious token lengths (Discord tokens are typically 59+ characters)
  if (token && token.length < 50) {
    console.warn(
      '⚠️  WARNING: DISCORD_TOKEN appears unusually short. Please verify it is correct.'
    );
  }

  // Check for common test tokens
  if ((token && token === 'test') || token === 'TEST' || token === '123') {
    throw new Error('DISCORD_TOKEN appears to be a test value. Please set a real token.');
  }
}

/**
 * Parse log level from environment
 */
function getLogLevel(): 'debug' | 'info' | 'warn' | 'error' {
  const level = process.env.LOG_LEVEL?.toLowerCase();
  if (level === 'debug' || level === 'info' || level === 'warn' || level === 'error') {
    return level;
  }
  return 'info'; // default
}

// Validate environment
validateEnv();

/**
 * Bot configuration
 */
export const config: BotConfig = {
  // Discord
  token: process.env.DISCORD_TOKEN!,
  clientId: process.env.DISCORD_CLIENT_ID!,
  guildId: process.env.DISCORD_GUILD_ID,

  // Stats Command Authorization
  // Per Security Audit: Comma-separated list of Discord user IDs authorized to use /stats
  statsAuthorizedUsers: (process.env.STATS_AUTHORIZED_USERS || '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0),

  // Redis
  redisUrl: process.env.REDIS_URL,

  // Logging
  logLevel: getLogLevel(),

  // Health Check
  port: parseInt(process.env.PORT || '3000', 10),

  // Error Notifications
  errorWebhookUrl: process.env.ERROR_WEBHOOK_URL,

  // Rate Limiting
  rateLimit: {
    commandsPerMinute: parseInt(process.env.RATE_LIMIT_PER_MINUTE || '10', 10),
    commandsPerHour: parseInt(process.env.RATE_LIMIT_PER_HOUR || '100', 10),
    // Per S-6: Command-specific rate limits
    // Image processing commands have lower limits (more resource-intensive)
    // Simple lookups have higher limits
    commandLimits: {
      match_image: {
        perMinute: 3, // Lower limit for image processing
        perHour: 20,
      },
      harmony: {
        perMinute: 8, // Slightly lower for complex calculations
        perHour: 80,
      },
      mixer: {
        perMinute: 8,
        perHour: 80,
      },
      comparison: {
        perMinute: 5, // Lower for image rendering
        perHour: 50,
      },
      accessibility: {
        perMinute: 5, // Lower for image rendering
        perHour: 50,
      },
      // match, dye, stats use default limits
    },
  },

  // Image Processing
  image: {
    maxSizeMB: parseInt(process.env.IMAGE_MAX_SIZE_MB || '8', 10),
    cacheTTL: parseInt(process.env.IMAGE_CACHE_TTL || '300', 10), // 5 minutes
  },

  // API
  api: {
    cacheTTL: parseInt(process.env.API_CACHE_TTL || '300', 10), // 5 minutes
    timeout: parseInt(process.env.API_TIMEOUT_MS || '5000', 10), // 5 seconds
  },

  // Community Presets API
  communityPresets: {
    apiUrl: process.env.PRESET_API_URL || 'https://presets-api.xivdyetools.workers.dev',
    apiSecret: process.env.PRESET_API_SECRET || '',
    moderatorIds: (process.env.MODERATOR_IDS || '')
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0),
    moderatorRoleIds: (process.env.MODERATOR_ROLE_IDS || '')
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0),
    moderationChannelId: process.env.MODERATION_CHANNEL_ID,
    submissionLogChannelId: process.env.SUBMISSION_LOG_CHANNEL_ID,
    ownerDiscordId: process.env.OWNER_DISCORD_ID,
    // Enable only if API URL and secret are configured
    enabled: !!(process.env.PRESET_API_URL && process.env.PRESET_API_SECRET),
  },

  // Internal Webhook (for web app notifications)
  internalWebhook: {
    secret: process.env.INTERNAL_WEBHOOK_SECRET || '',
    // Enable only if secret is configured
    enabled: !!process.env.INTERNAL_WEBHOOK_SECRET,
  },
};
