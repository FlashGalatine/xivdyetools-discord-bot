/**
 * /manual command - Display command usage information
 */

import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import { t } from '../services/i18n-service.js';
import type { BotCommand } from '../types/index.js';

export const manualCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('manual')
    .setDescription('Display detailed information about all bot commands')
    .setDescriptionLocalizations({
      ja: 'すべてのボットコマンドの詳細情報を表示',
      de: 'Detaillierte Informationen zu allen Bot-Befehlen anzeigen',
      fr: 'Afficher des informations détaillées sur toutes les commandes du bot',
    }),

  async execute(interaction: ChatInputCommandInteraction) {
    // Main overview embed
    const overviewEmbed = new EmbedBuilder()
      .setTitle(`📚 ${t('manual.title')}`)
      .setDescription(t('manual.welcome'))
      .setColor(0x5865f2)
      .setTimestamp();

    // Color Tools Commands
    const colorToolsEmbed = new EmbedBuilder()
      .setTitle(`🎨 ${t('manual.colorTools')}`)
      .setColor(0x57f287)
      .addFields([
        {
          name: t('manual.commands.match.title'),
          value: t('manual.commands.match.description'),
          inline: false,
        },
        {
          name: t('manual.commands.matchImage.title'),
          value: t('manual.commands.matchImage.description'),
          inline: false,
        },
        {
          name: t('manual.commands.matchImageHelp.title'),
          value: t('manual.commands.matchImageHelp.description'),
          inline: false,
        },
        {
          name: t('manual.commands.harmony.title'),
          value: t('manual.commands.harmony.description'),
          inline: false,
        },
        {
          name: t('manual.commands.mixer.title'),
          value: t('manual.commands.mixer.description'),
          inline: false,
        },
      ]);

    // Dye Information Commands
    const dyeInfoEmbed = new EmbedBuilder()
      .setTitle(`📖 ${t('manual.dyeInformation')}`)
      .setColor(0xfee75c)
      .addFields([
        {
          name: t('manual.commands.dye.title'),
          value: t('manual.commands.dye.description'),
          inline: false,
        },
      ]);

    // Analysis Commands
    const analysisEmbed = new EmbedBuilder()
      .setTitle(`🔬 ${t('manual.analysisTools')}`)
      .setColor(0xeb459e)
      .addFields([
        {
          name: t('manual.commands.comparison.title'),
          value: t('manual.commands.comparison.description'),
          inline: false,
        },
        {
          name: t('manual.commands.accessibility.title'),
          value: t('manual.commands.accessibility.description'),
          inline: false,
        },
      ]);

    // Bot Information Commands
    const botInfoEmbed = new EmbedBuilder()
      .setTitle(`ℹ️ ${t('manual.botInformation')}`)
      .setColor(0x9b59b6)
      .addFields([
        {
          name: t('manual.commands.about.title'),
          value: t('manual.commands.about.description'),
          inline: false,
        },
        {
          name: t('manual.commands.manual.title'),
          value: t('manual.commands.manual.description'),
          inline: false,
        },
        {
          name: t('manual.commands.stats.title'),
          value: t('manual.commands.stats.description'),
          inline: false,
        },
      ]);

    // Footer embed with quick tips
    const footerEmbed = new EmbedBuilder()
      .setTitle(`💡 ${t('manual.quickTips')}`)
      .setColor(0x3498db)
      .setDescription(
        [
          t('manual.tips.autocomplete'),
          t('manual.tips.hexColors'),
          t('manual.tips.dyeNames'),
          t('manual.tips.categoryExclusions'),
          t('manual.tips.needHelp'),
        ].join('\n')
      )
      .addFields([
        {
          name: `🌐 ${t('manual.website')}`,
          value: '[xivdyetools.projectgalatine.com](https://xivdyetools.projectgalatine.com)',
          inline: true,
        },
        {
          name: `💬 ${t('manual.support')}`,
          value: '[Discord Server](https://discord.gg/5VUSKTZCe5)',
          inline: true,
        },
        {
          name: `❤️ ${t('manual.supportProject')}`,
          value: '[Patreon](https://patreon.com/ProjectGalatine)',
          inline: true,
        },
      ])
      .setFooter({
        text: t('manual.footer'),
      });

    // Send all embeds as ephemeral message
    await interaction.reply({
      embeds: [
        overviewEmbed,
        colorToolsEmbed,
        dyeInfoEmbed,
        analysisEmbed,
        botInfoEmbed,
        footerEmbed,
      ],
      flags: MessageFlags.Ephemeral,
    });
  },
};
