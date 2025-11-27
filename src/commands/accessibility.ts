/**
 * /accessibility command - Colorblind simulation for dyes
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
import {
  createErrorEmbed,
  formatColorSwatch,
  createDyeEmojiAttachment,
} from '../utils/embed-builder.js';
import {
  renderAccessibilityComparison,
  type VisionType,
} from '../renderers/accessibility-comparison.js';
import { logger } from '../utils/logger.js';
import { sendPublicSuccess, sendEphemeralError } from '../utils/response-helper.js';
import { t } from '../services/i18n-service.js';
import type { BotCommand } from '../types/index.js';

const dyeService = new DyeService(dyeDatabase);

export const data = new SlashCommandBuilder()
  .setName('accessibility')
  .setDescription('Simulate how a dye appears with colorblindness')
  .setDescriptionLocalizations({
    ja: '色覚特性による染料の見え方をシミュレート',
    de: 'Simulieren, wie ein Färbemittel bei Farbenblindheit erscheint',
    fr: "Simuler l'apparence d'une teinture avec daltonisme",
  })
  .addStringOption((option) =>
    option
      .setName('dye')
      .setDescription('Dye name or hex color (e.g., "Dalamud Red" or "#FF0000")')
      .setDescriptionLocalizations({
        ja: '染料名または16進数カラー（例：「ダラガブレッド」または「#FF0000」）',
        de: 'Färbemittelname oder Hex-Farbe (z.B. "Dalamud-Rot" oder "#FF0000")',
        fr: 'Nom de teinture ou couleur hex (ex. "Rouge Dalamud" ou "#FF0000")',
      })
      .setRequired(true)
      .setAutocomplete(true)
  )
  .addStringOption((option) =>
    option
      .setName('vision_type')
      .setDescription('Colorblind vision type (default: show all)')
      .setDescriptionLocalizations({
        ja: '色覚特性タイプ（デフォルト：全て表示）',
        de: 'Farbenblind-Typ (Standard: alle anzeigen)',
        fr: 'Type de daltonisme (par défaut : afficher tous)',
      })
      .setRequired(false)
      .addChoices(
        { name: 'All Types', value: 'all' },
        { name: 'Protanopia (Red-blind)', value: 'protanopia' },
        { name: 'Deuteranopia (Green-blind)', value: 'deuteranopia' },
        { name: 'Tritanopia (Blue-blind)', value: 'tritanopia' }
      )
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  try {
    const dyeInput = interaction.options.getString('dye', true);
    const visionTypeInput = interaction.options.getString('vision_type') || 'all';

    logger.info(`Accessibility command: ${dyeInput} (${visionTypeInput})`);

    // Parse dye input (hex or dye name)
    let dye: Dye;
    let inputHex: string;

    const hexValidation = validateHexColor(dyeInput);
    if (hexValidation.success) {
      // Input is hex - use normalized value and find closest dye
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
      dye = closestDye;
      inputHex = normalizedHex;
    } else {
      // Input is dye name
      const dyeResult = findDyeByName(dyeInput);
      if (dyeResult.error) {
        const errorEmbed = createErrorEmbed(
          t('errors.invalidInput'),
          t('errors.invalidColorOrDyeNameWithExamples', { input: dyeInput })
        );
        await sendEphemeralError(interaction, { embeds: [errorEmbed] });
        return;
      }
      dye = dyeResult.dye!;
      inputHex = dye.hex;
    }

    // Determine which vision types to show
    let visionTypes: VisionType[] | undefined;
    if (visionTypeInput !== 'all') {
      visionTypes = [visionTypeInput as VisionType];
    }

    // Render accessibility comparison
    const imageBuffer = await renderAccessibilityComparison({
      dyeHex: inputHex,
      dyeName: dye.name,
      visionTypes,
    });

    const attachment = new AttachmentBuilder(imageBuffer, {
      name: `accessibility_${dye.name.replace(/\s/g, '_')}.png`,
    });

    // Calculate simulated colors for embed
    const inputRgb = ColorService.hexToRgb(inputHex);
    const protanopiaRgb = ColorService.simulateColorblindness(inputRgb, 'protanopia');
    const deuteranopiaRgb = ColorService.simulateColorblindness(inputRgb, 'deuteranopia');
    const tritanopiaRgb = ColorService.simulateColorblindness(inputRgb, 'tritanopia');

    const protanopiaHex = ColorService.rgbToHex(protanopiaRgb.r, protanopiaRgb.g, protanopiaRgb.b);
    const deuteranopiaHex = ColorService.rgbToHex(
      deuteranopiaRgb.r,
      deuteranopiaRgb.g,
      deuteranopiaRgb.b
    );
    const tritanopiaHex = ColorService.rgbToHex(tritanopiaRgb.r, tritanopiaRgb.g, tritanopiaRgb.b);

    // Create embed
    const localizedDyeName = LocalizationService.getDyeName(dye.id) || dye.name;
    const localizedCategory = LocalizationService.getCategory(dye.category) || dye.category;

    const embed = new EmbedBuilder()
      .setColor(parseInt(inputHex.replace('#', ''), 16) as ColorResolvable)
      .setTitle(`♿ ${t('embeds.accessibilityTitle')}: ${localizedDyeName}`)
      .setDescription(
        `**${t('embeds.category')}:** ${localizedCategory}\n` +
          `**${t('embeds.originalHex')}:** ${inputHex.toUpperCase()}`
      )
      .setImage(`attachment://accessibility_${dye.name.replace(/\s/g, '_')}.png`)
      .setTimestamp();

    // Add vision type comparisons
    if (visionTypeInput === 'all' || visionTypeInput === 'protanopia') {
      embed.addFields({
        name: `🔴 ${t('embeds.protanopia')}`,
        value: [
          `${formatColorSwatch(protanopiaHex, 6)}`,
          `**${t('embeds.hex')}:** ${protanopiaHex.toUpperCase()}`,
          `**${t('embeds.affects')}:** ${t('embeds.protanopiaAffects')}`,
          `**${t('embeds.impact')}:** ${t('embeds.protanopiaImpact')}`,
        ].join('\n'),
        inline: true,
      });
    }

    if (visionTypeInput === 'all' || visionTypeInput === 'deuteranopia') {
      embed.addFields({
        name: `🟢 ${t('embeds.deuteranopia')}`,
        value: [
          `${formatColorSwatch(deuteranopiaHex, 6)}`,
          `**${t('embeds.hex')}:** ${deuteranopiaHex.toUpperCase()}`,
          `**${t('embeds.affects')}:** ${t('embeds.deuteranopiaAffects')}`,
          `**${t('embeds.impact')}:** ${t('embeds.deuteranopiaImpact')}`,
        ].join('\n'),
        inline: true,
      });
    }

    if (visionTypeInput === 'all' || visionTypeInput === 'tritanopia') {
      embed.addFields({
        name: `🔵 ${t('embeds.tritanopia')}`,
        value: [
          `${formatColorSwatch(tritanopiaHex, 6)}`,
          `**${t('embeds.hex')}:** ${tritanopiaHex.toUpperCase()}`,
          `**${t('embeds.affects')}:** ${t('embeds.tritanopiaAffects')}`,
          `**${t('embeds.impact')}:** ${t('embeds.tritanopiaImpact')}`,
        ].join('\n'),
        inline: true,
      });
    }

    // Add footer with info
    embed.addFields({
      name: `ℹ️ ${t('embeds.aboutCVD')}`,
      value: t('embeds.cvdDescription'),
      inline: false,
    });

    // Attach emoji if available
    const files = [attachment];
    const dyeEmoji = createDyeEmojiAttachment(dye);
    if (dyeEmoji) {
      files.push(dyeEmoji);
      embed.setThumbnail(`attachment://${dyeEmoji.name}`);
    }

    // Send response
    await sendPublicSuccess(interaction, {
      embeds: [embed],
      files,
    });

    logger.info(`Accessibility command completed: ${dye.name} (${visionTypeInput})`);
  } catch (error) {
    logger.error('Error executing accessibility command:', error);
    const errorEmbed = createErrorEmbed(
      t('errors.commandError'),
      t('errors.errorGeneratingAccessibility')
    );

    await sendEphemeralError(interaction, { embeds: [errorEmbed] });
  }
}

/**
 * Autocomplete handler for dye parameter
 */
export async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const focusedOption = interaction.options.getFocused(true);

  if (focusedOption.name === 'dye') {
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

export const accessibilityCommand: BotCommand = {
  data,
  execute,
  autocomplete,
};
