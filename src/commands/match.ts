/**
 * /match command - Find the closest dye to a given color
 * Per R-2: Refactored to extend CommandBase for standardized error handling
 */

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
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
import { formatColorSwatch, formatRGB, formatHSV } from '../utils/embed-builder.js';
import { emojiService } from '../services/emoji-service.js';
import { priceService } from '../services/price-service.js';
import { sendPublicSuccess } from '../utils/response-helper.js';
import { CommandBase } from './base/CommandBase.js';
import { t } from '../services/i18n-service.js';
import type { BotCommand } from '../types/index.js';

const dyeService = new DyeService(dyeDatabase);

/**
 * Match command class extending CommandBase
 * Per R-2: Uses template method pattern for error handling
 */
class MatchCommand extends CommandBase {
  readonly data = new SlashCommandBuilder()
    .setName('match')
    .setDescription('Find the closest FFXIV dye to a given color')
    .setDescriptionLocalizations({
      ja: '指定した色に最も近いFFXIVの染料を検索',
      de: 'Finde den nächsten FFXIV-Farbstoff zu einer gegebenen Farbe',
      fr: "Trouver la teinture FFXIV la plus proche d'une couleur donnée",
    })
    .addStringOption((option) =>
      option
        .setName('color')
        .setDescription('Color: hex (e.g., #FF0000) or dye name (e.g., Dalamud Red)')
        .setDescriptionLocalizations({
          ja: '色：16進数（例：#FF0000）または染料名（例：ダラガブレッド）',
          de: 'Farbe: Hex (z.B. #FF0000) oder Farbstoffname (z.B. Dalamud-Rot)',
          fr: 'Couleur : hex (ex. #FF0000) ou nom de teinture (ex. Rouge Dalamud)',
        })
        .setRequired(true)
        .setAutocomplete(true)
    );

  protected async executeCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const colorInput = interaction.options.getString('color', true);

    // Determine if input is hex or dye name
    let targetColor: string;
    let inputDye: Dye | null = null;

    const hexValidation = validateHexColor(colorInput);
    if (hexValidation.success) {
      // Input is a hex color - use normalized value
      targetColor = hexValidation.value;
    } else {
      // Input might be a dye name
      const dyeResult = findDyeByName(colorInput);
      if (dyeResult.error) {
        await this.handleError(
          interaction,
          new Error(`Invalid input: "${colorInput}" is not a valid hex color or dye name.`),
          'match'
        );
        return;
      }
      inputDye = dyeResult.dye!;
      targetColor = inputDye.hex;
    }

    // Find closest dye
    const closestDye = dyeService.findClosestDye(targetColor);
    if (!closestDye) {
      throw new Error('Could not find matching dye.');
    }

    // Calculate color distance
    const distance = ColorService.getColorDistance(targetColor, closestDye.hex);

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

    // Get localized dye name and category (with fallbacks)
    const localizedDyeName = LocalizationService.getDyeName(closestDye.id) || closestDye.name;
    const localizedCategory =
      LocalizationService.getCategory(closestDye.category) || closestDye.category;
    const localizedInputDyeName = inputDye
      ? LocalizationService.getDyeName(inputDye.id) || inputDye.name
      : null;

    // Create embed
    const embed = new EmbedBuilder()
      .setColor(parseInt(closestDye.hex.replace('#', ''), 16) as ColorResolvable)
      .setTitle(`${matchEmoji} ${t('embeds.dyeMatch')}: ${localizedDyeName}`)
      .setDescription(
        localizedInputDyeName
          ? `${t('embeds.findingClosestMatchFor')} **${localizedInputDyeName}**`
          : `${t('embeds.findingClosestMatchFor')} **${targetColor.toUpperCase()}**`
      )
      .addFields(
        {
          name: t('embeds.inputColor'),
          value: [
            formatColorSwatch(targetColor, 6),
            `**${t('embeds.hex')}:** ${targetColor.toUpperCase()}`,
            `**${t('embeds.rgb')}:** ${formatRGB(targetColor)}`,
            `**${t('embeds.hsv')}:** ${formatHSV(targetColor)}`,
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
      .setTimestamp();

    // Add acquisition info if available
    if (closestDye.acquisition) {
      const localizedAcquisition =
        LocalizationService.getAcquisition(closestDye.acquisition) || closestDye.acquisition;
      embed.addFields({
        name: t('embeds.acquisition'),
        value: localizedAcquisition,
        inline: true,
      });
    }

    // Fetch and add market price (non-blocking)
    try {
      const priceInfo = await priceService.getFormattedPrice(closestDye);
      embed.addFields({
        name: t('embeds.marketPrice'),
        value: priceInfo.available ? priceInfo.formatted : t('embeds.priceUnavailable'),
        inline: true,
      });
    } catch {
      // Price fetch failed, add unavailable message
      embed.addFields({
        name: t('embeds.marketPrice'),
        value: t('embeds.priceUnavailable'),
        inline: true,
      });
    }

    // Add emoji thumbnail if available
    const emoji = emojiService.getDyeEmoji(closestDye);
    if (emoji) {
      embed.setThumbnail(emoji.imageURL());
    }

    // Send response (public)
    await sendPublicSuccess(interaction, { embeds: [embed] });
  }

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focusedOption = interaction.options.getFocused(true);

    if (focusedOption.name === 'color') {
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
            value: dye.name, // Keep English name as value for lookup
          };
        });

      await interaction.respond(matches);
    }
  }
}

// Export singleton instance
const matchCommandInstance = new MatchCommand();
export const matchCommand: BotCommand = matchCommandInstance;
