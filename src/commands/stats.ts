/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access */
/**
 * /stats command - Display bot usage analytics
 */

import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { getAnalytics } from '../services/analytics.js';
import { sendPublicSuccess, sendEphemeralError } from '../utils/response-helper.js';
import { t } from '../services/i18n-service.js';
import type { BotCommand } from '../types/index.js';

export const statsCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Display bot usage statistics')
    .setDescriptionLocalizations({
      ja: 'ボット使用統計を表示',
      de: 'Bot-Nutzungsstatistiken anzeigen',
      fr: "Afficher les statistiques d'utilisation du bot",
    }),

  async execute(interaction: ChatInputCommandInteraction) {
    // Restrict to specific user
    if (interaction.user.id !== '110457699291906048') {
      await interaction.reply({
        content: `⛔ ${t('errors.noPermission')}`,
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    try {
      const analytics = getAnalytics();
      const stats = await analytics.getStats();

      // Get top 5 most used commands
      const commandEntries = Object.entries(stats.commandBreakdown)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);

      const topCommands =
        commandEntries.length > 0
          ? commandEntries
              .map(([cmd, count], index) => `${index + 1}. \`/${cmd}\` - ${count} uses`)
              .join('\n')
          : 'No commands executed yet';

      // Recent errors (last 5)
      const recentErrors = stats.recentErrors.slice(0, 5);
      const errorList =
        recentErrors.length > 0
          ? recentErrors.map((err, index) => `${index + 1}. ${err}`).join('\n')
          : 'No recent errors';

      // Calculate bot uptime
      const uptime = process.uptime();
      const days = Math.floor(uptime / 86400);
      const hours = Math.floor((uptime % 86400) / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      const uptimeStr = `${days}d ${hours}h ${minutes}m`;

      // Get guild count
      const guildCount = interaction.client.guilds.cache.size;
      const botClient = interaction.client as any;
      const commandCount = botClient.commands?.size || 0;

      // Build embed
      const embed = new EmbedBuilder()
        .setTitle(`📊 ${t('embeds.botStatistics')}`)
        .setColor(0x5865f2)
        .addFields([
          {
            name: `📈 ${t('embeds.usage')}`,
            value: [
              `**${t('embeds.totalCommands')}**: ${stats.totalCommands.toLocaleString()}`,
              `**${t('embeds.uniqueUsers')}**: ${stats.uniqueUsers.toLocaleString()}`,
              `**${t('embeds.successRate')}**: ${stats.successRate.toFixed(1)}%`,
            ].join('\n'),
            inline: true,
          },
          {
            name: `🤖 ${t('embeds.botInfo')}`,
            value: [
              `**${t('embeds.servers')}**: ${guildCount}`,
              `**${t('embeds.uptime')}**: ${uptimeStr}`,
              `**${t('embeds.commands')}**: ${commandCount}`,
            ].join('\n'),
            inline: true,
          },
          {
            name: `⭐ ${t('embeds.topCommands')}`,
            value: topCommands,
            inline: false,
          },
        ])
        .setTimestamp();

      // Add recent errors if any
      if (recentErrors.length > 0) {
        embed.addFields([
          {
            name: `⚠️ ${t('embeds.recentErrors')}`,
            value: errorList,
            inline: false,
          },
        ]);
      }

      await sendPublicSuccess(interaction, { embeds: [embed] });
    } catch (error) {
      console.error('Error in stats command:', error);
      await sendEphemeralError(interaction, {
        content: `❌ ${t('errors.failedToRetrieveStats')}`,
      });
    }
  },
};
