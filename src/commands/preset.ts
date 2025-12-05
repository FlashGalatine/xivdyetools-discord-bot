/**
 * /preset command - Browse and view preset color palettes
 * Subcommands: list, show, random
 */

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  EmbedBuilder,
  AttachmentBuilder,
} from 'discord.js';
import {
  DyeService,
  PresetService,
  dyeDatabase,
  presetData,
  LocalizationService,
  type PresetPalette,
  type PresetCategory,
  type PresetData,
} from 'xivdyetools-core';
import { createErrorEmbed } from '../utils/embed-builder.js';
import { sendPublicSuccess, sendEphemeralError } from '../utils/response-helper.js';
import { renderPresetSwatch } from '../renderers/preset-swatch.js';
import { emojiService } from '../services/emoji-service.js';
import { logger } from '../utils/logger.js';
import { t } from '../services/i18n-service.js';
import { CommandBase } from './base/CommandBase.js';
import type { BotCommand } from '../types/index.js';

const dyeService = new DyeService(dyeDatabase);
const presetService = new PresetService(presetData as PresetData);

/**
 * Category choices for slash command
 */
const categoryChoices = [
  { name: '⚔️ FFXIV Jobs', value: 'jobs' },
  { name: '🏛️ Grand Companies', value: 'grand-companies' },
  { name: '🍂 Seasons', value: 'seasons' },
  { name: '🎉 FFXIV Events', value: 'events' },
  { name: '🎨 Aesthetics', value: 'aesthetics' },
];

/**
 * Preset command class extending CommandBase
 */
class PresetCommand extends CommandBase {
  readonly data = new SlashCommandBuilder()
    .setName('preset')
    .setDescription('Browse preset color palettes for glamours')
    .setDescriptionLocalizations({
      ja: 'グラマー用のプリセットカラーパレットを閲覧',
      de: 'Voreingestellte Farbpaletten für Glamours durchsuchen',
      fr: 'Parcourir les palettes de couleurs prédéfinies pour les glamours',
    })
    .addSubcommand((subcommand) =>
      subcommand
        .setName('list')
        .setDescription('List available presets by category')
        .setDescriptionLocalizations({
          ja: 'カテゴリ別にプリセットを一覧表示',
          de: 'Verfügbare Voreinstellungen nach Kategorie auflisten',
          fr: 'Lister les préréglages disponibles par catégorie',
        })
        .addStringOption((option) =>
          option
            .setName('category')
            .setDescription('Filter by category')
            .setDescriptionLocalizations({
              ja: 'カテゴリでフィルター',
              de: 'Nach Kategorie filtern',
              fr: 'Filtrer par catégorie',
            })
            .setRequired(false)
            .addChoices(...categoryChoices)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('show')
        .setDescription('Show a specific preset palette')
        .setDescriptionLocalizations({
          ja: '特定のプリセットパレットを表示',
          de: 'Eine bestimmte Voreinstellung anzeigen',
          fr: 'Afficher une palette prédéfinie spécifique',
        })
        .addStringOption((option) =>
          option
            .setName('name')
            .setDescription('Preset name')
            .setDescriptionLocalizations({
              ja: 'プリセット名',
              de: 'Voreinstellungsname',
              fr: 'Nom du préréglage',
            })
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('random')
        .setDescription('Get a random preset for inspiration')
        .setDescriptionLocalizations({
          ja: 'インスピレーション用にランダムなプリセットを取得',
          de: 'Zufällige Voreinstellung zur Inspiration',
          fr: 'Obtenir un préréglage aléatoire pour inspiration',
        })
        .addStringOption((option) =>
          option
            .setName('category')
            .setDescription('Filter by category (optional)')
            .setDescriptionLocalizations({
              ja: 'カテゴリでフィルター（オプション）',
              de: 'Nach Kategorie filtern (optional)',
              fr: 'Filtrer par catégorie (optionnel)',
            })
            .setRequired(false)
            .addChoices(...categoryChoices)
        )
    ) as SlashCommandBuilder;

  /**
   * Execute the command
   */
  protected async executeCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'list':
        await this.handleList(interaction);
        break;
      case 'show':
        await this.handleShow(interaction);
        break;
      case 'random':
        await this.handleRandom(interaction);
        break;
      default: {
        const errorEmbed = createErrorEmbed(
          t('errors.unknownSubcommand'),
          t('errors.invalidSubcommand')
        );
        await sendEphemeralError(interaction, { embeds: [errorEmbed] });
      }
    }
  }

  /**
   * Handle /preset list [category]
   */
  private async handleList(interaction: ChatInputCommandInteraction): Promise<void> {
    const category = interaction.options.getString('category') as PresetCategory | null;

    logger.info(`Preset list: category=${category || 'all'}`);

    const presets = category
      ? presetService.getPresetsByCategory(category)
      : presetService.getAllPresets();

    if (presets.length === 0) {
      const errorEmbed = createErrorEmbed(t('presets.notFound'), t('presets.noneInCategory'));
      await sendEphemeralError(interaction, { embeds: [errorEmbed] });
      return;
    }

    // Group by category if showing all
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`🎨 ${t('presets.title')}`)
      .setTimestamp();

    if (category) {
      // Single category
      const categoryMeta = presetService.getCategoryMeta(category);
      embed.setDescription(
        `${categoryMeta?.icon || '📁'} **${categoryMeta?.name || category}**\n${categoryMeta?.description || ''}`
      );

      const presetList = presets.map((p) => `• **${p.name}** - ${p.description}`).join('\n');
      embed.addFields({
        name: `${t('presets.available')} (${presets.length})`,
        value: presetList.substring(0, 1024), // Discord field limit
        inline: false,
      });
    } else {
      // All categories
      const categories = presetService.getCategories();
      embed.setDescription(t('presets.browseDescription'));

      for (const cat of categories) {
        const catPresets = presetService.getPresetsByCategory(cat.id as PresetCategory);
        const presetNames = catPresets
          .slice(0, 5)
          .map((p) => p.name)
          .join(', ');
        const more = catPresets.length > 5 ? ` +${catPresets.length - 5} more` : '';

        embed.addFields({
          name: `${cat.icon || '📁'} ${cat.name} (${catPresets.length})`,
          value: `${presetNames}${more}`,
          inline: false,
        });
      }
    }

    embed.setFooter({ text: t('presets.useShowTip') });

    await sendPublicSuccess(interaction, { embeds: [embed] });
  }

  /**
   * Handle /preset show <name>
   */
  private async handleShow(interaction: ChatInputCommandInteraction): Promise<void> {
    const presetName = interaction.options.getString('name', true);

    logger.info(`Preset show: ${presetName}`);

    // Find preset by ID or name
    let preset = presetService.getPreset(presetName);
    if (!preset) {
      // Try searching by name
      const results = presetService.searchPresets(presetName);
      preset = results[0];
    }

    if (!preset) {
      const errorEmbed = createErrorEmbed(
        t('presets.notFound'),
        t('presets.couldNotFind', { name: presetName })
      );
      await sendEphemeralError(interaction, { embeds: [errorEmbed] });
      return;
    }

    // Render and send the preset
    await this.sendPresetEmbed(interaction, preset);
  }

  /**
   * Handle /preset random [category]
   */
  private async handleRandom(interaction: ChatInputCommandInteraction): Promise<void> {
    const category = interaction.options.getString('category') as PresetCategory | null;

    logger.info(`Preset random: category=${category || 'all'}`);

    const preset = category
      ? presetService.getRandomPreset(category)
      : presetService.getRandomPreset();

    if (!preset) {
      const errorEmbed = createErrorEmbed(t('presets.notFound'), t('presets.noneAvailable'));
      await sendEphemeralError(interaction, { embeds: [errorEmbed] });
      return;
    }

    await this.sendPresetEmbed(interaction, preset, true);
  }

  /**
   * Send a preset as an embed with swatch image
   */
  private async sendPresetEmbed(
    interaction: ChatInputCommandInteraction,
    preset: PresetPalette,
    isRandom = false
  ): Promise<void> {
    // Resolve dyes
    const resolvedDyes = preset.dyes.map((dyeId) => dyeService.getDyeById(dyeId));
    const validDyes = resolvedDyes.filter((d) => d !== null);

    // Get category meta
    const categoryMeta = presetService.getCategoryMeta(preset.category);

    // Build embed
    const embed = new EmbedBuilder()
      .setColor(validDyes.length > 0 ? parseInt(validDyes[0].hex.replace('#', ''), 16) : 0x5865f2)
      .setTitle(`${isRandom ? '🎲 ' : ''}${categoryMeta?.icon || '🎨'} ${preset.name}`)
      .setDescription(preset.description)
      .setTimestamp();

    // Add dye list with emojis
    const dyeList = validDyes
      .map((dye) => {
        const localizedName = LocalizationService.getDyeName(dye.id) || dye.name;
        return `${emojiService.getDyeEmojiOrSwatch(dye, 3)} **${localizedName}** (${dye.hex.toUpperCase()})`;
      })
      .join('\n');

    embed.addFields({
      name: t('presets.colors'),
      value: dyeList || t('presets.noDyes'),
      inline: false,
    });

    // Add tags
    if (preset.tags.length > 0) {
      embed.addFields({
        name: t('presets.tags'),
        value: preset.tags.map((tag) => `\`${tag}\``).join(' '),
        inline: false,
      });
    }

    // Render swatch image
    try {
      const swatchBuffer = renderPresetSwatch({
        preset,
        categoryMeta,
        dyes: resolvedDyes,
      });

      const attachment = new AttachmentBuilder(swatchBuffer, {
        name: `preset_${preset.id}.png`,
      });

      embed.setImage(`attachment://preset_${preset.id}.png`);

      await sendPublicSuccess(interaction, {
        embeds: [embed],
        files: [attachment],
      });
    } catch (error) {
      logger.error('Failed to render preset swatch:', error);
      // Send without image
      await sendPublicSuccess(interaction, { embeds: [embed] });
    }
  }

  /**
   * Autocomplete handler for preset names
   */
  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focusedOption = interaction.options.getFocused(true);

    if (focusedOption.name === 'name') {
      const query = focusedOption.value.toLowerCase();

      // Get all presets and filter
      const allPresets = presetService.getAllPresets();
      const matches = allPresets
        .filter(
          (p) =>
            p.name.toLowerCase().includes(query) ||
            p.id.toLowerCase().includes(query) ||
            p.tags.some((tag) => tag.toLowerCase().includes(query))
        )
        .slice(0, 25)
        .map((p) => {
          const categoryMeta = presetService.getCategoryMeta(p.category);
          return {
            name: `${categoryMeta?.icon || '🎨'} ${p.name}`,
            value: p.id,
          };
        });

      await interaction.respond(matches);
    }
  }
}

// Create instance
const presetCommandInstance = new PresetCommand();

// Export as BotCommand interface
export const presetCommand: BotCommand = {
  data: presetCommandInstance.data,
  execute: (interaction) => presetCommandInstance.execute(interaction),
  autocomplete: (interaction) => presetCommandInstance.autocomplete(interaction),
};
