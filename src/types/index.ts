/**
 * XIV Dye Tools Discord Bot - Type Definitions
 */

import type { Client, CommandInteraction, SlashCommandBuilder } from 'discord.js';

/**
 * Discord command structure
 */
export interface BotCommand {
  data: SlashCommandBuilder;
  execute: (interaction: CommandInteraction) => Promise<void>;
}

/**
 * Extended Discord client with commands collection
 */
export interface BotClient extends Client {
  commands: Map<string, BotCommand>;
}

/**
 * Rate limit tracking
 */
export interface RateLimitData {
  count: number;
  resetAt: number;
}

/**
 * Render options for images
 */
export interface RenderOptions {
  width: number;
  height: number;
  backgroundColor?: string;
  quality?: number;
}

/**
 * Color wheel render options
 */
export interface ColorWheelOptions extends RenderOptions {
  baseColor: string;
  harmonyType: 'triadic' | 'complementary' | 'analogous' | 'split-complementary' | 'monochromatic';
  showLabels?: boolean;
}

/**
 * Gradient render options
 */
export interface GradientOptions extends RenderOptions {
  startColor: string;
  endColor: string;
  steps: number;
  showLabels?: boolean;
}

/**
 * Swatch grid render options
 */
export interface SwatchGridOptions extends RenderOptions {
  dyeId: number;
  showNormal?: boolean;
  showProtanopia?: boolean;
  showDeuteranopia?: boolean;
  showTritanopia?: boolean;
}

/**
 * Comparison chart render options
 */
export interface ComparisonChartOptions extends RenderOptions {
  dyeIds: number[];
  chartType: 'hsv' | 'rgb';
}

/**
 * Cache entry
 */
export interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

/**
 * Bot configuration
 */
export interface BotConfig {
  token: string;
  clientId: string;
  guildId?: string;
  redisUrl: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  rateLimit: {
    commandsPerMinute: number;
    commandsPerHour: number;
  };
  image: {
    maxSizeMB: number;
    cacheTTL: number;
  };
  api: {
    cacheTTL: number;
    timeout: number;
  };
}
