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
import type { BotCommand } from '../types/index.js';

export const matchImageHelpCommand: BotCommand = {
    data: new SlashCommandBuilder()
        .setName('match_image_help')
        .setDescription('Get tips and tricks for using the /match_image command'),

    async execute(interaction: ChatInputCommandInteraction) {
        // Create main help embed
        const mainEmbed = new EmbedBuilder()
            .setTitle('🎨 How to Use /match_image')
            .setDescription(
                'The `/match_image` command analyzes your uploaded image to find the dominant color and matches it to the closest FFXIV dye. ' +
                'Here are some tips to get the best results!'
            )
            .setColor(0x5865f2)
            .addFields([
                {
                    name: '🔍 How It Works',
                    value:
                        '**1. Image Analysis**\n' +
                        '• The entire image is resized to 256×256 pixels\n' +
                        '• A 4096-bin 3D color histogram is created\n' +
                        '• The most frequently occurring color is extracted\n\n' +
                        '**2. Dye Matching**\n' +
                        '• The dominant color is compared to all FFXIV dyes\n' +
                        '• Uses Euclidean distance in RGB color space\n' +
                        '• Returns the closest matching dye',
                    inline: false,
                },
                {
                    name: '✅ Tips for Best Results',
                    value:
                        '**Crop Your Images**\n' +
                        '• Focus on the specific armor piece or area you want to match\n' +
                        '• Remove unnecessary UI elements and backgrounds\n' +
                        '• The smaller the area, the more accurate the result\n\n' +
                        '**Choose Good Lighting**\n' +
                        '• Take screenshots in well-lit areas\n' +
                        '• Avoid dark shadows or extreme highlights\n' +
                        '• Midday lighting in-game works best\n\n' +
                        '**Avoid Dark Backgrounds**\n' +
                        '• Black or very dark backgrounds can skew results\n' +
                        '• Use neutral, lighter backgrounds when possible\n' +
                        '• The `/gpose` feature with custom backgrounds is great!',
                    inline: false,
                },
                {
                    name: '❌ Common Issues',
                    value:
                        '**"I got a dark color but my gear is bright!"**\n' +
                        '→ Your background is likely dark. Crop the image to just your gear.\n\n' +
                        '**"The match seems off"**\n' +
                        '→ Multiple colors in the image? The algorithm picks the MOST common color.\n\n' +
                        '**"Can I match a specific part?"**\n' +
                        '→ Yes! Crop to that exact area before uploading.',
                    inline: false,
                },
                {
                    name: '💡 Pro Tips',
                    value:
                        '• Use image editing software to crop before uploading\n' +
                        '• For metallic/shiny gear, results may vary due to lighting\n' +
                        '• If you know the hex code, use `/match` instead for exact results\n' +
                        '• Compare multiple screenshots to see how lighting affects color\n' +
                        '• Screenshot at 1920×1080 or higher for better quality',
                    inline: false,
                },
            ])
            .setFooter({
                text: 'XIV Dye Tools • Made with ❤️ for FFXIV glamour enthusiasts',
            })
            .setTimestamp();

        // Create examples embed
        const examplesEmbed = new EmbedBuilder()
            .setTitle('📸 Example Use Cases')
            .setColor(0x57f287)
            .addFields([
                {
                    name: '✨ Good Examples',
                    value:
                        '• Cropped screenshot of a single chest piece\n' +
                        '• Close-up of dyed armor with neutral background\n' +
                        '• Screenshot taken in bright daylight area\n' +
                        '• Image focused on the color you want to match',
                    inline: true,
                },
                {
                    name: '⚠️ Poor Examples',
                    value:
                        '• Full-screen screenshot with lots of UI\n' +
                        '• Character in a dark dungeon or cave\n' +
                        '• Multiple armor pieces with different dyes\n' +
                        '• Image dominated by background colors',
                    inline: true,
                },
            ])
            .addFields([
                {
                    name: '🎯 When to Use /match_image vs /match',
                    value:
                        '**Use `/match_image` when:**\n' +
                        '• You have a screenshot and want to find the dye\n' +
                        '• You\'re unsure of the exact color code\n' +
                        '• You want to match a color from inspiration photos\n\n' +
                        '**Use `/match` when:**\n' +
                        '• You already know the hex color code\n' +
                        '• You need more precise/exact results\n' +
                        '• You\'re working with color swatches or design files',
                    inline: false,
                },
            ]);

        // Create technical details embed
        const technicalEmbed = new EmbedBuilder()
            .setTitle('⚙️ Technical Details')
            .setColor(0xfee75c)
            .addFields([
                {
                    name: 'Supported Formats',
                    value: '• PNG\n• JPG/JPEG\n• GIF\n• BMP\n• WebP',
                    inline: true,
                },
                {
                    name: 'File Limits',
                    value:
                        `• Maximum size: ${config.image?.maxSizeMB || 8}MB\n` +
                        '• Maximum dimensions: Auto-handled\n' +
                        '• Processing time: ~1-3 seconds',
                    inline: true,
                },
                {
                    name: 'Match Quality Ratings',
                    value:
                        '🎯 **Perfect** (0 distance)\n' +
                        '✨ **Excellent** (<10 distance)\n' +
                        '👍 **Good** (<25 distance)\n' +
                        '👌 **Fair** (<50 distance)\n' +
                        '🔍 **Approximate** (≥50 distance)\n\n' +
                        '*Lower distance = better match*',
                    inline: false,
                },
            ])
            .setFooter({
                text: 'Powered by Sharp image processing library',
            });

        // Send as ephemeral (private) message
        await interaction.reply({
            embeds: [mainEmbed, examplesEmbed, technicalEmbed],
            flags: MessageFlags.Ephemeral, // Only visible to the user
        });
    },
};
