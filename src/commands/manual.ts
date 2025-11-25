/**
 * /manual command - Display command usage information
 */

import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import type { BotCommand } from '../types/index.js';

export const manualCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('manual')
    .setDescription('Display detailed information about all bot commands'),

  async execute(interaction: ChatInputCommandInteraction) {
    // Main overview embed
    const overviewEmbed = new EmbedBuilder()
      .setTitle('📚 XIV Dye Tools Bot - Command Manual')
      .setDescription(
        'Welcome to the **XIV Dye Tools Discord Bot**! This bot brings powerful color analysis and dye matching tools from the web app directly to Discord.\\n\\n' +
          'All commands support **autocomplete** for dye names and parameters. Start typing to see suggestions!'
      )
      .setColor(0x5865f2)
      .setTimestamp();

    // Color Tools Commands
    const colorToolsEmbed = new EmbedBuilder()
      .setTitle('🎨 Color Tools')
      .setColor(0x57f287)
      .addFields([
        {
          name: '/match',
          value:
            '**Find the closest FFXIV dye to a given color**\\n' +
            '• **Parameters:**\\n' +
            '  • `color` - Hex code (e.g., `#FF0000` or `FF0000`) or dye name\\n' +
            '• **Example:** `/match color:#8B4513` or `/match color:Dalamud Red`\\n' +
            '• Shows match quality, color distance, and acquisition info',
          inline: false,
        },
        {
          name: '/match_image',
          value:
            '**Extract dominant color from an image and find matching dye**\\n' +
            '• **Parameters:**\\n' +
            '  • `image` - Image file (PNG, JPG, GIF, BMP, WebP)\\n' +
            '• **Example:** `/match_image image:[attach file]`\\n' +
            '• Supports up to 8MB images\\n' +
            '• **Tip:** See `/match_image_help` for best practices!',
          inline: false,
        },
        {
          name: '/match_image_help',
          value:
            '**Get tips for using /match_image effectively**\\n' +
            '• Learn how image analysis works\\n' +
            '• Tips for best results (cropping, lighting, etc.)\\n' +
            '• Troubleshooting common issues',
          inline: false,
        },
        {
          name: '/harmony',
          value:
            '**Generate color harmony suggestions based on color theory**\\n' +
            '• **Parameters:**\\n' +
            '  • `base_color` - Hex code or dye name\\n' +
            '  • `harmony_type` - Complementary, Triadic, Split-complementary, etc.\\n' +
            '  • `companion_count` (optional) - Limit companions (1-3)\\n' +
            '• **Example:** `/harmony base_color:Dalamud Red harmony_type:triadic`\\n' +
            '• Shows color wheel visualization and companion dyes with deviance ratings',
          inline: false,
        },
        {
          name: '/mixer',
          value:
            '**Generate a color gradient between two colors**\\n' +
            '• **Parameters:**\\n' +
            '  • `start_color` - Hex code or dye name\\n' +
            '  • `end_color` - Hex code or dye name\\n' +
            '  • `steps` (optional) - Number of steps (2-10, default: 6)\\n' +
            '• **Example:** `/mixer start_color:Snow White end_color:Soot Black steps:8`\\n' +
            '• Shows gradient visualization with intermediate dyes',
          inline: false,
        },
      ]);

    // Dye Information Commands
    const dyeInfoEmbed = new EmbedBuilder()
      .setTitle('📖 Dye Information')
      .setColor(0xfee75c)
      .addFields([
        {
          name: '/dye',
          value:
            '**Dye lookup and information (has 4 subcommands)**\\n\\n' +
            '**`/dye info`** - Get detailed information about a specific dye\\n' +
            '  • `dye_name` - Name of the dye\\n' +
            '  • Shows color info, acquisition, and more\\n\\n' +
            '**`/dye search`** - Search for dyes by name\\n' +
            '  • `query` - Search term\\n' +
            '  • Returns matching dyes\\n\\n' +
            '**`/dye list`** - List all dyes in a category\\n' +
            '  • `category` - Reds, Blues, Greens, etc.\\n' +
            '  • Shows all dyes in that category\\n\\n' +
            '**`/dye random`** - Get random dye suggestions\\n' +
            '  • `count` (optional) - Number of dyes (1-5, default: 1)\\n' +
            '  • Great for inspiration!',
          inline: false,
        },
      ]);

    // Analysis Commands
    const analysisEmbed = new EmbedBuilder()
      .setTitle('🔬 Analysis Tools')
      .setColor(0xeb459e)
      .addFields([
        {
          name: '/comparison',
          value:
            '**Compare multiple dyes side-by-side**\\n' +
            '• **Parameters:**\\n' +
            '  • `dye1`, `dye2` (required) - Hex codes or dye names\\n' +
            '  • `dye3`, `dye4` (optional) - Additional dyes\\n' +
            '• **Example:** `/comparison dye1:Dalamud Red dye2:Rolanberry Red`\\n' +
            '• Shows comparison grid and pairwise color distances',
          inline: false,
        },
        {
          name: '/accessibility',
          value:
            '**Simulate how a dye appears with colorblindness**\\n' +
            '• **Parameters:**\\n' +
            '  • `dye` - Hex code or dye name\\n' +
            '  • `vision_type` - Protanopia, Deuteranopia, or Tritanopia\\n' +
            '• **Example:** `/accessibility dye:Dalamud Red vision_type:protanopia`\\n' +
            '• Shows original vs simulated color with alternative suggestions',
          inline: false,
        },
      ]);

    // Bot Information Commands
    const botInfoEmbed = new EmbedBuilder()
      .setTitle('ℹ️ Bot Information')
      .setColor(0x9b59b6)
      .addFields([
        {
          name: '/about',
          value:
            '**Display information about this bot**\\n' +
            '• Version, author, and social links\\n' +
            '• Website and support information',
          inline: false,
        },
        {
          name: '/manual',
          value:
            '**Display this manual (you are here!)**\\n' +
            '• Comprehensive command reference\\n' +
            '• Usage examples and tips',
          inline: false,
        },
        {
          name: '/stats',
          value:
            '**Bot usage statistics** *(restricted access)*\\n' +
            '• Command usage analytics\\n' +
            '• Error tracking and uptime',
          inline: false,
        },
      ]);

    // Footer embed with quick tips
    const footerEmbed = new EmbedBuilder()
      .setTitle('💡 Quick Tips')
      .setColor(0x3498db)
      .setDescription(
        '• **Autocomplete:** Start typing dye names to see suggestions\\n' +
          '• **Hex Colors:** Both `#FF0000` and `FF0000` formats work\\n' +
          '• **Dye Names:** Case-insensitive (e.g., "dalamud red" works)\\n' +
          '• **Category Exclusions:** Facewear dyes are automatically hidden from most searches\\n' +
          '• **Need Help?** Use `/match_image_help` for image matching tips'
      )
      .addFields([
        {
          name: '🌐 Website',
          value: '[xivdyetools.projectgalatine.com](https://xivdyetools.projectgalatine.com)',
          inline: true,
        },
        {
          name: '💬 Support',
          value: '[Discord Server](https://discord.gg/5VUSKTZCe5)',
          inline: true,
        },
        {
          name: '❤️ Support the Project',
          value: '[Patreon](https://patreon.com/ProjectGalatine)',
          inline: true,
        },
      ])
      .setFooter({
        text: 'Made with ❤️ for FFXIV glamour enthusiasts',
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
