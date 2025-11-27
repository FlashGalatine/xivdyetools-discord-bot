/**
 * /comparison command - Compare multiple dyes side-by-side
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
import { validateHexColor, findDyeByName } from '../utils/validators.js';
import { createErrorEmbed, formatRGB, formatHSV } from '../utils/embed-builder.js';
import { renderSwatchGrid } from '../renderers/swatch-grid.js';
import { logger } from '../utils/logger.js';
import { emojiService } from '../services/emoji-service.js';
import { sendPublicSuccess, sendEphemeralError } from '../utils/response-helper.js';
import { t } from '../services/i18n-service.js';
import type { BotCommand } from '../types/index.js';

const dyeService = new DyeService(dyeDatabase);

interface DyePair {
  dye1: Dye;
  dye2: Dye;
  distance: number;
}

export const data = new SlashCommandBuilder()
  .setName('comparison')
  .setDescription('Compare multiple FFXIV dyes side-by-side')
  .setDescriptionLocalizations({
    ja: '複数のFFXIV染料を並べて比較',
    de: 'Mehrere FFXIV-Farbstoffe nebeneinander vergleichen',
    fr: 'Comparer plusieurs teintures FFXIV côte à côte',
  })
  .addStringOption((option) =>
    option
      .setName('dye1')
      .setDescription('First dye: hex (e.g., #FF0000) or dye name')
      .setDescriptionLocalizations({
        ja: '1番目の染料：16進数（例：#FF0000）または染料名',
        de: 'Erster Farbstoff: Hex (z.B. #FF0000) oder Farbstoffname',
        fr: 'Première teinture : hex (ex. #FF0000) ou nom de teinture',
      })
      .setRequired(true)
      .setAutocomplete(true)
  )
  .addStringOption((option) =>
    option
      .setName('dye2')
      .setDescription('Second dye: hex (e.g., #00FF00) or dye name')
      .setDescriptionLocalizations({
        ja: '2番目の染料：16進数（例：#00FF00）または染料名',
        de: 'Zweiter Farbstoff: Hex (z.B. #00FF00) oder Farbstoffname',
        fr: 'Deuxième teinture : hex (ex. #00FF00) ou nom de teinture',
      })
      .setRequired(true)
      .setAutocomplete(true)
  )
  .addStringOption((option) =>
    option
      .setName('dye3')
      .setDescription('Third dye (optional): hex or dye name')
      .setDescriptionLocalizations({
        ja: '3番目の染料（任意）：16進数または染料名',
        de: 'Dritter Farbstoff (optional): Hex oder Farbstoffname',
        fr: 'Troisième teinture (optionnel) : hex ou nom de teinture',
      })
      .setRequired(false)
      .setAutocomplete(true)
  )
  .addStringOption((option) =>
    option
      .setName('dye4')
      .setDescription('Fourth dye (optional): hex or dye name')
      .setDescriptionLocalizations({
        ja: '4番目の染料（任意）：16進数または染料名',
        de: 'Vierter Farbstoff (optional): Hex oder Farbstoffname',
        fr: 'Quatrième teinture (optionnel) : hex ou nom de teinture',
      })
      .setRequired(false)
      .setAutocomplete(true)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  try {
    const dyeInputs = [
      interaction.options.getString('dye1', true),
      interaction.options.getString('dye2', true),
      interaction.options.getString('dye3'),
      interaction.options.getString('dye4'),
    ].filter((input): input is string => input !== null);

    logger.info(`Comparison command: ${dyeInputs.join(', ')}`);

    // Parse each input (hex or dye name) to get Dye objects
    const dyes: Dye[] = [];
    const dyeColors: string[] = [];

    for (const input of dyeInputs) {
      const hexValidation = validateHexColor(input);
      if (hexValidation.success) {
        // Input is a hex color - use normalized value and find closest dye
        const normalizedHex = hexValidation.value;
        const closestDye = dyeService.findClosestDye(normalizedHex);
        if (!closestDye) {
          const errorEmbed = createErrorEmbed(
            t('errors.error'),
            t('errors.couldNotFindMatchingDyeForHex', { hex: normalizedHex })
          );
          await sendEphemeralError(interaction, { embeds: [errorEmbed] });
          return;
        }
        dyes.push(closestDye);
        dyeColors.push(normalizedHex); // Store normalized hex
      } else {
        // Input is a dye name
        const dyeResult = findDyeByName(input);
        if (dyeResult.error) {
          const errorEmbed = createErrorEmbed(
            t('errors.invalidInput'),
            t('errors.invalidColorOrDyeNameWithExamples', { input })
          );
          await sendEphemeralError(interaction, { embeds: [errorEmbed] });
          return;
        }
        dyes.push(dyeResult.dye!);
        dyeColors.push(dyeResult.dye!.hex);
      }
    }

    // Calculate pairwise distances
    const pairs = calculatePairwiseDistances(dyes);
    const closestPair = pairs.reduce((min, pair) => (pair.distance < min.distance ? pair : min));
    const furthestPair = pairs.reduce((max, pair) => (pair.distance > max.distance ? pair : max));
    const averageDistance = pairs.reduce((sum, pair) => sum + pair.distance, 0) / pairs.length;

    // Render swatch grid
    const gridBuffer = await renderSwatchGrid({
      dyes,
      showValues: false,
    });

    const attachment = new AttachmentBuilder(gridBuffer, {
      name: `comparison_${dyes.length}dyes.png`,
    });

    // Create embed
    const embed = new EmbedBuilder()
      .setColor(parseInt(dyes[0].hex.replace('#', ''), 16) as ColorResolvable)
      .setTitle(
        `🔍 ${t('embeds.dyeComparison')} (${dyes.length} ${dyes.length === 1 ? t('labels.dye') : t('labels.dyes')})`
      )
      .setImage(`attachment://comparison_${dyes.length}dyes.png`)
      .setTimestamp();

    // Add field for each dye
    dyes.forEach((dye, index) => {
      const emoji = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'][index] || `${index + 1}.`;
      const localizedName = LocalizationService.getDyeName(dye.id) || dye.name;
      const localizedCategory = LocalizationService.getCategory(dye.category) || dye.category;
      embed.addFields({
        name: `${emoji} ${localizedName}`,
        value: [
          emojiService.getDyeEmojiOrSwatch(dye, 6),
          `**${t('embeds.hex')}:** ${dye.hex.toUpperCase()}`,
          `**${t('embeds.rgb')}:** ${formatRGB(dye.hex)}`,
          `**${t('embeds.hsv')}:** ${formatHSV(dye.hex)}`,
          `**${t('embeds.category')}:** ${localizedCategory}`,
        ].join('\n'),
        inline: true,
      });
    });

    // Add comparison analysis (only if 2+ dyes)
    if (dyes.length >= 2) {
      const closestDye1Name =
        LocalizationService.getDyeName(closestPair.dye1.id) || closestPair.dye1.name;
      const closestDye2Name =
        LocalizationService.getDyeName(closestPair.dye2.id) || closestPair.dye2.name;
      const furthestDye1Name =
        LocalizationService.getDyeName(furthestPair.dye1.id) || furthestPair.dye1.name;
      const furthestDye2Name =
        LocalizationService.getDyeName(furthestPair.dye2.id) || furthestPair.dye2.name;

      embed.addFields({
        name: `📊 ${t('embeds.comparisonAnalysis')}`,
        value: [
          `**${t('embeds.mostSimilar')}:** ${closestDye1Name} ↔ ${closestDye2Name}`,
          `${t('embeds.distance')}: ${closestPair.distance.toFixed(1)} (${getQualityLabel(closestPair.distance)})`,
          '',
          `**${t('embeds.mostDifferent')}:** ${furthestDye1Name} ↔ ${furthestDye2Name}`,
          `${t('embeds.distance')}: ${furthestPair.distance.toFixed(1)} (${getQualityLabel(furthestPair.distance)})`,
          '',
          `**${t('embeds.averageDistance')}:** ${averageDistance.toFixed(1)}`,
        ].join('\n'),
        inline: false,
      });
    }

    // Send response
    await sendPublicSuccess(interaction, {
      embeds: [embed],
      files: [attachment],
    });

    logger.info(`Comparison completed: ${dyes.length} dyes`);
  } catch (error) {
    logger.error('Error executing comparison command:', error);
    const errorEmbed = createErrorEmbed(t('errors.commandError'), t('errors.errorComparingDyes'));

    await sendEphemeralError(interaction, { embeds: [errorEmbed] });
  }
}

/**
 * Calculate pairwise distances between all dyes
 */
function calculatePairwiseDistances(dyes: Dye[]): DyePair[] {
  const pairs: DyePair[] = [];

  for (let i = 0; i < dyes.length; i++) {
    for (let j = i + 1; j < dyes.length; j++) {
      const distance = ColorService.getColorDistance(dyes[i].hex, dyes[j].hex);
      pairs.push({
        dye1: dyes[i],
        dye2: dyes[j],
        distance,
      });
    }
  }

  return pairs;
}

/**
 * Get quality label for color distance
 */
function getQualityLabel(distance: number): string {
  if (distance === 0) return t('comparisonQuality.identical');
  if (distance < 10) return t('comparisonQuality.verySimilar');
  if (distance < 25) return t('comparisonQuality.similar');
  if (distance < 50) return t('comparisonQuality.somewhatDifferent');
  if (distance < 100) return t('comparisonQuality.different');
  return t('comparisonQuality.veryDifferent');
}

/**
 * Autocomplete handler for dye parameters
 */
export async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const focusedOption = interaction.options.getFocused(true);

  if (['dye1', 'dye2', 'dye3', 'dye4'].includes(focusedOption.name)) {
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

export const comparisonCommand: BotCommand = {
  data,
  execute,
  autocomplete,
};
