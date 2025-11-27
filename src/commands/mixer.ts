/**
 * /mixer command - Generate color gradients with intermediate dyes
 */

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AttachmentBuilder,
  AutocompleteInteraction,
  EmbedBuilder,
  ColorResolvable,
} from 'discord.js';
import {
  DyeService,
  ColorService,
  dyeDatabase,
  LocalizationService,
  type Dye,
} from 'xivdyetools-core';
import { validateHexColor, findDyeByName, validateIntRange } from '../utils/validators.js';
import { createErrorEmbed, formatColorSwatch } from '../utils/embed-builder.js';
import { sendPublicSuccess, sendEphemeralError } from '../utils/response-helper.js';
import { renderGradient } from '../renderers/gradient.js';
import { logger } from '../utils/logger.js';
import { emojiService } from '../services/emoji-service.js';
import { t } from '../services/i18n-service.js';
import type { BotCommand } from '../types/index.js';

const dyeService = new DyeService(dyeDatabase);

/**
 * Interpolate between two colors in RGB space
 */
function interpolateColor(color1: string, color2: string, ratio: number): string {
  const rgb1 = ColorService.hexToRgb(color1);
  const rgb2 = ColorService.hexToRgb(color2);

  const r = Math.round(rgb1.r + (rgb2.r - rgb1.r) * ratio);
  const g = Math.round(rgb1.g + (rgb2.g - rgb1.g) * ratio);
  const b = Math.round(rgb1.b + (rgb2.b - rgb1.b) * ratio);

  return ColorService.rgbToHex(r, g, b);
}

/**
 * Generate gradient colors
 */
function generateGradientColors(startColor: string, endColor: string, steps: number): string[] {
  const colors: string[] = [];

  for (let i = 0; i < steps; i++) {
    const ratio = steps > 1 ? i / (steps - 1) : 0;
    colors.push(interpolateColor(startColor, endColor, ratio));
  }

  return colors;
}

export const data = new SlashCommandBuilder()
  .setName('mixer')
  .setDescription('Generate a color gradient between two colors with intermediate dyes')
  .setDescriptionLocalizations({
    ja: '2色間のカラーグラデーションを生成し、中間の染料を提案',
    de: 'Farbverlauf zwischen zwei Farben mit passenden Farbstoffen generieren',
    fr: 'Générer un dégradé de couleurs entre deux couleurs avec des teintures intermédiaires',
  })
  .addStringOption((option) =>
    option
      .setName('start_color')
      .setDescription('Starting color: hex (e.g., #FF0000) or dye name')
      .setDescriptionLocalizations({
        ja: '開始色：16進数（例：#FF0000）または染料名',
        de: 'Startfarbe: Hex (z.B. #FF0000) oder Farbstoffname',
        fr: 'Couleur de départ : hex (ex. #FF0000) ou nom de teinture',
      })
      .setRequired(true)
      .setAutocomplete(true)
  )
  .addStringOption((option) =>
    option
      .setName('end_color')
      .setDescription('Ending color: hex (e.g., #0000FF) or dye name')
      .setDescriptionLocalizations({
        ja: '終了色：16進数（例：#0000FF）または染料名',
        de: 'Endfarbe: Hex (z.B. #0000FF) oder Farbstoffname',
        fr: 'Couleur de fin : hex (ex. #0000FF) ou nom de teinture',
      })
      .setRequired(true)
      .setAutocomplete(true)
  )
  .addIntegerOption((option) =>
    option
      .setName('steps')
      .setDescription('Number of color steps (default: 6)')
      .setDescriptionLocalizations({
        ja: 'グラデーションのステップ数（デフォルト：6）',
        de: 'Anzahl der Farbschritte (Standard: 6)',
        fr: 'Nombre de paliers de couleur (par défaut : 6)',
      })
      .setRequired(false)
      .setMinValue(2)
      .setMaxValue(10)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  try {
    const startColorInput = interaction.options.getString('start_color', true);
    const endColorInput = interaction.options.getString('end_color', true);
    const steps = interaction.options.getInteger('steps') || 6;

    logger.info(`Mixer command: ${startColorInput} → ${endColorInput} (${steps} steps)`);

    // Validate steps
    const stepsValidation = validateIntRange(steps, 2, 10, t('labels.steps'));
    if (!stepsValidation.valid) {
      const errorEmbed = createErrorEmbed(t('errors.invalidSteps'), stepsValidation.error!);
      await sendEphemeralError(interaction, { embeds: [errorEmbed] });
      return;
    }

    // Parse start color
    let startColor: string;
    let startDye: Dye | null = null;

    const startHexValidation = validateHexColor(startColorInput);
    if (startHexValidation.success) {
      startColor = startHexValidation.value;
    } else {
      const startDyeResult = findDyeByName(startColorInput);
      if (startDyeResult.error) {
        const errorEmbed = createErrorEmbed(
          t('errors.invalidStartColor'),
          t('errors.invalidColorOrDyeNameWithExamples', { input: startColorInput })
        );
        await sendEphemeralError(interaction, { embeds: [errorEmbed] });
        return;
      }
      startDye = startDyeResult.dye!;
      startColor = startDye.hex;
    }

    // Parse end color
    let endColor: string;
    let endDye: Dye | null = null;

    const endHexValidation = validateHexColor(endColorInput);
    if (endHexValidation.success) {
      endColor = endHexValidation.value;
    } else {
      const endDyeResult = findDyeByName(endColorInput);
      if (endDyeResult.error) {
        const errorEmbed = createErrorEmbed(
          t('errors.invalidEndColor'),
          t('errors.invalidColorOrDyeNameWithExamples', { input: endColorInput })
        );
        await sendEphemeralError(interaction, { embeds: [errorEmbed] });
        return;
      }
      endDye = endDyeResult.dye!;
      endColor = endDye.hex;
    }

    // Generate intermediate colors
    const gradientColors = generateGradientColors(startColor, endColor, steps);

    // Find closest dyes for each step
    const dyeMatches: Array<{ color: string; dye: Dye; distance: number }> = [];
    gradientColors.forEach((color) => {
      const closestDye = dyeService.findClosestDye(color);
      if (closestDye) {
        const distance = ColorService.getColorDistance(color, closestDye.hex);
        dyeMatches.push({ color, dye: closestDye, distance });
      }
    });

    if (dyeMatches.length === 0) {
      const errorEmbed = createErrorEmbed(t('errors.error'), t('errors.couldNotFindMatchingDyes'));
      await sendEphemeralError(interaction, { embeds: [errorEmbed] });
      return;
    }

    // Render gradient
    const dyeNames = dyeMatches.map((match) => match.dye.name);
    const gradientBuffer = await renderGradient({
      startColor,
      endColor,
      steps,
      intermediateColors: gradientColors,
      dyeNames,
    });

    const attachment = new AttachmentBuilder(gradientBuffer, {
      name: `gradient_${steps}steps.png`,
    });

    // Create embed
    const embedColor = parseInt(startColor.replace('#', ''), 16) as ColorResolvable;
    const localizedStartDyeName = startDye
      ? LocalizationService.getDyeName(startDye.id) || startDye.name
      : null;
    const localizedEndDyeName = endDye
      ? LocalizationService.getDyeName(endDye.id) || endDye.name
      : null;

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle(`🎨 ${t('embeds.colorGradientMixer')}`)
      .setDescription(
        [
          `**${t('embeds.start')}:** ${startDye ? emojiService.getDyeEmojiOrSwatch(startDye, 4) : formatColorSwatch(startColor, 4)} ${localizedStartDyeName || startColor.toUpperCase()}`,
          `**${t('embeds.end')}:** ${endDye ? emojiService.getDyeEmojiOrSwatch(endDye, 4) : formatColorSwatch(endColor, 4)} ${localizedEndDyeName || endColor.toUpperCase()}`,
          `**${t('labels.steps')}:** ${steps}`,
          '',
          `**🎯 ${t('embeds.intermediateDyes')}:**`,
        ].join('\n')
      )
      .setImage(`attachment://gradient_${steps}steps.png`)
      .setTimestamp();

    // Add dye matches
    dyeMatches.forEach((match, index) => {
      const stepNumber = index + 1;
      const emoji =
        ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'][index] || `${stepNumber}.`;

      const matchQuality =
        match.distance === 0
          ? t('matchQuality.perfect')
          : match.distance < 10
            ? t('matchQuality.excellent')
            : match.distance < 25
              ? t('matchQuality.good')
              : match.distance < 50
                ? t('matchQuality.fair')
                : t('matchQuality.approximate');

      const localizedDyeName = LocalizationService.getDyeName(match.dye.id) || match.dye.name;
      const localizedCategory =
        LocalizationService.getCategory(match.dye.category) || match.dye.category;

      embed.addFields({
        name: `${emoji} ${t('labels.step')} ${stepNumber}: ${localizedDyeName}`,
        value: [
          emojiService.getDyeEmojiOrSwatch(match.dye, 4),
          `**${t('embeds.target')}:** ${match.color.toUpperCase()}`,
          `**${t('embeds.match')}:** ${match.dye.hex.toUpperCase()} (${matchQuality}, Δ=${match.distance.toFixed(1)})`,
          `**${t('embeds.category')}:** ${localizedCategory}`,
        ].join('\n'),
        inline: true,
      });
    });

    // Add note about acquisition
    embed.addFields({
      name: `💡 ${t('embeds.tip')}`,
      value: t('embeds.useMatchForAcquisition'),
      inline: false,
    });

    // Send response (public)
    await sendPublicSuccess(interaction, {
      embeds: [embed],
      files: [attachment],
    });

    logger.info(`Mixer command completed: ${steps} steps generated`);
  } catch (error) {
    logger.error('Error executing mixer command:', error);
    const errorEmbed = createErrorEmbed(
      t('errors.commandError'),
      t('errors.errorGeneratingGradient')
    );

    await sendEphemeralError(interaction, { embeds: [errorEmbed] });
  }
}

/**
 * Autocomplete handler for color parameters
 */
export async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const focusedOption = interaction.options.getFocused(true);

  if (focusedOption.name === 'start_color' || focusedOption.name === 'end_color') {
    const query = focusedOption.value.toLowerCase();

    // If it looks like a hex color, don't suggest dyes
    if (query.startsWith('#')) {
      await interaction.respond([]);
      return;
    }

    // Search for matching dyes
    const allDyes = dyeService.getAllDyes();
    const matches = allDyes
      .filter((dye) => {
        // Exclude Facewear category
        if (dye.category === 'Facewear') return false;

        // Match both localized and English names (case-insensitive)
        const localizedName = LocalizationService.getDyeName(dye.id);
        return (
          dye.name.toLowerCase().includes(query) ||
          (localizedName && localizedName.toLowerCase().includes(query))
        );
      })
      .slice(0, 25) // Discord limits to 25 choices
      .map((dye) => {
        const localizedName = LocalizationService.getDyeName(dye.id);
        const localizedCategory = LocalizationService.getCategory(dye.category);
        return {
          name: `${localizedName || dye.name} (${localizedCategory || dye.category})`,
          value: dye.name,
        };
      });

    await interaction.respond(matches);
  }
}

export const mixerCommand: BotCommand = {
  data,
  execute,
  autocomplete,
};
