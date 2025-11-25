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
import { DyeService, ColorService, dyeDatabase, type Dye } from 'xivdyetools-core';
import { validateHexColor, findDyeByName, validateIntRange } from '../utils/validators.js';
import { createErrorEmbed, formatColorSwatch } from '../utils/embed-builder.js';
import { sendPublicSuccess, sendEphemeralError } from '../utils/response-helper.js';
import { renderGradient } from '../renderers/gradient.js';
import { logger } from '../utils/logger.js';
import { emojiService } from '../services/emoji-service.js';
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
  .addStringOption((option) =>
    option
      .setName('start_color')
      .setDescription('Starting color: hex (e.g., #FF0000) or dye name')
      .setRequired(true)
      .setAutocomplete(true)
  )
  .addStringOption((option) =>
    option
      .setName('end_color')
      .setDescription('Ending color: hex (e.g., #0000FF) or dye name')
      .setRequired(true)
      .setAutocomplete(true)
  )
  .addIntegerOption((option) =>
    option
      .setName('steps')
      .setDescription('Number of color steps (default: 6)')
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
    const stepsValidation = validateIntRange(steps, 2, 10, 'Steps');
    if (!stepsValidation.valid) {
      const errorEmbed = createErrorEmbed('Invalid Steps', stepsValidation.error!);
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
          'Invalid Start Color',
          `"${startColorInput}" is not a valid hex color or dye name.\n\n` +
            `**Examples:**\n` +
            `• Hex: \`#FF0000\`, \`#8A2BE2\`\n` +
            `• Dye: \`Dalamud Red\`, \`Snow White\``
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
          'Invalid End Color',
          `"${endColorInput}" is not a valid hex color or dye name.\n\n` +
            `**Examples:**\n` +
            `• Hex: \`#FF0000\`, \`#8A2BE2\`\n` +
            `• Dye: \`Dalamud Red\`, \`Snow White\``
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
      const errorEmbed = createErrorEmbed('Error', 'Could not find matching dyes.');
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

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle('🎨 Color Gradient Mixer')
      .setDescription(
        [
          `**Start:** ${startDye ? emojiService.getDyeEmojiOrSwatch(startDye, 4) : formatColorSwatch(startColor, 4)} ${startDye ? startDye.name : startColor.toUpperCase()}`,
          `**End:** ${endDye ? emojiService.getDyeEmojiOrSwatch(endDye, 4) : formatColorSwatch(endColor, 4)} ${endDye ? endDye.name : endColor.toUpperCase()}`,
          `**Steps:** ${steps}`,
          '',
          '**🎯 Intermediate Dyes:**',
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
          ? 'Perfect'
          : match.distance < 10
            ? 'Excellent'
            : match.distance < 25
              ? 'Good'
              : match.distance < 50
                ? 'Fair'
                : 'Approximate';

      embed.addFields({
        name: `${emoji} Step ${stepNumber}: ${match.dye.name}`,
        value: [
          emojiService.getDyeEmojiOrSwatch(match.dye, 4),
          `**Target:** ${match.color.toUpperCase()}`,
          `**Match:** ${match.dye.hex.toUpperCase()} (${matchQuality}, Δ=${match.distance.toFixed(1)})`,
          `**Category:** ${match.dye.category}`,
        ].join('\n'),
        inline: true,
      });
    });

    // Add note about acquisition
    embed.addFields({
      name: '💡 Tip',
      value: 'Use `/match <color>` to see acquisition details for individual dyes.',
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
      'Command Error',
      'An error occurred while generating the gradient. Please try again.'
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

        // Match name (case-insensitive)
        return dye.name.toLowerCase().includes(query);
      })
      .slice(0, 25) // Discord limits to 25 choices
      .map((dye) => ({
        name: `${dye.name} (${dye.category})`,
        value: dye.name,
      }));

    await interaction.respond(matches);
  }
}

export const mixerCommand: BotCommand = {
  data,
  execute,
  autocomplete,
};
