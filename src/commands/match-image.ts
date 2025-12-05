/**
 * /match_image command - Extract colors from uploaded images and find matching dyes
 */

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  AttachmentBuilder,
  ColorResolvable,
} from 'discord.js';
import sharp from 'sharp';
import {
  DyeService,
  ColorService,
  PaletteService,
  dyeDatabase,
  LocalizationService,
  type RGB,
  type PaletteMatch,
} from 'xivdyetools-core';
import { config } from '../config.js';
import {
  createErrorEmbed,
  formatColorSwatch,
  formatRGB,
  formatHSV,
} from '../utils/embed-builder.js';
import { createCopyButtonsRow } from '../utils/button-builder.js';
import { validateImage, processWithTimeout } from '../utils/image-validator.js';
import { validateImageUrl } from '../utils/url-validator.js';
import { logger } from '../utils/logger.js';
import { WorkerPool } from '../utils/worker-pool.js';
import { emojiService } from '../services/emoji-service.js';
import { sendPublicSuccess, sendEphemeralError } from '../utils/response-helper.js';
import { t } from '../services/i18n-service.js';
import {
  renderPaletteGrid,
  type PaletteGridEntry,
  type SourceImageData,
} from '../renderers/palette-grid.js';
import type { BotCommand } from '../types/index.js';

const dyeService = new DyeService(dyeDatabase);

// Lazy initialization to support test mocking with vi.resetModules()
let _paletteService: PaletteService | null = null;
function getPaletteService(): PaletteService {
  if (!_paletteService) {
    _paletteService = new PaletteService();
  }
  return _paletteService;
}

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
  )
  .addIntegerOption((option) =>
    option
      .setName('colors')
      .setDescription('Number of colors to extract (1-5, default: 1)')
      .setDescriptionLocalizations({
        ja: '抽出する色の数（1-5、デフォルト: 1）',
        de: 'Anzahl der zu extrahierenden Farben (1-5, Standard: 1)',
        fr: 'Nombre de couleurs à extraire (1-5, par défaut: 1)',
      })
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(5)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  try {
    const attachment = interaction.options.getAttachment('image', true);
    const colorCount = interaction.options.getInteger('colors') ?? 1;

    logger.info(
      `Analyzing image: ${attachment.name} (${attachment.size} bytes), colors: ${colorCount}`
    );

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

    // Multi-color palette extraction mode
    if (colorCount > 1) {
      await handleMultiColorExtraction(interaction, attachment, imageBuffer, colorCount);
      return;
    }

    // Single color mode (original behavior)
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

    // Create copy buttons for matched dye
    const copyButtons = createCopyButtonsRow(closestDye.hex);

    await sendPublicSuccess(interaction, { embeds: [embed], components: [copyButtons] });

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

/**
 * Result of pixel data extraction
 */
interface PixelDataResult {
  /** RGB array for palette service */
  pixels: RGB[];
  /** Source image data for rendering sampling indicators */
  sourceImage: SourceImageData;
}

/**
 * Extract raw pixel data from image buffer
 * Downsamples to 256x256 for performance
 */
async function extractPixelData(imageBuffer: Buffer): Promise<PixelDataResult> {
  try {
    // Downsample and extract raw pixel data
    const { data, info } = await sharp(imageBuffer)
      .resize(256, 256, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .removeAlpha() // Remove alpha channel to get RGB only
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Convert raw buffer to RGB array
    const pixels: RGB[] = [];
    for (let i = 0; i < data.length; i += 3) {
      pixels.push({
        r: data[i],
        g: data[i + 1],
        b: data[i + 2],
      });
    }

    logger.debug(`Extracted ${pixels.length} pixels from ${info.width}x${info.height} image`);

    return {
      pixels,
      sourceImage: {
        pixels: data,
        width: info.width,
        height: info.height,
      },
    };
  } catch (error) {
    logger.error('Sharp pixel extraction error:', error);
    throw new Error('Failed to extract pixel data from image');
  }
}

/**
 * Handle multi-color palette extraction mode
 */
async function handleMultiColorExtraction(
  interaction: ChatInputCommandInteraction,
  attachment: { name: string; url: string },
  imageBuffer: Buffer,
  colorCount: number
): Promise<void> {
  logger.info(`Extracting ${colorCount} colors from image: ${attachment.name}`);

  // Extract pixel data (now includes source image data for sampling indicators)
  const { pixels, sourceImage } = await processWithTimeout(extractPixelData(imageBuffer), 15000);

  // Extract and match palette
  const paletteMatches = getPaletteService().extractAndMatchPalette(pixels, dyeService, {
    colorCount,
    maxIterations: 25,
    maxSamples: 10000,
  });

  if (paletteMatches.length === 0) {
    const errorEmbed = createErrorEmbed(t('errors.error'), t('errors.couldNotFindMatchingDye'));
    await sendEphemeralError(interaction, { embeds: [errorEmbed] });
    return;
  }

  // Convert to grid entries
  const gridEntries: PaletteGridEntry[] = paletteMatches.map((match: PaletteMatch) => ({
    extracted: match.extracted,
    matchedDye: match.matchedDye,
    distance: match.distance,
    dominance: match.dominance,
  }));

  // Render palette grid with sampling indicators
  const gridBuffer = await renderPaletteGrid({ colors: gridEntries, sourceImage });

  // Create embed
  const primaryDye = paletteMatches[0].matchedDye;
  const embed = new EmbedBuilder()
    .setColor(parseInt(primaryDye.hex.replace('#', ''), 16) as ColorResolvable)
    .setTitle(`🎨 ${t('embeds.paletteExtraction') || 'Palette Extraction'}`)
    .setDescription(
      `${t('embeds.analyzedImage')}: **${attachment.name}**\n` +
        `${t('embeds.extractedColors') || 'Extracted'} **${paletteMatches.length}** ${t('embeds.colorsFromImage') || 'colors from image'}`
    )
    .setThumbnail(attachment.url)
    .setTimestamp();

  // Add field for each color
  paletteMatches.forEach((match: PaletteMatch, index: number) => {
    const localizedName =
      LocalizationService.getDyeName(match.matchedDye.id) || match.matchedDye.name;
    const extractedHex = ColorService.rgbToHex(
      match.extracted.r,
      match.extracted.g,
      match.extracted.b
    );

    embed.addFields({
      name: `${index + 1}. ${localizedName} (${match.dominance}%)`,
      value: [
        `${emojiService.getDyeEmojiOrSwatch(match.matchedDye, 3)} ${extractedHex.toUpperCase()} → ${match.matchedDye.hex.toUpperCase()}`,
        `Δ${match.distance.toFixed(1)}`,
      ].join(' | '),
      inline: true,
    });
  });

  // Create attachment from grid buffer
  const gridAttachment = new AttachmentBuilder(gridBuffer, { name: 'palette_grid.png' });

  embed.setImage('attachment://palette_grid.png');

  await sendPublicSuccess(interaction, {
    embeds: [embed],
    files: [gridAttachment],
  });

  logger.info(
    `Multi-color extraction completed: ${paletteMatches.map((m: PaletteMatch) => m.matchedDye.name).join(', ')}`
  );
}

export const matchImageCommand: BotCommand = {
  data,
  execute,
};
