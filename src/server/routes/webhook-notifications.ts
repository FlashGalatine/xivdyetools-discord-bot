/**
 * Webhook Notification Routes
 * Handles incoming notifications from the presets API worker
 * when presets are submitted from the web app.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { config } from '../../config.js';
import { logger } from '../../utils/logger.js';
import type { Client, TextChannel } from 'discord.js';
import { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import { DyeService, dyeDatabase } from 'xivdyetools-core';

// Initialize dye service
const dyeService = new DyeService(dyeDatabase);

/**
 * Notification payload for preset submissions
 */
interface PresetNotificationPayload {
  type: 'submission';
  preset: {
    id: string;
    name: string;
    description: string;
    category_id: string;
    dyes: number[];
    tags: string[];
    author_name: string;
    author_discord_id: string;
    status: 'pending' | 'approved' | 'rejected';
    moderation_status: 'clean' | 'flagged' | 'auto_approved';
    source: 'bot' | 'web';
    created_at: string;
  };
}

/**
 * Create webhook notification routes
 */
export function createWebhookRoutes(discordClient: Client): Router {
  const router = Router();

  // Middleware to verify webhook secret
  const verifySecret = (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;

    if (!config.internalWebhook.enabled) {
      res.status(503).json({ error: 'Internal webhook is disabled' });
      return;
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('Webhook request missing authorization header');
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const token = authHeader.slice(7);
    if (token !== config.internalWebhook.secret) {
      logger.warn('Webhook request with invalid secret');
      res.status(401).json({ error: 'Invalid secret' });
      return;
    }

    next();
  };

  /**
   * POST /internal/notify-submission
   * Handle preset submission notifications from the web app
   */
  router.post('/internal/notify-submission', verifySecret, async (req: Request, res: Response) => {
    try {
      const payload = req.body as PresetNotificationPayload;

      if (payload.type !== 'submission') {
        res.status(400).json({ error: 'Invalid notification type' });
        return;
      }

      const { preset } = payload;

      // Determine which channel to notify based on moderation status
      let channelId: string | undefined;
      if (preset.status === 'pending') {
        // Pending presets go to moderation channel
        channelId = config.communityPresets.moderationChannelId;
      } else {
        // Approved/rejected go to submission log channel
        channelId = config.communityPresets.submissionLogChannelId;
      }

      if (!channelId) {
        logger.warn('No channel configured for preset notifications');
        res.status(200).json({ success: true, message: 'No channel configured' });
        return;
      }

      // Get the channel
      const channel = await discordClient.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) {
        logger.error(`Channel ${channelId} not found or not a text channel`);
        res.status(500).json({ error: 'Channel not found' });
        return;
      }

      // Build the embed
      const embed = buildPresetEmbed(preset);

      // Build action buttons for pending presets
      const components: ActionRowBuilder<ButtonBuilder>[] = [];
      if (preset.status === 'pending') {
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`preset_approve:${preset.id}`)
            .setLabel('Approve')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅'),
          new ButtonBuilder()
            .setCustomId(`preset_reject:${preset.id}`)
            .setLabel('Reject')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('❌'),
          new ButtonBuilder()
            .setCustomId(`preset_view:${preset.id}`)
            .setLabel('View Details')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🔍')
        );
        components.push(row);
      }

      // Send notification
      await (channel as TextChannel).send({
        embeds: [embed],
        components,
      });

      logger.info(`Sent preset notification for ${preset.name} (${preset.id})`);
      res.status(200).json({ success: true });
    } catch (error) {
      logger.error('Error handling preset notification:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}

/**
 * Build an embed for a preset notification
 */
function buildPresetEmbed(preset: PresetNotificationPayload['preset']): EmbedBuilder {
  // Get dye names
  const dyeNames = preset.dyes.map((dyeId) => {
    const dye = dyeService.getDyeById(dyeId);
    return dye?.name || `Unknown (${dyeId})`;
  });

  // Get dye hex colors for the swatch display
  const dyeColors = preset.dyes.map((dyeId) => {
    const dye = dyeService.getDyeById(dyeId);
    return dye?.hex || '#808080';
  });

  // Status emoji and color
  const statusInfo: Record<string, { emoji: string; color: number }> = {
    pending: { emoji: '🟡', color: 0xffc107 },
    approved: { emoji: '🟢', color: 0x28a745 },
    rejected: { emoji: '🔴', color: 0xdc3545 },
  };

  const { emoji, color } = statusInfo[preset.status] || statusInfo.pending;

  // Source badge
  const sourceBadge = preset.source === 'web' ? '🌐 Web App' : '🤖 Discord Bot';

  // Moderation status info
  const moderationInfo = getModerationInfo(preset.moderation_status);

  // Create swatch display string (text representation)
  const swatchDisplay = dyeColors.map((hex) => `\`${hex}\``).join(' ');

  const embed = new EmbedBuilder()
    .setTitle(`${emoji} Preset Submission: ${preset.name}`)
    .setColor(color)
    .setDescription(preset.description)
    .addFields(
      { name: 'Category', value: formatCategory(preset.category_id), inline: true },
      { name: 'Source', value: sourceBadge, inline: true },
      { name: 'Status', value: `${emoji} ${capitalize(preset.status)}`, inline: true },
      { name: 'Dyes', value: dyeNames.join('\n'), inline: false },
      { name: 'Colors', value: swatchDisplay, inline: false },
      {
        name: 'Author',
        value: `${preset.author_name}\n<@${preset.author_discord_id}>`,
        inline: true,
      },
      { name: 'Moderation', value: moderationInfo, inline: true }
    )
    .setFooter({ text: `ID: ${preset.id}` })
    .setTimestamp(new Date(preset.created_at));

  // Add tags if present
  if (preset.tags && preset.tags.length > 0) {
    embed.addFields({
      name: 'Tags',
      value: preset.tags.map((t) => `\`${t}\``).join(' '),
      inline: false,
    });
  }

  return embed;
}

/**
 * Get moderation status display info
 */
function getModerationInfo(status: string): string {
  switch (status) {
    case 'clean':
      return '✅ Passed all checks';
    case 'flagged':
      return '⚠️ Flagged for review';
    case 'auto_approved':
      return '✨ Auto-approved';
    default:
      return 'Unknown';
  }
}

/**
 * Format category ID to display name
 */
function formatCategory(categoryId: string): string {
  const categories: Record<string, string> = {
    jobs: '⚔️ Jobs',
    'grand-companies': '🏰 Grand Companies',
    seasons: '🌸 Seasons',
    events: '🎉 Events',
    aesthetics: '🎨 Aesthetics',
    community: '👥 Community',
  };
  return categories[categoryId] || categoryId;
}

/**
 * Capitalize first letter
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
