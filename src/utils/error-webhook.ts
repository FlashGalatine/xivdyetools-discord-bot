/**
 * Error webhook notification utility
 * Sends error notifications to Discord webhook
 */

import { WebhookClient, EmbedBuilder } from 'discord.js';
import { logger } from './logger.js';

let errorWebhook: WebhookClient | null = null;

/**
 * Initialize error webhook from environment variable
 */
export function initErrorWebhook(webhookUrl?: string): void {
  if (webhookUrl) {
    try {
      errorWebhook = new WebhookClient({ url: webhookUrl });
      logger.info('Error webhook initialized');
    } catch (error) {
      logger.warn('Failed to initialize error webhook:', error);
    }
  } else {
    logger.info('Error webhook not configured (ERROR_WEBHOOK_URL not set)');
  }
}

/**
 * Send error notification to Discord webhook
 */
export async function notifyError(error: Error, context: string): Promise<void> {
  if (!errorWebhook) {
    return; // Webhook not configured, skip notification
  }

  try {
    const embed = new EmbedBuilder()
      .setTitle('🚨 Bot Error')
      .setDescription(error.message || 'Unknown error')
      .addFields([
        { name: 'Context', value: context, inline: false },
        { 
          name: 'Error Type', 
          value: error.name || 'Error', 
          inline: true 
        },
        { 
          name: 'Timestamp', 
          value: new Date().toISOString(), 
          inline: true 
        }
      ])
      .setColor(0xFF0000); // Red

    // Add stack trace if available (truncate to avoid Discord limits)
    if (error.stack) {
      const stackTrace = error.stack.slice(0, 1000);
      embed.addFields([
        { 
          name: 'Stack Trace', 
          value: `\`\`\`\n${stackTrace}\n\`\`\``, 
          inline: false 
        }
      ]);
    }

    await errorWebhook.send({
      embeds: [embed],
    });
  } catch (webhookError) {
    // Don't let webhook errors crash the bot
    logger.error('Failed to send error webhook:', webhookError);
  }
}

/**
 * Close error webhook connection
 */
export function closeErrorWebhook(): void {
  if (errorWebhook) {
    errorWebhook.destroy();
    errorWebhook = null;
  }
}
