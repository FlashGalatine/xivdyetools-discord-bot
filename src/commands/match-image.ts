/**
 * /match_image command - Extract colors from uploaded images and find matching dyes
 */

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ColorResolvable,
  MessageFlags,
} from 'discord.js';
import sharp from 'sharp';
import { DyeService, ColorService, dyeDatabase } from 'xivdyetools-core';
import { config } from '../config.js';
import {
  createErrorEmbed,
  formatColorSwatch,
  formatRGB,
  formatHSV,
} from '../utils/embed-builder.js';
import { validateImage, processWithTimeout } from '../utils/image-validator.js';
import { logger } from '../utils/logger.js';
import { WorkerPool } from '../utils/worker-pool.js';
import { emojiService } from '../services/emoji-service.js';
import type { BotCommand } from '../types/index.js';

const dyeService = new DyeService(dyeDatabase);

// Per P-6: Worker pool for image processing (with fallback to sync)
let workerPool: WorkerPool | null = null;
let useWorkers = true; // Can be disabled if workers fail

/**
 * Initialize worker pool (lazy initialization)
 */
function getWorkerPool(): WorkerPool | null {
  if (!useWorkers) {
    return null;
  }

  if (!workerPool) {
    try {
      // Worker path relative to dist directory
      // In dist, utils/worker-pool.js -> workers/image-processor.worker.js
      workerPool = new WorkerPool('../workers/image-processor.worker.js');
    } catch (error) {
      logger.warn('Failed to initialize worker pool, falling back to sync processing:', error);
      useWorkers = false;
      return null;
    }
  }

  return workerPool;
}

/**
 * Cleanup worker pool (called on shutdown)
 */
export async function cleanupWorkerPool(): Promise<void> {
  if (workerPool) {
    await workerPool.terminate();
    workerPool = null;
  }
}

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

    // Fetch image buffer from Discord CDN (with timeout)
    const imageBuffer = await processWithTimeout(
      fetchImageBuffer(attachment.url),
      10000 // 10 second timeout
    );

    // Comprehensive image validation (S-2: Image Upload Security)
    const maxSizeBytes = config.image.maxSizeMB * 1024 * 1024;

    // Per P-6: Try worker pool first, fallback to sync
    const pool = getWorkerPool();
    let validationResult: Awaited<ReturnType<typeof validateImage>>;
    let dominantRGB: { r: number; g: number; b: number };

    if (pool) {
      try {
        // Use worker for validation
        const workerValidation = await processWithTimeout(
          pool.execute<{
            success: boolean;
            metadata?: { width: number; height: number; format: string };
            error?: string;
          }>({
            type: 'validateImage',
            imageBuffer,
            maxSizeBytes,
          }),
          10000
        );

        if (!workerValidation.success) {
          const errorEmbed = createErrorEmbed(
            'Image Validation Failed',
            workerValidation.error || 'Image validation failed.'
          );
          await interaction.editReply({ embeds: [errorEmbed] });
          return;
        }

        if (!workerValidation.metadata) {
          throw new Error('Worker validation missing metadata');
        }

        validationResult = {
          success: true,
          metadata: {
            width: workerValidation.metadata.width,
            height: workerValidation.metadata.height,
            format: workerValidation.metadata.format,
            size: imageBuffer.length,
            pixelCount: workerValidation.metadata.width * workerValidation.metadata.height,
          },
          value: {
            width: workerValidation.metadata.width,
            height: workerValidation.metadata.height,
            format: workerValidation.metadata.format,
            size: imageBuffer.length,
            pixelCount: workerValidation.metadata.width * workerValidation.metadata.height,
          },
        };

        // Use worker for color extraction
        dominantRGB = await processWithTimeout(
          pool.execute<{ r: number; g: number; b: number }>({
            type: 'extractDominantColor',
            imageBuffer,
          }),
          10000
        );
      } catch (error) {
        logger.warn('Worker processing failed, falling back to sync:', error);
        useWorkers = false;
        // Fall through to sync processing
        validationResult = await processWithTimeout(
          validateImage(imageBuffer, maxSizeBytes),
          10000
        );

        if (!validationResult.success) {
          const errorEmbed = createErrorEmbed(
            'Image Validation Failed',
            validationResult.error || 'Image validation failed.'
          );
          await interaction.editReply({ embeds: [errorEmbed] });
          return;
        }

        dominantRGB = await processWithTimeout(extractDominantColor(imageBuffer), 10000);
      }
    } else {
      // Sync processing (fallback)
      validationResult = await processWithTimeout(validateImage(imageBuffer, maxSizeBytes), 10000);

      if (!validationResult.success) {
        const errorEmbed = createErrorEmbed(
          'Image Validation Failed',
          validationResult.error || 'Image validation failed.'
        );
        await interaction.editReply({ embeds: [errorEmbed] });
        return;
      }

      dominantRGB = await processWithTimeout(extractDominantColor(imageBuffer), 10000);
    }

    if (validationResult.success) {
      logger.debug(
        `Image validated: ${validationResult.metadata.width}x${validationResult.metadata.height}, format: ${validationResult.metadata.format}`
      );
    }
    const dominantHex = ColorService.rgbToHex(dominantRGB.r, dominantRGB.g, dominantRGB.b);

    logger.debug(
      `Extracted dominant color: ${dominantHex} (RGB: ${dominantRGB.r}, ${dominantRGB.g}, ${dominantRGB.b})`
    );

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
            emojiService.getDyeEmojiOrSwatch(closestDye, 6),
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

    // Add emoji thumbnail if available
    const emoji = emojiService.getDyeEmoji(closestDye);
    if (emoji) {
      embed.setThumbnail(emoji.imageURL());
    }

    await interaction.editReply({ embeds: [embed] });

    logger.info(`Image match completed: ${closestDye.name} (distance: ${distance.toFixed(2)})`);
  } catch (error) {
    logger.error('Error executing match_image command:', error);

    // Provide more specific error messages
    let errorMessage =
      "Failed to analyze the image. Please ensure it's a valid image file and try again.";

    if (error instanceof Error) {
      if (error.message.includes('fetch')) {
        errorMessage = 'Failed to download the image from Discord. Please try uploading again.';
      } else if (error.message.includes('Input buffer')) {
        errorMessage =
          'Invalid or corrupted image file. Please upload a valid PNG, JPG, GIF, BMP, or WebP image.';
      }
    }

    const errorEmbed = createErrorEmbed('Processing Error', errorMessage);

    if (interaction.deferred) {
      await interaction.editReply({ embeds: [errorEmbed] });
    } else {
      await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
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
 * Per P-3: Optimized with downsampling to 256x256 before analysis
 */
async function extractDominantColor(
  imageBuffer: Buffer
): Promise<{ r: number; g: number; b: number }> {
  try {
    // Downsample to 256x256 for faster processing (P-3 optimization)
    const stats = await sharp(imageBuffer)
      .resize(256, 256, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .stats();

    return stats.dominant;
  } catch (error) {
    logger.error('Sharp processing error:', error);
    throw new Error('Invalid or corrupted image file');
  }
}

export const matchImageCommand: BotCommand = {
  data,
  execute,
};
