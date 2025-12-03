/**
 * /accessibility command - Colorblind simulation for dyes
 * Per R-2: Refactored to extend CommandBase for standardized error handling
 * Supports 1-4 dyes: single dye shows contrast vs white/black,
 * multiple dyes show a pairwise contrast matrix
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
import { renderContrastMatrix, calculateContrast } from '../renderers/accessibility-matrix.js';
import { logger } from '../utils/logger.js';
import { sendPublicSuccess, sendEphemeralError } from '../utils/response-helper.js';
import { t } from '../services/i18n-service.js';
import { CommandBase } from './base/CommandBase.js';
import type { BotCommand } from '../types/index.js';

const dyeService = new DyeService(dyeDatabase);

/**
 * Accessibility command class extending CommandBase
 * Per R-2: Uses template method pattern for error handling
 */
class AccessibilityCommand extends CommandBase {
  readonly data = new SlashCommandBuilder()
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
        .setName('dye2')
        .setDescription('Second dye (optional): hex or dye name for contrast comparison')
        .setDescriptionLocalizations({
          ja: '2番目の染料（任意）：コントラスト比較用の16進数または染料名',
          de: 'Zweiter Farbstoff (optional): Hex oder Name für Kontrastvergleich',
          fr: 'Deuxième teinture (optionnel) : hex ou nom pour comparaison de contraste',
        })
        .setRequired(false)
        .setAutocomplete(true)
    )
    .addStringOption((option) =>
      option
        .setName('dye3')
        .setDescription('Third dye (optional): hex or dye name for contrast comparison')
        .setDescriptionLocalizations({
          ja: '3番目の染料（任意）：コントラスト比較用の16進数または染料名',
          de: 'Dritter Farbstoff (optional): Hex oder Name für Kontrastvergleich',
          fr: 'Troisième teinture (optionnel) : hex ou nom pour comparaison de contraste',
        })
        .setRequired(false)
        .setAutocomplete(true)
    )
    .addStringOption((option) =>
      option
        .setName('dye4')
        .setDescription('Fourth dye (optional): hex or dye name for contrast comparison')
        .setDescriptionLocalizations({
          ja: '4番目の染料（任意）：コントラスト比較用の16進数または染料名',
          de: 'Vierter Farbstoff (optional): Hex oder Name für Kontrastvergleich',
          fr: 'Quatrième teinture (optionnel) : hex ou nom pour comparaison de contraste',
        })
        .setRequired(false)
        .setAutocomplete(true)
    )
    .addStringOption((option) =>
      option
        .setName('vision_type')
        .setDescription('Colorblind vision type (default: show all) - only for single dye')
        .setDescriptionLocalizations({
          ja: '色覚特性タイプ（デフォルト：全て表示）- 単一染料のみ',
          de: 'Farbenblind-Typ (Standard: alle anzeigen) - nur für einzelne Farbstoffe',
          fr: 'Type de daltonisme (par défaut : afficher tous) - uniquement pour une seule teinture',
        })
        .setRequired(false)
        .addChoices(
          { name: 'All Types', value: 'all' },
          { name: 'Protanopia (Red-blind)', value: 'protanopia' },
          { name: 'Deuteranopia (Green-blind)', value: 'deuteranopia' },
          { name: 'Tritanopia (Blue-blind)', value: 'tritanopia' }
        )
    );

  protected async executeCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    // Collect all dye inputs
    const dyeInputs = [
      interaction.options.getString('dye', true),
      interaction.options.getString('dye2'),
      interaction.options.getString('dye3'),
      interaction.options.getString('dye4'),
    ].filter((input): input is string => input !== null);

    const visionTypeInput = interaction.options.getString('vision_type') || 'all';

    logger.info(`Accessibility command: ${dyeInputs.join(', ')} (${visionTypeInput})`);

    // Parse all dye inputs
    const dyes: Dye[] = [];
    const dyeHexes: string[] = [];

    for (const input of dyeInputs) {
      const hexValidation = validateHexColor(input);
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
        dyes.push(closestDye);
        dyeHexes.push(normalizedHex);
      } else {
        // Input is dye name
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
        dyeHexes.push(dyeResult.dye!.hex);
      }
    }

    // Branch based on number of dyes
    if (dyes.length === 1) {
      await this.executeSingleDyeAccessibility(interaction, dyes[0], dyeHexes[0], visionTypeInput);
    } else {
      await this.executeMultiDyeContrast(interaction, dyes, dyeHexes);
    }
  }

  /**
   * Execute single dye accessibility view with colorblind simulation
   * and contrast scores vs white/black
   */
  private async executeSingleDyeAccessibility(
    interaction: ChatInputCommandInteraction,
    dye: Dye,
    inputHex: string,
    visionTypeInput: string
  ): Promise<void> {
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

    // Calculate contrast ratios vs white and black
    const contrastVsWhite = calculateContrast(inputHex, '#FFFFFF');
    const contrastVsBlack = calculateContrast(inputHex, '#000000');

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

    // Add contrast scores field
    embed.addFields({
      name: `📊 ${t('embeds.contrastScores')}`,
      value: [
        `**${t('embeds.vsWhite')}:** ${contrastVsWhite.ratio.toFixed(2)}:1 ${this.getWCAGBadge(contrastVsWhite.level)}`,
        `**${t('embeds.vsBlack')}:** ${contrastVsBlack.ratio.toFixed(2)}:1 ${this.getWCAGBadge(contrastVsBlack.level)}`,
      ].join('\n'),
      inline: false,
    });

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
  }

  /**
   * Execute multi-dye contrast comparison with matrix view
   */
  private async executeMultiDyeContrast(
    interaction: ChatInputCommandInteraction,
    dyes: Dye[],
    dyeHexes: string[]
  ): Promise<void> {
    // Build dye data for matrix
    const dyeData = dyes.map((dye, index) => ({
      name: LocalizationService.getDyeName(dye.id) || dye.name,
      hex: dyeHexes[index],
    }));

    // Render contrast matrix
    const matrixBuffer = renderContrastMatrix({
      dyes: dyeData,
      title: t('embeds.contrastMatrix'),
    });

    const attachment = new AttachmentBuilder(matrixBuffer, {
      name: `contrast_matrix_${dyes.length}dyes.png`,
    });

    // Create embed
    const embed = new EmbedBuilder()
      .setColor(parseInt(dyeHexes[0].replace('#', ''), 16) as ColorResolvable)
      .setTitle(
        `♿ ${t('embeds.contrastComparison')} (${dyes.length} ${dyes.length === 1 ? t('labels.dye') : t('labels.dyes')})`
      )
      .setDescription(t('embeds.contrastMatrixDescription'))
      .setImage(`attachment://contrast_matrix_${dyes.length}dyes.png`)
      .setTimestamp();

    // Add individual dye info fields
    dyes.forEach((dye, index) => {
      const emoji = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'][index] || `${index + 1}.`;
      const localizedName = LocalizationService.getDyeName(dye.id) || dye.name;
      const localizedCategory = LocalizationService.getCategory(dye.category) || dye.category;

      // Calculate contrast vs white and black
      const hex = dyeHexes[index];
      const vsWhite = calculateContrast(hex, '#FFFFFF');
      const vsBlack = calculateContrast(hex, '#000000');

      embed.addFields({
        name: `${emoji} ${localizedName}`,
        value: [
          `**${t('embeds.hex')}:** ${hex.toUpperCase()}`,
          `**${t('embeds.category')}:** ${localizedCategory}`,
          `**${t('embeds.vsWhite')}:** ${vsWhite.ratio.toFixed(2)}:1 ${this.getWCAGBadge(vsWhite.level)}`,
          `**${t('embeds.vsBlack')}:** ${vsBlack.ratio.toFixed(2)}:1 ${this.getWCAGBadge(vsBlack.level)}`,
        ].join('\n'),
        inline: true,
      });
    });

    // Add WCAG legend
    embed.addFields({
      name: `ℹ️ ${t('embeds.wcagLegend')}`,
      value: [
        `🟢 **AAA** - ${t('embeds.wcagAAA')}`,
        `🟡 **AA** - ${t('embeds.wcagAA')}`,
        `🔴 **${t('embeds.fail')}** - ${t('embeds.wcagFail')}`,
      ].join('\n'),
      inline: false,
    });

    // Send response
    await sendPublicSuccess(interaction, {
      embeds: [embed],
      files: [attachment],
    });

    logger.info(`Contrast matrix completed: ${dyes.length} dyes`);
  }

  /**
   * Get emoji badge for WCAG level
   */
  private getWCAGBadge(level: 'AAA' | 'AA' | 'Fail'): string {
    switch (level) {
      case 'AAA':
        return '🟢 AAA';
      case 'AA':
        return '🟡 AA';
      case 'Fail':
        return '🔴 Fail';
    }
  }

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focusedOption = interaction.options.getFocused(true);

    if (['dye', 'dye2', 'dye3', 'dye4'].includes(focusedOption.name)) {
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
}

// Export singleton instance
const accessibilityCommandInstance = new AccessibilityCommand();
export const accessibilityCommand: BotCommand = accessibilityCommandInstance;

// Keep backward-compatible exports for existing code
export const data = accessibilityCommandInstance.data;
export const execute = accessibilityCommandInstance.execute.bind(accessibilityCommandInstance);
export const autocomplete = accessibilityCommandInstance.autocomplete.bind(
  accessibilityCommandInstance
);
