/**
 * /match_image command - Extract colors from uploaded images and find matching dyes
 */

import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    ColorResolvable,
} from 'discord.js';
import sharp from 'sharp';
import {
    DyeService,
    ColorService,
    dyeDatabase,
} from 'xivdyetools-core';
import { config } from '../config.js';
import { createErrorEmbed, formatColorSwatch, formatRGB, formatHSV, createDyeEmojiAttachment } from '../utils/embed-builder.js';
import { logger } from '../utils/logger.js';
import type { BotCommand } from '../types/index.js';

const dyeService = new DyeService(dyeDatabase);

export const data = new SlashCommandBuilder()
    .setName('match_image')
    .setDescription('Extract the dominant color from an image and find matching FFXIV dye')
    .addAttachmentOption((option) =>
        option
            .setName('image')
            .setDescription('Image file to analyze (PNG, JPG, GIF, BMP, WebP)')
            .setRequired(true)
    );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    try {
        const attachment = interaction.options.getAttachment('image', true);

        logger.info(`Analyzing image: ${attachment.name} (${attachment.size} bytes)`);

        // Validate file size
        const maxSizeBytes = config.image.maxSizeMB * 1024 * 1024;
        if (attachment.size > maxSizeBytes) {
            const errorEmbed = createErrorEmbed(
                'Image Too Large',
                `Maximum file size is ${config.image.maxSizeMB}MB. Your file is ${(attachment.size / 1024 / 1024).toFixed(2)}MB.`
            );
            await interaction.editReply({ embeds: [errorEmbed] });
            return;
        }

        // Validate content type (if available)
        if (attachment.contentType && !isValidImageType(attachment.contentType)) {
            const errorEmbed = createErrorEmbed(
                'Invalid File Type',
                `File must be an image (PNG, JPG, GIF, BMP, WebP).\n\nYour file type: ${attachment.contentType}`
            );
            await interaction.editReply({ embeds: [errorEmbed] });
            return;
        }

        // Fetch image buffer from Discord CDN
        const imageBuffer = await fetchImageBuffer(attachment.url);

        // Extract dominant color
        const dominantRGB = await extractDominantColor(imageBuffer);
        const dominantHex = ColorService.rgbToHex(dominantRGB.r, dominantRGB.g, dominantRGB.b);

        logger.debug(`Extracted dominant color: ${dominantHex} (RGB: ${dominantRGB.r}, ${dominantRGB.g}, ${dominantRGB.b})`);

        // Find closest dye
        const closestDye = dyeService.findClosestDye(dominantHex);
        if (!closestDye) {
            const errorEmbed = createErrorEmbed('Error', 'Could not find matching dye.');
            await interaction.editReply({ embeds: [errorEmbed] });
            return;
        }

        // Calculate distance
        const distance = ColorService.getColorDistance(dominantHex, closestDye.hex);

        // Determine match quality
        let matchQuality: string;
        let matchEmoji: string;
        if (distance === 0) {
            matchQuality = 'Perfect match';
            matchEmoji = '🎯';
        } else if (distance < 10) {
            matchQuality = 'Excellent match';
            matchEmoji = '✨';
        } else if (distance < 25) {
            matchQuality = 'Good match';
            matchEmoji = '👍';
        } else if (distance < 50) {
            matchQuality = 'Fair match';
            matchEmoji = '👌';
        } else {
            matchQuality = 'Approximate match';
            matchEmoji = '🔍';
        }

        // Create embed with image attachment
        const embed = new EmbedBuilder()
            .setColor(parseInt(closestDye.hex.replace('#', ''), 16) as ColorResolvable)
            .setTitle(`${matchEmoji} Color Match: ${closestDye.name}`)
            .setDescription(`Analyzed image: **${attachment.name}**`)
            .setImage(attachment.url)
            .addFields(
                {
                    name: 'Extracted Dominant Color',
                    value: [
                        formatColorSwatch(dominantHex, 6),
                        `**Hex:** ${dominantHex.toUpperCase()}`,
                        `**RGB:** ${formatRGB(dominantHex)}`,
                        `**HSV:** ${formatHSV(dominantHex)}`,
                    ].join('\n'),
                    inline: false,
                },
                {
                    name: `Closest Dye: ${closestDye.name}`,
                    value: [
                        formatColorSwatch(closestDye.hex, 6),
                        `**Hex:** ${closestDye.hex.toUpperCase()}`,
                        `**RGB:** ${formatRGB(closestDye.hex)}`,
                        `**HSV:** ${formatHSV(closestDye.hex)}`,
                        `**Category:** ${closestDye.category}`,
                    ].join('\n'),
                    inline: false,
                },
                {
                    name: 'Match Quality',
                    value: [
                        `**Distance:** ${distance.toFixed(2)} (Euclidean)`,
                        `**Quality:** ${matchQuality}`,
                    ].join('\n'),
                    inline: false,
                }
            )
            .setFooter({ text: 'Extracted using histogram analysis of dominant color' })
            .setTimestamp();

        // Add acquisition info if available
        if (closestDye.acquisition) {
            embed.addFields({
                name: 'Acquisition',
                value: closestDye.acquisition,
                inline: false,
            });
        }

        // Attach emoji if available
        const emojiAttachment = createDyeEmojiAttachment(closestDye);
        const files = emojiAttachment ? [emojiAttachment] : [];

        // Add thumbnail to embed if emoji available
        if (emojiAttachment) {
            embed.setThumbnail(`attachment://${emojiAttachment.name}`);
        }

        await interaction.editReply({ embeds: [embed], files });

        logger.info(`Image match completed: ${closestDye.name} (distance: ${distance.toFixed(2)})`);
    } catch (error) {
        logger.error('Error executing match_image command:', error);

        // Provide more specific error messages
        let errorMessage = 'Failed to analyze the image. Please ensure it\'s a valid image file and try again.';

        if (error instanceof Error) {
            if (error.message.includes('fetch')) {
                errorMessage = 'Failed to download the image from Discord. Please try uploading again.';
            } else if (error.message.includes('Input buffer')) {
                errorMessage = 'Invalid or corrupted image file. Please upload a valid PNG, JPG, GIF, BMP, or WebP image.';
            }
        }

        const errorEmbed = createErrorEmbed('Processing Error', errorMessage);

        if (interaction.deferred) {
            await interaction.editReply({ embeds: [errorEmbed] });
        } else {
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    }
}

/**
 * Fetch image buffer from Discord CDN URL
 */
async function fetchImageBuffer(url: string): Promise<Buffer> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
        const response = await fetch(url, { signal: controller.signal });

        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Extract dominant color from image buffer using Sharp's histogram analysis
 */
async function extractDominantColor(imageBuffer: Buffer): Promise<{ r: number; g: number; b: number }> {
    try {
        const stats = await sharp(imageBuffer)
            .resize(250, 250, {
                fit: 'cover',
                withoutEnlargement: true,
            })
            .stats();

        return stats.dominant;
    } catch (error) {
        logger.error('Sharp processing error:', error);
        throw new Error('Invalid or corrupted image file');
    }
}

/**
 * Validate image content type
 */
function isValidImageType(contentType: string): boolean {
    const validTypes = [
        'image/png',
        'image/jpeg',
        'image/jpg',
        'image/gif',
        'image/bmp',
        'image/webp',
        'image/tiff',
        'image/avif',
    ];
    return validTypes.includes(contentType.toLowerCase());
}

export const matchImageCommand: BotCommand = {
    data,
    execute,
};
