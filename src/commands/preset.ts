/**
 * /preset command - Browse and view preset color palettes
 * Subcommands: list, show, random, submit, vote
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
  type Dye,
} from 'xivdyetools-core';
import { createErrorEmbed } from '../utils/embed-builder.js';
import { sendPublicSuccess, sendEphemeralError } from '../utils/response-helper.js';
import { renderPresetSwatch } from '../renderers/preset-swatch.js';
import { emojiService } from '../services/emoji-service.js';
import { logger } from '../utils/logger.js';
import { t } from '../services/i18n-service.js';
import { CommandBase } from './base/CommandBase.js';
import type { BotCommand } from '../types/index.js';
import { presetAPIService } from '../services/preset-api-service.js';

const dyeService = new DyeService(dyeDatabase);
const presetService = new PresetService(presetData as PresetData);

/**
 * Category choices for slash command (curated only - for listing)
 */
const categoryChoices = [
  { name: '⚔️ FFXIV Jobs', value: 'jobs' },
  { name: '🏛️ Grand Companies', value: 'grand-companies' },
  { name: '🍂 Seasons', value: 'seasons' },
  { name: '🎉 FFXIV Events', value: 'events' },
  { name: '🎨 Aesthetics', value: 'aesthetics' },
];

/**
 * Category choices for submissions (includes community)
 */
const submitCategoryChoices = [...categoryChoices, { name: '🌐 Community', value: 'community' }];

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
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('submit')
        .setDescription('Submit a new community preset palette')
        .setDescriptionLocalizations({
          ja: 'コミュニティプリセットパレットを投稿',
          de: 'Ein neues Community-Farbschema einreichen',
          fr: 'Soumettre une nouvelle palette communautaire',
        })
        .addStringOption((option) =>
          option
            .setName('preset_name')
            .setDescription('Name for your preset (2-50 characters)')
            .setDescriptionLocalizations({
              ja: 'プリセット名（2〜50文字）',
              de: 'Name für Ihre Voreinstellung (2-50 Zeichen)',
              fr: 'Nom de votre préréglage (2-50 caractères)',
            })
            .setRequired(true)
            .setMinLength(2)
            .setMaxLength(50)
        )
        .addStringOption((option) =>
          option
            .setName('description')
            .setDescription('Description of your preset (10-200 characters)')
            .setDescriptionLocalizations({
              ja: '説明（10〜200文字）',
              de: 'Beschreibung (10-200 Zeichen)',
              fr: 'Description (10-200 caractères)',
            })
            .setRequired(true)
            .setMinLength(10)
            .setMaxLength(200)
        )
        .addStringOption((option) =>
          option
            .setName('submit_category')
            .setDescription('Category for your preset')
            .setDescriptionLocalizations({
              ja: 'カテゴリ',
              de: 'Kategorie',
              fr: 'Catégorie',
            })
            .setRequired(true)
            .addChoices(...submitCategoryChoices)
        )
        .addStringOption((option) =>
          option
            .setName('dye1')
            .setDescription('First dye (required)')
            .setDescriptionLocalizations({
              ja: '1番目の染料（必須）',
              de: 'Erste Farbe (erforderlich)',
              fr: 'Première teinture (obligatoire)',
            })
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName('dye2')
            .setDescription('Second dye (required)')
            .setDescriptionLocalizations({
              ja: '2番目の染料（必須）',
              de: 'Zweite Farbe (erforderlich)',
              fr: 'Deuxième teinture (obligatoire)',
            })
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName('dye3')
            .setDescription('Third dye (optional)')
            .setDescriptionLocalizations({
              ja: '3番目の染料（オプション）',
              de: 'Dritte Farbe (optional)',
              fr: 'Troisième teinture (optionnel)',
            })
            .setRequired(false)
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName('dye4')
            .setDescription('Fourth dye (optional)')
            .setDescriptionLocalizations({
              ja: '4番目の染料（オプション）',
              de: 'Vierte Farbe (optional)',
              fr: 'Quatrième teinture (optionnel)',
            })
            .setRequired(false)
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName('dye5')
            .setDescription('Fifth dye (optional)')
            .setDescriptionLocalizations({
              ja: '5番目の染料（オプション）',
              de: 'Fünfte Farbe (optional)',
              fr: 'Cinquième teinture (optionnel)',
            })
            .setRequired(false)
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName('tags')
            .setDescription('Tags (comma-separated, max 10)')
            .setDescriptionLocalizations({
              ja: 'タグ（カンマ区切り、最大10個）',
              de: 'Tags (kommagetrennt, max 10)',
              fr: 'Tags (séparés par des virgules, max 10)',
            })
            .setRequired(false)
            .setMaxLength(200)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('vote')
        .setDescription('Vote for a community preset')
        .setDescriptionLocalizations({
          ja: 'コミュニティプリセットに投票',
          de: 'Für eine Community-Voreinstellung abstimmen',
          fr: 'Voter pour un préréglage communautaire',
        })
        .addStringOption((option) =>
          option
            .setName('preset')
            .setDescription('Preset to vote for')
            .setDescriptionLocalizations({
              ja: '投票するプリセット',
              de: 'Voreinstellung für Abstimmung',
              fr: 'Préréglage pour voter',
            })
            .setRequired(true)
            .setAutocomplete(true)
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
      case 'submit':
        await this.handleSubmit(interaction);
        break;
      case 'vote':
        await this.handleVote(interaction);
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
   * Handle /preset submit
   * Submit a new community preset palette
   */
  private async handleSubmit(interaction: ChatInputCommandInteraction): Promise<void> {
    // Check if community presets are enabled
    if (!presetAPIService.isEnabled()) {
      const errorEmbed = createErrorEmbed(
        'Feature Disabled',
        'Community presets are not enabled on this bot. Please contact the bot administrator.'
      );
      await sendEphemeralError(interaction, { embeds: [errorEmbed] });
      return;
    }

    // Get form values
    const presetName = interaction.options.getString('preset_name', true);
    const description = interaction.options.getString('description', true);
    const category = interaction.options.getString('submit_category', true) as PresetCategory;
    const tagsInput = interaction.options.getString('tags') || '';

    // Get dye selections (dye1 and dye2 are required)
    const dye1Id = interaction.options.getString('dye1', true);
    const dye2Id = interaction.options.getString('dye2', true);
    const dye3Id = interaction.options.getString('dye3');
    const dye4Id = interaction.options.getString('dye4');
    const dye5Id = interaction.options.getString('dye5');

    // Parse tags
    const tags = tagsInput
      .split(',')
      .map((tag) => tag.trim().toLowerCase())
      .filter((tag) => tag.length > 0)
      .slice(0, 10); // Max 10 tags

    // Resolve dye IDs to actual dye objects for validation
    const dyeIds = [dye1Id, dye2Id, dye3Id, dye4Id, dye5Id].filter(
      (id): id is string => id !== null
    );
    const resolvedDyes: (Dye | null)[] = dyeIds.map((id) => {
      // Try parsing as number (dye ID)
      const numId = parseInt(id, 10);
      if (!isNaN(numId)) {
        return dyeService.getDyeById(numId);
      }
      // Try searching by name
      const results = dyeService.searchByName(id);
      return results.length > 0 ? results[0] : null;
    });

    // Check for invalid dyes
    const invalidDyes = resolvedDyes.filter((d) => d === null);
    if (invalidDyes.length > 0) {
      const errorEmbed = createErrorEmbed(
        'Invalid Dye Selection',
        'One or more dyes could not be found. Please use the autocomplete suggestions.'
      );
      await sendEphemeralError(interaction, { embeds: [errorEmbed] });
      return;
    }

    // Get valid dye IDs
    const validDyeIds = resolvedDyes.filter((d): d is Dye => d !== null).map((d) => d.id);

    // Ensure at least 2 dyes
    if (validDyeIds.length < 2) {
      const errorEmbed = createErrorEmbed(
        'Not Enough Dyes',
        'Please select at least 2 dyes for your preset.'
      );
      await sendEphemeralError(interaction, { embeds: [errorEmbed] });
      return;
    }

    logger.info(
      `Preset submit: name="${presetName}", category=${category}, dyes=${validDyeIds.join(',')}, user=${interaction.user.id}`
    );

    try {
      // Submit to API
      const response = await presetAPIService.submitPreset(
        {
          name: presetName,
          description,
          category_id: category,
          dyes: validDyeIds,
          tags,
        },
        interaction.user.id,
        interaction.user.username
      );

      // Handle duplicate
      if (response.duplicate) {
        const duplicateEmbed = new EmbedBuilder()
          .setColor(0xffa500) // Orange
          .setTitle('🔄 Similar Preset Exists')
          .setDescription(
            `A preset with these dyes already exists: **${response.duplicate.name}**\n\n` +
              (response.vote_added
                ? '✅ Your vote has been added to the existing preset!'
                : 'You can vote for it using `/preset vote`.')
          )
          .setTimestamp();

        await interaction.reply({ embeds: [duplicateEmbed], ephemeral: true });
        return;
      }

      // Success
      if (response.preset) {
        const statusMessage =
          response.moderation_status === 'approved'
            ? '✅ Your preset has been automatically approved and is now live!'
            : '⏳ Your preset has been submitted for review. A moderator will approve it soon.';

        const successEmbed = new EmbedBuilder()
          .setColor(0x57f287) // Green
          .setTitle('🎨 Preset Submitted!')
          .setDescription(`**${response.preset.name}**\n\n${statusMessage}`)
          .addFields(
            { name: 'Category', value: category, inline: true },
            { name: 'Dyes', value: String(validDyeIds.length), inline: true }
          )
          .setTimestamp();

        if (tags.length > 0) {
          successEmbed.addFields({
            name: 'Tags',
            value: tags.map((t) => `\`${t}\``).join(' '),
            inline: false,
          });
        }

        await interaction.reply({ embeds: [successEmbed], ephemeral: true });
      }
    } catch (error) {
      logger.error('Failed to submit preset:', error);

      const errorMessage =
        error instanceof Error ? error.message : 'Failed to submit preset. Please try again later.';

      const errorEmbed = createErrorEmbed('Submission Failed', errorMessage);
      await sendEphemeralError(interaction, { embeds: [errorEmbed] });
    }
  }

  /**
   * Handle /preset vote
   * Vote for a community preset
   */
  private async handleVote(interaction: ChatInputCommandInteraction): Promise<void> {
    // Check if community presets are enabled
    if (!presetAPIService.isEnabled()) {
      const errorEmbed = createErrorEmbed(
        'Feature Disabled',
        'Community presets are not enabled on this bot. Please contact the bot administrator.'
      );
      await sendEphemeralError(interaction, { embeds: [errorEmbed] });
      return;
    }

    const presetId = interaction.options.getString('preset', true);

    logger.info(`Preset vote: presetId=${presetId}, user=${interaction.user.id}`);

    try {
      // Check if user already voted
      const hasVoted = await presetAPIService.hasVoted(presetId, interaction.user.id);

      if (hasVoted) {
        // Remove vote (toggle behavior)
        const response = await presetAPIService.removeVote(presetId, interaction.user.id);

        const embed = new EmbedBuilder()
          .setColor(0xffa500) // Orange
          .setTitle('🗳️ Vote Removed')
          .setDescription(
            `Your vote has been removed.\n\nCurrent votes: **${response.new_vote_count}**`
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
      } else {
        // Add vote
        const response = await presetAPIService.voteForPreset(presetId, interaction.user.id);

        const embed = new EmbedBuilder()
          .setColor(0x57f287) // Green
          .setTitle('🗳️ Vote Added!')
          .setDescription(`Thank you for voting!\n\nCurrent votes: **${response.new_vote_count}**`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
      }
    } catch (error) {
      logger.error('Failed to vote:', error);

      const errorMessage =
        error instanceof Error ? error.message : 'Failed to process vote. Please try again later.';

      const errorEmbed = createErrorEmbed('Vote Failed', errorMessage);
      await sendEphemeralError(interaction, { embeds: [errorEmbed] });
    }
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
   * Autocomplete handler for preset names, dyes, and community presets
   */
  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focusedOption = interaction.options.getFocused(true);
    const subcommand = interaction.options.getSubcommand();

    // Handle dye autocomplete for submit subcommand
    if (
      subcommand === 'submit' &&
      ['dye1', 'dye2', 'dye3', 'dye4', 'dye5'].includes(focusedOption.name)
    ) {
      await this.handleDyeAutocomplete(interaction, focusedOption.value);
      return;
    }

    // Handle community preset autocomplete for vote subcommand
    if (subcommand === 'vote' && focusedOption.name === 'preset') {
      await this.handleCommunityPresetAutocomplete(interaction, focusedOption.value);
      return;
    }

    // Handle preset name autocomplete for show subcommand
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

  /**
   * Handle dye name autocomplete for submit command
   */
  private async handleDyeAutocomplete(
    interaction: AutocompleteInteraction,
    query: string
  ): Promise<void> {
    const searchTerm = query.toLowerCase().trim();

    // Get matching dyes from the database
    let matches: Dye[];
    if (searchTerm.length === 0) {
      // Show popular/common dyes if no query
      matches = dyeService.getAllDyes().slice(0, 25);
    } else {
      matches = dyeService.searchByName(searchTerm).slice(0, 25);
    }

    // Format for Discord autocomplete
    const choices = matches.map((dye) => {
      const localizedName = LocalizationService.getDyeName(dye.id) || dye.name;
      const displayName = `${localizedName} (${dye.hex.toUpperCase()})`;
      return {
        name: displayName.substring(0, 100), // Discord limit
        value: String(dye.id),
      };
    });

    await interaction.respond(choices);
  }

  /**
   * Handle community preset autocomplete for vote command
   */
  private async handleCommunityPresetAutocomplete(
    interaction: AutocompleteInteraction,
    query: string
  ): Promise<void> {
    // If API not enabled, fall back to local presets
    if (!presetAPIService.isEnabled()) {
      const allPresets = presetService.getAllPresets();
      const matches = allPresets
        .filter(
          (p) =>
            p.name.toLowerCase().includes(query.toLowerCase()) ||
            p.tags.some((tag) => tag.toLowerCase().includes(query.toLowerCase()))
        )
        .slice(0, 25)
        .map((p) => ({
          name: `${p.name}`,
          value: p.id,
        }));

      await interaction.respond(matches);
      return;
    }

    try {
      // Search community presets from API
      const response = await presetAPIService.getPresets({
        search: query || undefined,
        status: 'approved',
        limit: 25,
        sort: query ? undefined : 'popular', // Sort by popular if no search term
      });

      const choices = response.presets.map((preset) => {
        const voteCount = preset.vote_count > 0 ? ` (${preset.vote_count}★)` : '';
        const displayName = `${preset.name}${voteCount}`;
        return {
          name: displayName.substring(0, 100), // Discord limit
          value: preset.id,
        };
      });

      await interaction.respond(choices);
    } catch (error) {
      logger.error('Failed to fetch community presets for autocomplete:', error);

      // Fall back to local presets on error
      const allPresets = presetService.getAllPresets();
      const matches = allPresets
        .filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 25)
        .map((p) => ({
          name: p.name,
          value: p.id,
        }));

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
