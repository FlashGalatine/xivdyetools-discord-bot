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
  TextChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  ComponentType,
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
import { presetAPIService, type CommunityPreset } from '../services/preset-api-service.js';
import { config } from '../config.js';

const dyeService = new DyeService(dyeDatabase);
const presetService = new PresetService(presetData as PresetData);

/**
 * Category choices for slash command (curated + community)
 */
const categoryChoices = [
  { name: '⚔️ FFXIV Jobs', value: 'jobs' },
  { name: '🏛️ Grand Companies', value: 'grand-companies' },
  { name: '🍂 Seasons', value: 'seasons' },
  { name: '🎉 FFXIV Events', value: 'events' },
  { name: '🎨 Aesthetics', value: 'aesthetics' },
  { name: '🌐 Community', value: 'community' },
];

/**
 * Category choices for submissions (same as categoryChoices)
 */
const submitCategoryChoices = categoryChoices;

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
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('moderate')
        .setDescription('[Moderators] Manage community preset submissions')
        .addStringOption((option) =>
          option
            .setName('action')
            .setDescription('Moderation action to perform')
            .setRequired(true)
            .addChoices(
              { name: '📋 View Pending Queue', value: 'pending' },
              { name: '✅ Approve Preset', value: 'approve' },
              { name: '❌ Reject Preset', value: 'reject' },
              { name: '📊 View Statistics', value: 'stats' }
            )
        )
        .addStringOption((option) =>
          option
            .setName('preset_id')
            .setDescription('Preset ID (for approve/reject)')
            .setRequired(false)
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName('reason')
            .setDescription('Reason for rejection (required for reject)')
            .setRequired(false)
            .setMaxLength(500)
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
      case 'moderate':
        await this.handleModerate(interaction);
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

    // Handle community category separately
    if (category === 'community') {
      await this.handleCommunityList(interaction);
      return;
    }

    const presets = category
      ? presetService.getPresetsByCategory(category)
      : presetService.getAllPresets();

    if (presets.length === 0 && category) {
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
      // All categories (curated)
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

      // Add community presets section if API is enabled
      if (presetAPIService.isEnabled()) {
        try {
          const communityResponse = await presetAPIService.getPresets({
            status: 'approved',
            sort: 'popular',
            limit: 5,
          });

          if (communityResponse.presets.length > 0) {
            const communityNames = communityResponse.presets
              .map((p) => `${p.name} (${p.vote_count}★)`)
              .join(', ');
            const communityMore =
              communityResponse.total > 5 ? ` +${communityResponse.total - 5} more` : '';

            embed.addFields({
              name: `🌐 Community (${communityResponse.total})`,
              value: `${communityNames}${communityMore}`,
              inline: false,
            });
          }
        } catch (error) {
          logger.error('Failed to fetch community presets for list:', error);
          // Silently fail - curated presets still show
        }
      }
    }

    embed.setFooter({ text: t('presets.useShowTip') });

    await sendPublicSuccess(interaction, { embeds: [embed] });
  }

  /**
   * Handle /preset list category:community
   * Shows community-submitted presets with vote counts
   */
  private async handleCommunityList(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!presetAPIService.isEnabled()) {
      const errorEmbed = createErrorEmbed(
        'Feature Disabled',
        'Community presets are not enabled on this bot.'
      );
      await sendEphemeralError(interaction, { embeds: [errorEmbed] });
      return;
    }

    try {
      // Fetch top community presets sorted by popularity
      const response = await presetAPIService.getPresets({
        status: 'approved',
        sort: 'popular',
        limit: 20,
      });

      if (response.presets.length === 0) {
        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle('🌐 Community Presets')
          .setDescription(
            'No community presets yet!\n\nBe the first to submit one with `/preset submit`.'
          )
          .setTimestamp();

        await sendPublicSuccess(interaction, { embeds: [embed] });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('🌐 Community Presets')
        .setDescription(
          `User-submitted color palettes, sorted by popularity.\nTotal: **${response.total}** presets`
        )
        .setTimestamp();

      // Build preset list with vote counts and authors
      const presetList = response.presets
        .map((p) => {
          const voteStr = p.vote_count > 0 ? ` (${p.vote_count}★)` : '';
          const authorStr = p.author_name ? ` by ${p.author_name}` : '';
          return `• **${p.name}**${voteStr}${authorStr}`;
        })
        .join('\n');

      embed.addFields({
        name: `Top Presets (${response.presets.length}${response.has_more ? '+' : ''})`,
        value: presetList.substring(0, 1024),
        inline: false,
      });

      // Add tips
      embed.setFooter({
        text: 'Use /preset vote to support your favorites • /preset submit to share yours',
      });

      await sendPublicSuccess(interaction, { embeds: [embed] });
    } catch (error) {
      logger.error('Failed to fetch community presets:', error);

      const errorEmbed = createErrorEmbed(
        'Error Loading Presets',
        'Could not load community presets. Please try again later.'
      );
      await sendEphemeralError(interaction, { embeds: [errorEmbed] });
    }
  }

  /**
   * Handle /preset show <name>
   */
  private async handleShow(interaction: ChatInputCommandInteraction): Promise<void> {
    const presetName = interaction.options.getString('name', true);

    logger.info(`Preset show: ${presetName}`);

    // First, try to find in curated presets
    let preset = presetService.getPreset(presetName);
    if (!preset) {
      // Try searching by name
      const results = presetService.searchPresets(presetName);
      preset = results[0];
    }

    if (preset) {
      // Found in curated presets
      await this.sendPresetEmbed(interaction, preset);
      return;
    }

    // Not found in curated - check community presets if API is enabled
    if (presetAPIService.isEnabled()) {
      try {
        // Check if it's a community preset ID (UUID format)
        const communityPreset = await presetAPIService.getPreset(presetName);
        if (communityPreset) {
          await this.sendCommunityPresetEmbed(interaction, communityPreset);
          return;
        }
      } catch (error) {
        // Not found in API either, continue to error
        logger.debug(`Preset ${presetName} not found in API:`, error);
      }
    }

    // Not found anywhere
    const errorEmbed = createErrorEmbed(
      t('presets.notFound'),
      t('presets.couldNotFind', { name: presetName })
    );
    await sendEphemeralError(interaction, { embeds: [errorEmbed] });
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

    // Note: CommandBase already defers the reply

    try {
      // Submit to API
      // Use globalName (Discord display name) with fallbacks to ensure proper attribution
      const authorName =
        interaction.user.globalName || interaction.user.displayName || interaction.user.username;
      const response = await presetAPIService.submitPreset(
        {
          name: presetName,
          description,
          category_id: category,
          dyes: validDyeIds,
          tags,
        },
        interaction.user.id,
        authorName
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

        await interaction.editReply({ embeds: [duplicateEmbed] });
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

        await interaction.editReply({ embeds: [successEmbed] });

        // Post to submission log channel if configured
        await this.notifySubmissionChannel(
          interaction,
          response.preset,
          response.moderation_status === 'approved',
          validDyeIds
        );
      }
    } catch (error) {
      logger.error('Failed to submit preset:', error);

      const errorMessage =
        error instanceof Error ? error.message : 'Failed to submit preset. Please try again later.';

      const errorEmbed = createErrorEmbed('Submission Failed', errorMessage);
      await interaction.editReply({ embeds: [errorEmbed] });
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

    // Note: CommandBase already defers the reply

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

        await interaction.editReply({ embeds: [embed] });
      } else {
        // Add vote
        const response = await presetAPIService.voteForPreset(presetId, interaction.user.id);

        const embed = new EmbedBuilder()
          .setColor(0x57f287) // Green
          .setTitle('🗳️ Vote Added!')
          .setDescription(`Thank you for voting!\n\nCurrent votes: **${response.new_vote_count}**`)
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      }
    } catch (error) {
      logger.error('Failed to vote:', error);

      const errorMessage =
        error instanceof Error ? error.message : 'Failed to process vote. Please try again later.';

      const errorEmbed = createErrorEmbed('Vote Failed', errorMessage);
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }

  /**
   * Check if user is a moderator
   */
  private isModerator(interaction: ChatInputCommandInteraction): boolean {
    const userId = interaction.user.id;

    // Check if user ID is in moderator list
    if (config.communityPresets.moderatorIds.includes(userId)) {
      return true;
    }

    // Check if user has a moderator role
    if (interaction.member && 'roles' in interaction.member) {
      const memberRoles = interaction.member.roles;
      if (Array.isArray(memberRoles)) {
        return config.communityPresets.moderatorRoleIds.some((roleId) =>
          memberRoles.includes(roleId)
        );
      } else if (memberRoles && typeof memberRoles === 'object' && 'cache' in memberRoles) {
        // GuildMemberRoleManager (Discord.js)
        const roleCache = memberRoles.cache as Map<string, unknown>;
        return config.communityPresets.moderatorRoleIds.some((roleId) => roleCache.has(roleId));
      }
    }

    return false;
  }

  /**
   * Handle /preset moderate
   * Moderation actions for community presets
   */
  private async handleModerate(interaction: ChatInputCommandInteraction): Promise<void> {
    // Check if community presets are enabled
    if (!presetAPIService.isEnabled()) {
      const errorEmbed = createErrorEmbed(
        'Feature Disabled',
        'Community presets are not enabled on this bot.'
      );
      await sendEphemeralError(interaction, { embeds: [errorEmbed] });
      return;
    }

    // Check if user is a moderator
    if (!this.isModerator(interaction)) {
      const errorEmbed = createErrorEmbed(
        'Access Denied',
        'You do not have permission to use moderation commands.'
      );
      await sendEphemeralError(interaction, { embeds: [errorEmbed] });
      return;
    }

    const action = interaction.options.getString('action', true);
    const presetId = interaction.options.getString('preset_id');
    const reason = interaction.options.getString('reason');

    logger.info(
      `Preset moderate: action=${action}, presetId=${presetId}, user=${interaction.user.id}`
    );

    // Note: CommandBase already defers the reply

    try {
      switch (action) {
        case 'pending':
          await this.handleModeratePending(interaction);
          break;
        case 'approve':
          await this.handleModerateApprove(interaction, presetId, reason);
          break;
        case 'reject':
          await this.handleModerateReject(interaction, presetId, reason);
          break;
        case 'stats':
          await this.handleModerateStats(interaction);
          break;
        default: {
          const errorEmbed = createErrorEmbed('Invalid Action', 'Unknown moderation action.');
          await sendEphemeralError(interaction, { embeds: [errorEmbed] });
        }
      }
    } catch (error) {
      logger.error('Moderation action failed:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Moderation action failed. Please try again.';
      const errorEmbed = createErrorEmbed('Error', errorMessage);
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }

  /**
   * Show pending presets queue
   */
  private async handleModeratePending(interaction: ChatInputCommandInteraction): Promise<void> {
    const pendingPresets = await presetAPIService.getPendingPresets(interaction.user.id);

    if (pendingPresets.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('📋 Moderation Queue')
        .setDescription('No presets pending review! 🎉')
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xffa500)
      .setTitle('📋 Moderation Queue')
      .setDescription(`**${pendingPresets.length}** preset(s) awaiting review`)
      .setTimestamp();

    // List pending presets
    const presetList = pendingPresets
      .slice(0, 10)
      .map((p, i) => {
        const authorStr = p.author_name ? ` by ${p.author_name}` : '';
        const createdAt = new Date(p.created_at).toLocaleDateString();
        return `${i + 1}. **${p.name}**${authorStr}\n   ID: \`${p.id}\` • ${createdAt}`;
      })
      .join('\n\n');

    embed.addFields({
      name: 'Pending Presets',
      value: presetList.substring(0, 1024),
      inline: false,
    });

    if (pendingPresets.length > 10) {
      embed.setFooter({ text: `Showing 10 of ${pendingPresets.length} pending presets` });
    } else {
      embed.setFooter({
        text: 'Use /preset moderate action:approve preset_id:<id> to approve',
      });
    }

    await interaction.editReply({ embeds: [embed] });
  }

  /**
   * Approve a pending preset
   */
  private async handleModerateApprove(
    interaction: ChatInputCommandInteraction,
    presetId: string | null,
    reason: string | null
  ): Promise<void> {
    if (!presetId) {
      const errorEmbed = createErrorEmbed(
        'Missing Preset ID',
        'Please provide a preset ID to approve.'
      );
      await interaction.editReply({ embeds: [errorEmbed] });
      return;
    }

    const approvedPreset = await presetAPIService.approvePreset(
      presetId,
      interaction.user.id,
      reason || undefined
    );

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('✅ Preset Approved')
      .setDescription(`**${approvedPreset.name}** has been approved and is now live!`)
      .addFields(
        { name: 'Preset ID', value: `\`${approvedPreset.id}\``, inline: true },
        { name: 'Author', value: approvedPreset.author_name || 'Unknown', inline: true }
      )
      .setTimestamp();

    if (reason) {
      embed.addFields({ name: 'Note', value: reason, inline: false });
    }

    await interaction.editReply({ embeds: [embed] });
  }

  /**
   * Reject a pending preset
   */
  private async handleModerateReject(
    interaction: ChatInputCommandInteraction,
    presetId: string | null,
    reason: string | null
  ): Promise<void> {
    if (!presetId) {
      const errorEmbed = createErrorEmbed(
        'Missing Preset ID',
        'Please provide a preset ID to reject.'
      );
      await interaction.editReply({ embeds: [errorEmbed] });
      return;
    }

    if (!reason) {
      const errorEmbed = createErrorEmbed(
        'Missing Reason',
        'Please provide a reason for rejection.'
      );
      await interaction.editReply({ embeds: [errorEmbed] });
      return;
    }

    const rejectedPreset = await presetAPIService.rejectPreset(
      presetId,
      interaction.user.id,
      reason
    );

    const embed = new EmbedBuilder()
      .setColor(0xed4245) // Red
      .setTitle('❌ Preset Rejected')
      .setDescription(`**${rejectedPreset.name}** has been rejected.`)
      .addFields(
        { name: 'Preset ID', value: `\`${rejectedPreset.id}\``, inline: true },
        { name: 'Author', value: rejectedPreset.author_name || 'Unknown', inline: true },
        { name: 'Reason', value: reason, inline: false }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }

  /**
   * Show moderation statistics
   */
  private async handleModerateStats(interaction: ChatInputCommandInteraction): Promise<void> {
    const stats = await presetAPIService.getModerationStats(interaction.user.id);

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('📊 Moderation Statistics')
      .setDescription('Overview of community preset moderation')
      .addFields(
        { name: '⏳ Pending', value: String(stats.pending), inline: true },
        { name: '✅ Approved', value: String(stats.approved), inline: true },
        { name: '❌ Rejected', value: String(stats.rejected), inline: true },
        { name: '⚠️ Flagged', value: String(stats.flagged), inline: true },
        { name: '📈 Actions (7d)', value: String(stats.actions_last_week), inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }

  /**
   * Post submission notification to configured channels
   */
  private async notifySubmissionChannel(
    interaction: ChatInputCommandInteraction,
    preset: { id: string; name: string; description: string; category_id: string },
    approved: boolean,
    dyeIds: number[]
  ): Promise<void> {
    const submissionChannelId = config.communityPresets.submissionLogChannelId;
    const moderationChannelId = config.communityPresets.moderationChannelId;

    // Determine which channel to use
    const channelId = approved ? submissionChannelId : moderationChannelId;

    if (!channelId) {
      return; // No channel configured
    }

    try {
      const channel = await interaction.client.channels.fetch(channelId);
      if (!channel || !(channel instanceof TextChannel)) {
        logger.warn(`Notification channel ${channelId} not found or not a text channel`);
        return;
      }

      // Resolve dye names
      const dyeNames = dyeIds
        .map((id) => {
          const dye = dyeService.getDyeById(id);
          return dye ? dye.name : `Unknown (${id})`;
        })
        .join(', ');

      const embed = new EmbedBuilder()
        .setColor(approved ? 0x57f287 : 0xffa500)
        .setTitle(approved ? '🎨 New Preset Submitted' : '⚠️ Preset Pending Review')
        .setDescription(`**${preset.name}**\n${preset.description}`)
        .addFields(
          { name: 'Category', value: preset.category_id, inline: true },
          { name: 'Submitted by', value: interaction.user.tag, inline: true },
          { name: 'Preset ID', value: `\`${preset.id}\``, inline: false },
          { name: 'Dyes', value: dyeNames, inline: false }
        )
        .setTimestamp();

      // For approved presets, just send the embed
      if (approved) {
        await channel.send({ embeds: [embed] });
        logger.info(`Posted submission notification to channel ${channelId}`);
        return;
      }

      // For flagged presets, add approve/reject buttons
      const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`preset_approve_${preset.id}`)
          .setLabel('Approve')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✅'),
        new ButtonBuilder()
          .setCustomId(`preset_reject_${preset.id}`)
          .setLabel('Reject')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('❌')
      );

      // Build role mentions for moderators
      const roleMentions = config.communityPresets.moderatorRoleIds
        .filter((id) => id.length > 0)
        .map((roleId) => `<@&${roleId}>`)
        .join(' ');

      const message = await channel.send({
        content: roleMentions || undefined,
        embeds: [embed],
        components: [buttons],
      });
      logger.info(`Posted moderation notification with buttons to channel ${channelId}`);

      // Set up button collector (24 hour timeout)
      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 24 * 60 * 60 * 1000, // 24 hours
      });

      collector.on('collect', (buttonInteraction: ButtonInteraction) => {
        void this.handleModerationButton(buttonInteraction, preset, message);
      });

      collector.on('end', () => {
        // Disable buttons after timeout
        const disabledButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`preset_approve_${preset.id}`)
            .setLabel('Approve')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅')
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId(`preset_reject_${preset.id}`)
            .setLabel('Reject')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('❌')
            .setDisabled(true)
        );
        message.edit({ components: [disabledButtons] }).catch(() => {
          // Message may have been deleted
        });
      });
    } catch (error) {
      logger.error('Failed to post submission notification:', error);
      // Don't throw - this is a non-critical operation
    }
  }

  /**
   * Handle approve/reject button clicks
   */
  private async handleModerationButton(
    buttonInteraction: ButtonInteraction,
    preset: { id: string; name: string; description: string; category_id: string },
    message: import('discord.js').Message
  ): Promise<void> {
    const userId = buttonInteraction.user.id;

    // Check if user is a moderator
    const isMod =
      config.communityPresets.moderatorIds.includes(userId) ||
      (buttonInteraction.member &&
        'roles' in buttonInteraction.member &&
        config.communityPresets.moderatorRoleIds.some((roleId) => {
          const roles = buttonInteraction.member?.roles;
          if (Array.isArray(roles)) return roles.includes(roleId);
          if (roles && typeof roles === 'object' && 'cache' in roles) {
            return (roles.cache as Map<string, unknown>).has(roleId);
          }
          return false;
        }));

    if (!isMod) {
      await buttonInteraction.reply({
        content: '❌ You do not have permission to moderate presets.',
        ephemeral: true,
      });
      return;
    }

    const isApprove = buttonInteraction.customId.startsWith('preset_approve_');

    try {
      await buttonInteraction.deferReply({ ephemeral: true });

      if (isApprove) {
        // Approve the preset
        const approvedPreset = await presetAPIService.approvePreset(preset.id, userId);

        // Update the original message
        const updatedEmbed = EmbedBuilder.from(message.embeds[0])
          .setColor(0x57f287)
          .setTitle('✅ Preset Approved')
          .setFooter({ text: `Approved by ${buttonInteraction.user.tag}` });

        await message.edit({ embeds: [updatedEmbed], components: [] });

        await buttonInteraction.editReply({
          content: `✅ **${approvedPreset.name}** has been approved!`,
        });
      } else {
        // Reject the preset
        const rejectedPreset = await presetAPIService.rejectPreset(
          preset.id,
          userId,
          'Rejected via moderation panel'
        );

        // Update the original message
        const updatedEmbed = EmbedBuilder.from(message.embeds[0])
          .setColor(0xed4245)
          .setTitle('❌ Preset Rejected')
          .setFooter({ text: `Rejected by ${buttonInteraction.user.tag}` });

        await message.edit({ embeds: [updatedEmbed], components: [] });

        await buttonInteraction.editReply({
          content: `❌ **${rejectedPreset.name}** has been rejected.`,
        });
      }

      logger.info(
        `Preset ${preset.id} ${isApprove ? 'approved' : 'rejected'} by ${buttonInteraction.user.tag}`
      );
    } catch (error) {
      logger.error('Failed to process moderation button:', error);
      await buttonInteraction.editReply({
        content:
          '❌ Failed to process moderation action. Please try again or use the slash command.',
      });
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
   * Send a community preset as an embed with swatch image
   */
  private async sendCommunityPresetEmbed(
    interaction: ChatInputCommandInteraction,
    preset: CommunityPreset
  ): Promise<void> {
    // Resolve dyes
    const resolvedDyes = preset.dyes.map((dyeId) => dyeService.getDyeById(dyeId));
    const validDyes = resolvedDyes.filter((d) => d !== null);

    // Get category meta
    const categoryMeta = presetService.getCategoryMeta(preset.category_id);

    // Build embed
    const embed = new EmbedBuilder()
      .setColor(validDyes.length > 0 ? parseInt(validDyes[0].hex.replace('#', ''), 16) : 0x5865f2)
      .setTitle(`${categoryMeta?.icon || '🌐'} ${preset.name}`)
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

    // Add community preset metadata
    const authorStr = preset.author_name || 'Unknown';
    const voteStr = preset.vote_count > 0 ? `${preset.vote_count} ★` : 'No votes yet';
    embed.addFields(
      { name: 'Author', value: authorStr, inline: true },
      { name: 'Votes', value: voteStr, inline: true }
    );

    // Add tags
    if (preset.tags.length > 0) {
      embed.addFields({
        name: t('presets.tags'),
        value: preset.tags.map((tag) => `\`${tag}\``).join(' '),
        inline: false,
      });
    }

    // Add vote tip in footer
    embed.setFooter({ text: `Use /preset vote to support this preset • ID: ${preset.id}` });

    // Render swatch image using a compatible format
    try {
      const presetForRender = {
        id: preset.id,
        name: preset.name,
        description: preset.description,
        category: preset.category_id,
        dyes: preset.dyes,
        tags: preset.tags,
      };

      const swatchBuffer = renderPresetSwatch({
        preset: presetForRender,
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
      logger.error('Failed to render community preset swatch:', error);
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

    // Handle pending preset autocomplete for moderate subcommand
    if (subcommand === 'moderate' && focusedOption.name === 'preset_id') {
      await this.handlePendingPresetAutocomplete(interaction, focusedOption.value);
      return;
    }

    // Handle preset name autocomplete for show subcommand
    if (focusedOption.name === 'name') {
      const query = focusedOption.value.toLowerCase();

      // Get curated presets and filter
      const allPresets = presetService.getAllPresets();
      const curatedMatches = allPresets
        .filter(
          (p) =>
            p.name.toLowerCase().includes(query) ||
            p.id.toLowerCase().includes(query) ||
            p.tags.some((tag) => tag.toLowerCase().includes(query))
        )
        .slice(0, 15) // Leave room for community presets
        .map((p) => {
          const categoryMeta = presetService.getCategoryMeta(p.category);
          return {
            name: `${categoryMeta?.icon || '🎨'} ${p.name}`,
            value: p.id,
          };
        });

      // Also fetch community presets if API is enabled
      let communityMatches: Array<{ name: string; value: string }> = [];
      if (presetAPIService.isEnabled()) {
        try {
          const response = await presetAPIService.getPresets({
            search: query || undefined,
            status: 'approved',
            limit: 10,
            sort: query ? undefined : 'popular',
          });

          communityMatches = response.presets.map((preset) => {
            const voteCount = preset.vote_count > 0 ? ` (${preset.vote_count}★)` : '';
            return {
              name: `🌐 ${preset.name}${voteCount}`,
              value: preset.id,
            };
          });
        } catch (error) {
          logger.debug('Failed to fetch community presets for autocomplete:', error);
        }
      }

      // Combine and limit to 25 (Discord's limit)
      const allMatches = [...curatedMatches, ...communityMatches].slice(0, 25);
      await interaction.respond(allMatches);
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

  /**
   * Handle pending preset autocomplete for moderate command
   */
  private async handlePendingPresetAutocomplete(
    interaction: AutocompleteInteraction,
    query: string
  ): Promise<void> {
    // Only moderators should get results
    // Note: We can't fully check roles in autocomplete, so we check user ID only
    const userId = interaction.user.id;
    if (!config.communityPresets.moderatorIds.includes(userId)) {
      await interaction.respond([]);
      return;
    }

    if (!presetAPIService.isEnabled()) {
      await interaction.respond([]);
      return;
    }

    try {
      // Fetch pending presets
      const pendingPresets = await presetAPIService.getPendingPresets(userId);

      // Filter by query if provided
      const filtered = query
        ? pendingPresets.filter(
            (p) =>
              p.name.toLowerCase().includes(query.toLowerCase()) ||
              p.id.toLowerCase().includes(query.toLowerCase())
          )
        : pendingPresets;

      const choices = filtered.slice(0, 25).map((preset) => {
        const authorStr = preset.author_name ? ` by ${preset.author_name}` : '';
        const displayName = `${preset.name}${authorStr}`;
        return {
          name: displayName.substring(0, 100),
          value: preset.id,
        };
      });

      await interaction.respond(choices);
    } catch (error) {
      logger.error('Failed to fetch pending presets for autocomplete:', error);
      await interaction.respond([]);
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
