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
import { DyeService, ColorService, dyeDatabase, LocalizationService } from 'xivdyetools-core';
import { config } from '../config.js';
import {
  createErrorEmbed,
  formatColorSwatch,
  formatRGB,
  formatHSV,
} from '../utils/embed-builder.js';
import { validateImage, processWithTimeout } from '../utils/image-validator.js';
import { validateImageUrl } from '../utils/url-validator.js';
import { logger } from '../utils/logger.js';
import { WorkerPool } from '../utils/worker-pool.js';
import { emojiService } from '../services/emoji-service.js';
import { sendPublicSuccess, sendEphemeralError } from '../utils/response-helper.js';
import { t } from '../services/i18n-service.js';
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
  .setDescriptionLocalizations({
    ja: '画像から主要色を抽出し、最も近いFFXIV染料を検索',
    de: 'Dominante Farbe aus einem Bild extrahieren und passenden FFXIV-Farbstoff finden',
    fr: "Extraire la couleur dominante d'une image et trouver la teinture FFXIV correspondante",
  })
  .addAttachmentOption((option) =>
    option
      .setName('image')
      .setDescription('Image file to analyze (PNG, JPG, GIF, BMP, WebP)')
      .setDescriptionLocalizations({
        ja: '分析する画像ファイル（PNG、JPG、GIF、BMP、WebP）',
        de: 'Bilddatei zur Analyse (PNG, JPG, GIF, BMP, WebP)',
        fr: 'Fichier image à analyser (PNG, JPG, GIF, BMP, WebP)',
      })
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
            t('errors.imageValidationFailed'),
            workerValidation.error || t('errors.imageValidationFailedGeneric')
          );
          await sendEphemeralError(interaction, { embeds: [errorEmbed] });
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
            t('errors.imageValidationFailed'),
            validationResult.error || t('errors.imageValidationFailedGeneric')
          );
          await sendEphemeralError(interaction, { embeds: [errorEmbed] });
          return;
        }

        dominantRGB = await processWithTimeout(extractDominantColor(imageBuffer), 10000);
      }
    } else {
      // Sync processing (fallback)
      validationResult = await processWithTimeout(validateImage(imageBuffer, maxSizeBytes), 10000);

      if (!validationResult.success) {
        const errorEmbed = createErrorEmbed(
          t('errors.imageValidationFailed'),
          validationResult.error || t('errors.imageValidationFailedGeneric')
        );
        await sendEphemeralError(interaction, { embeds: [errorEmbed] });
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
      const errorEmbed = createErrorEmbed(t('errors.error'), t('errors.couldNotFindMatchingDye'));
      await sendEphemeralError(interaction, { embeds: [errorEmbed] });
      return;
    }

    // Calculate distance
    const distance = ColorService.getColorDistance(dominantHex, closestDye.hex);

    // Determine match quality
    let matchQuality: string;
    let matchEmoji: string;
    if (distance === 0) {
      matchQuality = t('matchQuality.perfect');
      matchEmoji = '🎯';
    } else if (distance < 10) {
      matchQuality = t('matchQuality.excellent');
      matchEmoji = '✨';
    } else if (distance < 25) {
      matchQuality = t('matchQuality.good');
      matchEmoji = '👍';
    } else if (distance < 50) {
      matchQuality = t('matchQuality.fair');
      matchEmoji = '⚠️';
    } else {
      matchQuality = t('matchQuality.approximate');
      matchEmoji = '🔍';
    }

    // Get localized names (with fallbacks)
    const localizedDyeName = LocalizationService.getDyeName(closestDye.id) || closestDye.name;
    const localizedCategory =
      LocalizationService.getCategory(closestDye.category) || closestDye.category;

    // Create embed with image attachment
    const embed = new EmbedBuilder()
      .setColor(parseInt(closestDye.hex.replace('#', ''), 16) as ColorResolvable)
      .setTitle(`${matchEmoji} ${t('embeds.colorMatch')}: ${localizedDyeName}`)
      .setDescription(`${t('embeds.analyzedImage')}: **${attachment.name}**`)
      .setImage(attachment.url)
      .addFields(
        {
          name: t('embeds.extractedDominantColor'),
          value: [
            formatColorSwatch(dominantHex, 6),
            `**${t('embeds.hex')}:** ${dominantHex.toUpperCase()}`,
            `**${t('embeds.rgb')}:** ${formatRGB(dominantHex)}`,
            `**${t('embeds.hsv')}:** ${formatHSV(dominantHex)}`,
          ].join('\n'),
          inline: false,
        },
        {
          name: `${t('embeds.closestDye')}: ${localizedDyeName}`,
          value: [
            emojiService.getDyeEmojiOrSwatch(closestDye, 6),
            `**${t('embeds.hex')}:** ${closestDye.hex.toUpperCase()}`,
            `**${t('embeds.rgb')}:** ${formatRGB(closestDye.hex)}`,
            `**${t('embeds.hsv')}:** ${formatHSV(closestDye.hex)}`,
            `**${t('embeds.category')}:** ${localizedCategory}`,
          ].join('\n'),
          inline: false,
        },
        {
          name: t('embeds.matchQuality'),
          value: [
            `**${t('embeds.distance')}:** ${distance.toFixed(2)} (${t('embeds.euclidean')})`,
            `**${t('embeds.quality')}:** ${matchQuality}`,
          ].join('\n'),
          inline: false,
        }
      )
      .setFooter({ text: t('embeds.extractedUsingHistogram') })
      .setTimestamp();

    // Add acquisition info if available
    if (closestDye.acquisition) {
      const localizedAcquisition =
        LocalizationService.getAcquisition(closestDye.acquisition) || closestDye.acquisition;
      embed.addFields({
        name: t('embeds.acquisition'),
        value: localizedAcquisition,
        inline: false,
      });
    }

    // Add emoji thumbnail if available
    const emoji = emojiService.getDyeEmoji(closestDye);
    if (emoji) {
      embed.setThumbnail(emoji.imageURL());
    }

    await sendPublicSuccess(interaction, { embeds: [embed] });

    logger.info(`Image match completed: ${closestDye.name} (distance: ${distance.toFixed(2)})`);
  } catch (error) {
    logger.error('Error executing match_image command:', error);

    // Provide more specific error messages
    let errorMessage = t('errors.failedToAnalyzeImage');

    if (error instanceof Error) {
      if (error.message.includes('fetch')) {
        errorMessage = t('errors.failedToDownloadImage');
      } else if (error.message.includes('Input buffer')) {
        errorMessage = t('errors.invalidOrCorruptedImage');
      }
    }

    const errorEmbed = createErrorEmbed(t('errors.processingError'), errorMessage);

    await sendEphemeralError(interaction, { embeds: [errorEmbed] });
  }
}

/**
 * Fetch image buffer from Discord CDN URL
 * Per S-1: Validates URL before fetching to prevent SSRF attacks
 */
async function fetchImageBuffer(url: string): Promise<Buffer> {
  // Validate URL before fetching (SSRF protection)
  const urlValidation = validateImageUrl(url);
  if (!urlValidation.valid) {
    throw new Error(urlValidation.error || 'Invalid image URL');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

  try {
    const response = await fetch(urlValidation.normalizedUrl!, { signal: controller.signal });

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
