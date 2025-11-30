/**
 * Base command class for Discord bot commands
 *
 * Provides standardized error handling, logging, and response formatting
 * for all Discord bot commands. Uses the template method pattern to
 * ensure consistent command execution flow.
 *
 * Per R-2: Standardized command structure with error handling
 *
 * @example
 * ```typescript
 * class MyCommand extends CommandBase {
 *   readonly data = new SlashCommandBuilder()
 *     .setName('mycommand')
 *     .setDescription('My command description');
 *
 *   protected async executeCommand(interaction: ChatInputCommandInteraction): Promise<void> {
 *     // Command logic here
 *     // Use sendPublicSuccess() for success responses (public)
 *     await sendPublicSuccess(interaction, { content: 'Success!' });
 *   }
 * }
 * ```
 */

import { ChatInputCommandInteraction, AutocompleteInteraction, EmbedBuilder } from 'discord.js';
import { createErrorEmbed } from '../../utils/embed-builder.js';
import { logger } from '../../utils/logger.js';
import { sendEphemeralError } from '../../utils/response-helper.js';
import {
  isBotError,
  getUserFriendlyMessage,
  getErrorTitle,
  RateLimitError,
} from '../../errors/index.js';
import type { BotCommand } from '../../types/index.js';

/**
 * Base class for all Discord bot commands
 * Provides standardized error handling, logging, and response formatting
 * Per R-2: Template method pattern for consistent command execution
 */
export abstract class CommandBase implements BotCommand {
  /**
   * Command data (SlashCommandBuilder)
   */
  abstract readonly data: BotCommand['data'];

  /**
   * Execute the command
   * Template method that handles common error handling and logging
   */
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const startTime = Date.now();
    const commandName = this.data.name;
    const userId = interaction.user.id;
    const guildId = interaction.guildId || undefined;

    try {
      logger.debug(`Executing command: ${commandName} (user: ${userId}, guild: ${guildId})`);

      // Defer reply if not already deferred
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply();
      }

      // Execute the actual command logic
      await this.executeCommand(interaction);

      const duration = Date.now() - startTime;
      logger.info(`Command ${commandName} completed in ${duration}ms (user: ${userId})`);
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Command ${commandName} failed after ${duration}ms:`, error);

      await this.handleError(interaction, error, commandName);
    }
  }

  /**
   * Execute the actual command logic (to be implemented by subclasses)
   * Per R-2: Template method - subclasses implement this
   */
  protected abstract executeCommand(interaction: ChatInputCommandInteraction): Promise<void>;

  /**
   * Handle autocomplete requests (optional)
   * Per R-2: Default implementation returns empty array
   */
  async autocomplete?(interaction: AutocompleteInteraction): Promise<void> {
    // Default: no autocomplete
    await interaction.respond([]);
  }

  /**
   * Handle errors with standardized error messages
   * Per R-2: Centralized error handling using typed BotError classes
   */
  protected async handleError(
    interaction: ChatInputCommandInteraction,
    error: unknown,
    commandName: string
  ): Promise<void> {
    // Log the error with appropriate detail level
    if (isBotError(error)) {
      logger.error(`Error in ${commandName} [${error.code}]:`, {
        message: error.message,
        statusCode: error.statusCode,
        cause: error.cause,
      });

      // Log retry info for rate limits
      if (error instanceof RateLimitError && error.retryAfterSeconds) {
        logger.info(`Rate limit retry after: ${error.retryAfterSeconds}s`);
      }
    } else if (error instanceof Error) {
      logger.error(`Error in ${commandName}:`, {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
    } else {
      logger.error(`Unknown error in ${commandName}:`, error);
    }

    // Get user-friendly error message and title using error utilities
    const errorTitle = getErrorTitle(error);
    const errorMessage = getUserFriendlyMessage(error);

    const errorEmbed = createErrorEmbed(errorTitle, errorMessage);

    try {
      await sendEphemeralError(interaction, { embeds: [errorEmbed] });
    } catch (replyError) {
      // If we can't even send the error message, log it
      logger.error('Failed to send error message to user:', replyError);
    }
  }

  /**
   * Validate command input (to be overridden by subclasses if needed)
   * Per R-2: Input validation hook
   */
  protected validateInput(_interaction: ChatInputCommandInteraction): {
    valid: boolean;
    error?: string;
  } {
    // Default: always valid (subclasses can override)
    return { valid: true };
  }

  /**
   * Create a success embed (helper method)
   * Per R-2: Standardized response formatting
   */
  protected createSuccessEmbed(title: string, description: string): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle(`✅ ${title}`)
      .setDescription(description)
      .setColor(0x00ff00)
      .setTimestamp();
  }

  /**
   * Create an info embed (helper method)
   * Per R-2: Standardized response formatting
   */
  protected createInfoEmbed(title: string, description: string): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle(`ℹ️ ${title}`)
      .setDescription(description)
      .setColor(0x0099ff)
      .setTimestamp();
  }
}
