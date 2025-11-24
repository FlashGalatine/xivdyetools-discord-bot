/**
 * Base command class for Discord bot commands
 * Per R-2: Standardized command structure with error handling
 */

import { ChatInputCommandInteraction, AutocompleteInteraction, EmbedBuilder } from 'discord.js';
import { createErrorEmbed } from '../../utils/embed-builder.js';
import { logger } from '../../utils/logger.js';
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
   * Per R-2: Centralized error handling
   */
  protected async handleError(
    interaction: ChatInputCommandInteraction,
    error: unknown,
    commandName: string
  ): Promise<void> {
    let errorMessage = 'An unexpected error occurred while executing this command.';
    let errorTitle = 'Command Error';

    if (error instanceof Error) {
      // Log the full error for debugging
      logger.error(`Error in ${commandName}:`, {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });

      // Provide user-friendly error messages
      if (error.message.includes('rate limit')) {
        errorTitle = 'Rate Limit Exceeded';
        errorMessage = "You're sending commands too quickly. Please wait a moment and try again.";
      } else if (error.message.includes('permission') || error.message.includes('Missing')) {
        errorTitle = 'Permission Denied';
        errorMessage = "You don't have permission to use this command.";
      } else if (error.message.includes('timeout')) {
        errorTitle = 'Request Timeout';
        errorMessage = 'The request took too long to process. Please try again.';
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorTitle = 'Network Error';
        errorMessage = 'Failed to connect to external services. Please try again later.';
      } else {
        // Generic error - don't expose internal details
        errorMessage =
          'Something went wrong. Please try again or contact support if the issue persists.';
      }
    }

    const errorEmbed = createErrorEmbed(errorTitle, errorMessage);

    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ embeds: [errorEmbed] });
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }
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
