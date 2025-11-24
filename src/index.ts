/**
 * XIV Dye Tools Discord Bot
 * Main entry point
 */

import { Client, GatewayIntentBits, Events, Collection } from 'discord.js';
import express from 'express';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import { harmonyCommand } from './commands/harmony.js';
import { matchCommand } from './commands/match.js';
import { mixerCommand } from './commands/mixer.js';
import { dyeCommand } from './commands/dye.js';
import { matchImageCommand } from './commands/match-image.js';
import { comparisonCommand } from './commands/comparison.js';
import { accessibilityCommand } from './commands/accessibility.js';
import { statsCommand } from './commands/stats.js';
import { getRateLimiter } from './services/rate-limiter.js';
import { getAnalytics } from './services/analytics.js';
import { closeRedis } from './services/redis.js';
import { initErrorWebhook, notifyError, closeErrorWebhook } from './utils/error-webhook.js';
import type { BotClient, BotCommand } from './types/index.js';

// Initialize error webhook
initErrorWebhook(config.errorWebhookUrl);

// Create Express server for health checks
const app = express();
const startTime = Date.now();

app.get('/health', (req, res) => {
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

  res.json({
    status: 'healthy',
    uptime: uptimeSeconds,
    timestamp: new Date().toISOString(),
    guilds: client.guilds?.cache.size || 0,
    users: client.users?.cache.size || 0,
    commands: client.commands?.size || 0,
  });
});

const server = app.listen(config.port, () => {
  logger.info(`Health check endpoint running on port ${config.port}`);
});

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ],
}) as BotClient;

// Initialize commands collection
client.commands = new Collection<string, BotCommand>();

// Register commands
client.commands.set(harmonyCommand.data.name, harmonyCommand);
client.commands.set(matchCommand.data.name, matchCommand);
client.commands.set(mixerCommand.data.name, mixerCommand);
client.commands.set(dyeCommand.data.name, dyeCommand);
client.commands.set(matchImageCommand.data.name, matchImageCommand);
client.commands.set(comparisonCommand.data.name, comparisonCommand);
client.commands.set(accessibilityCommand.data.name, accessibilityCommand);
client.commands.set(statsCommand.data.name, statsCommand);

// Bot ready event
client.once(Events.ClientReady, (readyClient) => {
  logger.info(`Discord bot ready! Logged in as ${readyClient.user.tag}`);
  logger.info(`Serving ${readyClient.guilds.cache.size} guild(s)`);
  logger.info(`Loaded ${client.commands.size} command(s)`);
});

// Interaction handler
client.on(Events.InteractionCreate, async (interaction) => {
  // Handle autocomplete
  if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName);

    if (!command || !command.autocomplete) {
      return;
    }

    try {
      await command.autocomplete(interaction);
    } catch (error) {
      logger.error(`Error in autocomplete for ${interaction.commandName}:`, error);
    }
    return;
  }

  // Handle slash commands
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    logger.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  const rateLimiter = getRateLimiter();
  const analytics = getAnalytics();
  const userId = interaction.user.id;
  const guildId = interaction.guildId || undefined;

  try {
    // Check rate limits
    const [userLimit, userHourlyLimit, globalLimit] = await Promise.all([
      rateLimiter.checkUserLimit(userId),
      rateLimiter.checkUserHourlyLimit(userId),
      rateLimiter.checkGlobalLimit(),
    ]);

    // Check if any rate limit is exceeded
    if (!userLimit.allowed) {
      logger.warn(`User ${userId} rate limited (per-minute)`);
      await interaction.reply({
        content: `⏱️ You're sending commands too quickly! Please wait ${userLimit.retryAfter} seconds.\n\n` +
          `**Limit:** ${userLimit.limit} commands per minute\n` +
          `**Try again:** <t:${Math.floor(userLimit.resetAt.getTime() / 1000)}:R>`,
        ephemeral: true,
      });

      await analytics.trackCommand({
        commandName: interaction.commandName,
        userId,
        guildId,
        timestamp: Date.now(),
        success: false,
        errorType: 'rate_limit_per_minute',
      });

      return;
    }

    if (!userHourlyLimit.allowed) {
      logger.warn(`User ${userId} rate limited (hourly)`);
      await interaction.reply({
        content: `⏱️ You've reached your hourly command limit! Please wait ${Math.ceil(userHourlyLimit.retryAfter! / 60)} minutes.\n\n` +
          `**Limit:** ${userHourlyLimit.limit} commands per hour\n` +
          `**Try again:** <t:${Math.floor(userHourlyLimit.resetAt.getTime() / 1000)}:R>`,
        ephemeral: true,
      });

      await analytics.trackCommand({
        commandName: interaction.commandName,
        userId,
        guildId,
        timestamp: Date.now(),
        success: false,
        errorType: 'rate_limit_hourly',
      });

      return;
    }

    if (!globalLimit.allowed) {
      logger.warn('Global rate limit exceeded');
      await interaction.reply({
        content: '⏱️ The bot is currently experiencing high load. Please try again in a moment.',
        ephemeral: true,
      });

      await analytics.trackCommand({
        commandName: interaction.commandName,
        userId,
        guildId,
        timestamp: Date.now(),
        success: false,
        errorType: 'rate_limit_global',
      });

      return;
    }

    // Execute command
    logger.debug(`Executing command: ${interaction.commandName}`);
    await command.execute(interaction);

    // Track successful execution
    await analytics.trackCommand({
      commandName: interaction.commandName,
      userId,
      guildId,
      timestamp: Date.now(),
      success: true,
    });

  } catch (error) {
    logger.error(`Error executing ${interaction.commandName}:`, error);

    const errorMessage = {
      content: '❌ There was an error executing this command!',
      ephemeral: true,
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage);
    } else {
      await interaction.reply(errorMessage);
    }

    // Track failed execution
    await analytics.trackCommand({
      commandName: interaction.commandName,
      userId,
      guildId,
      timestamp: Date.now(),
      success: false,
      errorType: error instanceof Error ? error.name : 'unknown_error',
    });
  }
});

// Error handlers
process.on('unhandledRejection', async (error) => {
  logger.error('Unhandled promise rejection:', error);
  if (error instanceof Error) {
    await notifyError(error, 'Unhandled Promise Rejection');
  }
});

process.on('uncaughtException', async (error) => {
  logger.error('Uncaught exception:', error);
  await notifyError(error, 'Uncaught Exception');
  process.exit(1);
});

// Login to Discord
logger.info('Starting bot...');
client.login(config.token);

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down gracefully...');
  server.close();
  closeErrorWebhook();
  await closeRedis();
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down gracefully...');
  server.close();
  closeErrorWebhook();
  await closeRedis();
  client.destroy();
  process.exit(0);
});
