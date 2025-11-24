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
}

/**
 * Validate required environment variables
 */
function validateEnv(): void {
  const required = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
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
};

