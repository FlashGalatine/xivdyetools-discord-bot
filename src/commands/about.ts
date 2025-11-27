/**
 * /about command - Display bot information
 */

import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import { t } from '../services/i18n-service.js';
import type { BotCommand } from '../types/index.js';

export const aboutCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('about')
    .setDescription('Display information about this bot')
    .setDescriptionLocalizations({
      ja: 'このボットについての情報を表示',
      de: 'Informationen über diesen Bot anzeigen',
      fr: 'Afficher des informations sur ce bot',
    }),

  async execute(interaction: ChatInputCommandInteraction) {
    const embed = new EmbedBuilder()
      .setTitle(`ℹ️ ${t('about.title')}`)
      .setDescription(t('about.description'))
      .setColor(0x5865f2)
      .addFields([
        {
          name: `🤖 ${t('about.botInformation')}`,
          value:
            `**${t('about.version')}:** v1.0.2\n` +
            `**${t('about.author')}:** Flash Galatine (Balmung)\n` +
            `**${t('about.license')}:** MIT`,
          inline: false,
        },
        {
          name: `🌐 ${t('about.links')}`,
          value:
            `**${t('about.website')}:** [xivdyetools.projectgalatine.com](https://xivdyetools.projectgalatine.com)\n` +
            `**${t('about.discord')}:** [discord.gg/5VUSKTZCe5](https://discord.gg/5VUSKTZCe5)\n` +
            `**${t('about.bluesky')}:** [@projectgalatine.com](https://bsky.app/profile/projectgalatine.com)`,
          inline: false,
        },
        {
          name: `❤️ ${t('about.support')}`,
          value:
            `**${t('about.patreon')}:** [patreon.com/ProjectGalatine](https://patreon.com/ProjectGalatine)\n\n` +
            t('about.supportMessage'),
          inline: false,
        },
        {
          name: `📚 ${t('about.gettingStarted')}`,
          value: t('about.gettingStartedMessage'),
          inline: false,
        },
      ])
      .setThumbnail('https://xivdyetools.projectgalatine.com/favicon.svg')
      .setFooter({
        text: t('about.footer'),
      })
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
      flags: MessageFlags.Ephemeral,
    });
  },
};
