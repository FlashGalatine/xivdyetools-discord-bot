/**
 * /match_image_help command - Provide tips and tricks for using /match_image
 */

import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import { config } from '../config.js';
import { t } from '../services/i18n-service.js';
import type { BotCommand } from '../types/index.js';

export const matchImageHelpCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('match_image_help')
    .setDescription('Get tips and tricks for using the /match_image command')
    .setDescriptionLocalizations({
      ja: '/match_image コマンドの使い方のヒントとコツ',
      de: 'Tipps und Tricks für die Verwendung des /match_image-Befehls',
      fr: 'Obtenir des astuces pour utiliser la commande /match_image',
    }),

  async execute(interaction: ChatInputCommandInteraction) {
    // Create main help embed
    const mainEmbed = new EmbedBuilder()
      .setTitle(`🎨 ${t('matchImageHelp.title')}`)
      .setDescription(t('matchImageHelp.description'))
      .setColor(0x5865f2)
      .addFields([
        {
          name: `🔍 ${t('matchImageHelp.howItWorks')}`,
          value: t('matchImageHelp.howItWorksContent'),
          inline: false,
        },
        {
          name: `✅ ${t('matchImageHelp.tipsForBestResults')}`,
          value: t('matchImageHelp.tipsContent'),
          inline: false,
        },
        {
          name: `❌ ${t('matchImageHelp.commonIssues')}`,
          value: t('matchImageHelp.commonIssuesContent'),
          inline: false,
        },
        {
          name: `💡 ${t('matchImageHelp.proTips')}`,
          value: t('matchImageHelp.proTipsContent'),
          inline: false,
        },
      ])
      .setFooter({
        text: t('matchImageHelp.footer'),
      })
      .setTimestamp();

    // Create examples embed
    const examplesEmbed = new EmbedBuilder()
      .setTitle(`📸 ${t('matchImageHelp.exampleUseCases')}`)
      .setColor(0x57f287)
      .addFields([
        {
          name: `✨ ${t('matchImageHelp.goodExamples')}`,
          value: t('matchImageHelp.goodExamplesContent'),
          inline: true,
        },
        {
          name: `⚠️ ${t('matchImageHelp.poorExamples')}`,
          value: t('matchImageHelp.poorExamplesContent'),
          inline: true,
        },
      ])
      .addFields([
        {
          name: `🎯 ${t('matchImageHelp.whenToUse')}`,
          value: t('matchImageHelp.whenToUseContent'),
          inline: false,
        },
      ]);

    // Create technical details embed
    const maxSize = config.image?.maxSizeMB || 8;
    const technicalEmbed = new EmbedBuilder()
      .setTitle(`⚙️ ${t('matchImageHelp.technicalDetails')}`)
      .setColor(0xfee75c)
      .addFields([
        {
          name: t('matchImageHelp.supportedFormats'),
          value: t('matchImageHelp.supportedFormatsContent'),
          inline: true,
        },
        {
          name: t('matchImageHelp.fileLimits'),
          value: t('matchImageHelp.fileLimitsContent', { maxSize: String(maxSize) }),
          inline: true,
        },
        {
          name: t('matchImageHelp.matchQualityRatings'),
          value: t('matchImageHelp.matchQualityRatingsContent'),
          inline: false,
        },
      ])
      .setFooter({
        text: t('matchImageHelp.poweredBy'),
      });

    // Send as ephemeral (private) message
    await interaction.reply({
      embeds: [mainEmbed, examplesEmbed, technicalEmbed],
      flags: MessageFlags.Ephemeral, // Only visible to the user
    });
  },
};
