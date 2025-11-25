/**
 * /about command - Display bot information
 */

import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import type { BotCommand } from '../types/index.js';

export const aboutCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('about')
    .setDescription('Display information about this bot'),

  async execute(interaction: ChatInputCommandInteraction) {
    const embed = new EmbedBuilder()
      .setTitle('ℹ️ About XIV Dye Tools Discord Bot')
      .setDescription(
        'Powerful color analysis and dye matching tools for FFXIV, bringing the features of the XIV Dye Tools web application directly to Discord!'
      )
      .setColor(0x5865f2)
      .addFields([
        {
          name: '🤖 Bot Information',
          value:
            '**Version:** v1.0.2\\n' +
            '**Author:** Flash Galatine (Balmung)\\n' +
            '**License:** MIT',
          inline: false,
        },
        {
          name: '🌐 Links',
          value:
            '**Website:** [xivdyetools.projectgalatine.com](https://xivdyetools.projectgalatine.com)\\n' +
            '**Discord:** [discord.gg/5VUSKTZCe5](https://discord.gg/5VUSKTZCe5)\\n' +
            '**BlueSky:** [@projectgalatine.com](https://bsky.app/profile/projectgalatine.com)',
          inline: false,
        },
        {
          name: '❤️ Support',
          value:
            '**Patreon:** [patreon.com/ProjectGalatine](https://patreon.com/ProjectGalatine)\\n\\n' +
            'If you find this bot useful, please consider supporting development on Patreon!',
          inline: false,
        },
        {
          name: '📚 Getting Started',
          value:
            'Use `/manual` to see all available commands and how to use them.\\n' +
            'Use `/match_image_help` for tips on getting the best results from image matching.',
          inline: false,
        },
      ])
      .setThumbnail('https://xivdyetools.projectgalatine.com/favicon.svg')
      .setFooter({
        text: 'Made with ❤️ for FFXIV glamour enthusiasts',
      })
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
      flags: MessageFlags.Ephemeral,
    });
  },
};
