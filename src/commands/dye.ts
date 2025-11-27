/**
 * /dye command - Dye information and lookup
 * Subcommands: info, search, list, random
 */

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  EmbedBuilder,
  ColorResolvable,
  MessageFlags,
} from 'discord.js';
import { DyeService, dyeDatabase, LocalizationService, type Dye } from 'xivdyetools-core';
import { findDyeByName, validateIntRange } from '../utils/validators.js';
import {
  createErrorEmbed,
  createDyeEmbed,
  createDyeEmojiAttachment,
} from '../utils/embed-builder.js';
import { emojiService } from '../services/emoji-service.js';
import { logger } from '../utils/logger.js';
import { sendPublicSuccess, sendEphemeralError } from '../utils/response-helper.js';
import { t } from '../services/i18n-service.js';
import type { BotCommand } from '../types/index.js';

const dyeService = new DyeService(dyeDatabase);

/**
 * Available dye categories
 */
const CATEGORIES = [
  { name: 'Neutral', value: 'Neutral' },
  { name: 'Reds', value: 'Reds' },
  { name: 'Browns', value: 'Browns' },
  { name: 'Yellows', value: 'Yellows' },
  { name: 'Greens', value: 'Greens' },
  { name: 'Blues', value: 'Blues' },
  { name: 'Purples', value: 'Purples' },
  { name: 'Special', value: 'Special' },
  { name: 'Facewear', value: 'Facewear' },
];

export const data = new SlashCommandBuilder()
  .setName('dye')
  .setDescription('FFXIV dye information and lookup')
  .setDescriptionLocalizations({
    ja: 'FFXIV染料の情報と検索',
    de: 'FFXIV Farbstoff-Informationen und Suche',
    fr: 'Informations et recherche de teintures FFXIV',
  })
  .addSubcommand((subcommand) =>
    subcommand
      .setName('info')
      .setDescription('Get information about a specific dye')
      .setDescriptionLocalizations({
        ja: '特定の染料の情報を取得',
        de: 'Informationen über einen bestimmten Farbstoff erhalten',
        fr: 'Obtenir des informations sur une teinture spécifique',
      })
      .addStringOption((option) =>
        option
          .setName('name')
          .setDescription('Dye name')
          .setDescriptionLocalizations({
            ja: '染料名',
            de: 'Farbstoffname',
            fr: 'Nom de la teinture',
          })
          .setRequired(true)
          .setAutocomplete(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('search')
      .setDescription('Search for dyes by name')
      .setDescriptionLocalizations({
        ja: '名前で染料を検索',
        de: 'Farbstoffe nach Namen suchen',
        fr: 'Rechercher des teintures par nom',
      })
      .addStringOption((option) =>
        option
          .setName('query')
          .setDescription('Search term (partial name match)')
          .setDescriptionLocalizations({
            ja: '検索キーワード（部分一致）',
            de: 'Suchbegriff (teilweise Übereinstimmung)',
            fr: 'Terme de recherche (correspondance partielle)',
          })
          .setRequired(true)
          .setMinLength(2)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('list')
      .setDescription('List dyes by category')
      .setDescriptionLocalizations({
        ja: 'カテゴリ別に染料を一覧表示',
        de: 'Farbstoffe nach Kategorie auflisten',
        fr: 'Lister les teintures par catégorie',
      })
      .addStringOption((option) =>
        option
          .setName('category')
          .setDescription('Dye category')
          .setDescriptionLocalizations({
            ja: '染料カテゴリ',
            de: 'Farbstoffkategorie',
            fr: 'Catégorie de teinture',
          })
          .setRequired(true)
          .addChoices(...CATEGORIES)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('random')
      .setDescription('Get random dye(s)')
      .setDescriptionLocalizations({
        ja: 'ランダムな染料を取得',
        de: 'Zufällige Farbstoffe erhalten',
        fr: 'Obtenir des teintures aléatoires',
      })
      .addIntegerOption((option) =>
        option
          .setName('count')
          .setDescription('Number of random dyes (default: 1)')
          .setDescriptionLocalizations({
            ja: 'ランダムな染料の数（デフォルト：1）',
            de: 'Anzahl der zufälligen Farbstoffe (Standard: 1)',
            fr: 'Nombre de teintures aléatoires (par défaut : 1)',
          })
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(5)
      )
      .addBooleanOption((option) =>
        option
          .setName('exclude_metallic')
          .setDescription('Exclude dyes that begin with "Metallic" in their name')
          .setRequired(false)
      )
      .addBooleanOption((option) =>
        option
          .setName('exclude_pastel')
          .setDescription('Exclude dyes that begin with "Pastel" in their name')
          .setRequired(false)
      )
      .addBooleanOption((option) =>
        option
          .setName('exclude_dark')
          .setDescription('Exclude dyes that begin with "Dark" in their name')
          .setRequired(false)
      )
      .addBooleanOption((option) =>
        option
          .setName('exclude_cosmic')
          .setDescription(
            'Exclude dyes where Acquisition is "Cosmic Exploration" or "Cosmic Fortunes"'
          )
          .setRequired(false)
      )
      .addBooleanOption((option) =>
        option
          .setName('exclude_expensive')
          .setDescription('Exclude Pure White (itemID 13114) and Jet Black (itemID 13115)')
          .setRequired(false)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  try {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'info':
        await handleInfo(interaction);
        break;
      case 'search':
        await handleSearch(interaction);
        break;
      case 'list':
        await handleList(interaction);
        break;
      case 'random':
        await handleRandom(interaction);
        break;
      default: {
        const errorEmbed = createErrorEmbed(
          t('errors.unknownSubcommand'),
          t('errors.invalidSubcommand')
        );
        await sendEphemeralError(interaction, { embeds: [errorEmbed] });
      }
    }
  } catch (error) {
    logger.error('Error executing dye command:', error);
    const errorEmbed = createErrorEmbed(
      t('errors.commandError'),
      t('errors.errorProcessingRequest')
    );

    if (interaction.deferred) {
      await sendEphemeralError(interaction, { embeds: [errorEmbed] });
    } else {
      await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
    }
  }
}

/**
 * Handle /dye info subcommand
 */
async function handleInfo(interaction: ChatInputCommandInteraction): Promise<void> {
  const dyeName = interaction.options.getString('name', true);

  logger.info(`Dye info: ${dyeName}`);

  const dyeResult = findDyeByName(dyeName);
  if (dyeResult.error) {
    const errorEmbed = createErrorEmbed(
      t('errors.dyeNotFound'),
      t('errors.couldNotFindDyeWithSuggestion', { name: dyeName })
    );
    await sendEphemeralError(interaction, { embeds: [errorEmbed] });
    return;
  }

  const dye = dyeResult.dye!;

  // Attach emoji if available
  const emojiAttachment = createDyeEmojiAttachment(dye);
  const embed = createDyeEmbed(dye, true, true, !!emojiAttachment); // Show extended info, use file attachment if available
  const files = emojiAttachment ? [emojiAttachment] : [];

  await sendPublicSuccess(interaction, { embeds: [embed], files });
  logger.info(`Dye info completed: ${dye.name}`);
}

/**
 * Handle /dye search subcommand
 */
async function handleSearch(interaction: ChatInputCommandInteraction): Promise<void> {
  const query = interaction.options.getString('query', true);

  logger.info(`Dye search: ${query}`);

  const allDyes = dyeService.getAllDyes();
  const matches = allDyes.filter((dye) => {
    const localizedName = LocalizationService.getDyeName(dye.id);
    return (
      dye.name.toLowerCase().includes(query.toLowerCase()) ||
      (localizedName && localizedName.toLowerCase().includes(query.toLowerCase()))
    );
  });

  if (matches.length === 0) {
    const errorEmbed = createErrorEmbed(
      t('errors.noResults'),
      t('errors.noDyesFoundWithSuggestion', { query })
    );
    await sendEphemeralError(interaction, { embeds: [errorEmbed] });
    return;
  }

  // Limit to first 15 results
  const displayMatches = matches.slice(0, 15);
  const hasMore = matches.length > 15;

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`🔍 ${t('embeds.dyeSearch')}: "${query}"`)
    .setDescription(
      `${t('labels.found')} **${matches.length}** ${matches.length === 1 ? t('labels.dye') : t('labels.dyes')}${hasMore ? ` (${t('labels.showingFirst', { count: 15 })})` : ''}:\n\n` +
        displayMatches
          .map((dye) => {
            const localizedName = LocalizationService.getDyeName(dye.id) || dye.name;
            const localizedCategory = LocalizationService.getCategory(dye.category) || dye.category;
            return `${emojiService.getDyeEmojiOrSwatch(dye, 3)} **${localizedName}** (${localizedCategory})`;
          })
          .join('\n')
    )
    .setFooter({
      text: hasMore ? t('embeds.tooManyResults') : t('embeds.useDyeInfoForDetails'),
    })
    .setTimestamp();

  await sendPublicSuccess(interaction, { embeds: [embed] });
  logger.info(`Dye search completed: ${matches.length} results`);
}

/**
 * Handle /dye list subcommand
 */
async function handleList(interaction: ChatInputCommandInteraction): Promise<void> {
  const category = interaction.options.getString('category', true);

  logger.info(`Dye list: ${category}`);

  const allDyes = dyeService.getAllDyes();
  const categoryDyes = allDyes.filter((dye) => dye.category === category);

  if (categoryDyes.length === 0) {
    const errorEmbed = createErrorEmbed(
      t('errors.emptyCategory'),
      t('errors.noDyesInCategory', { category })
    );
    await sendEphemeralError(interaction, { embeds: [errorEmbed] });
    return;
  }

  const localizedCategory = LocalizationService.getCategory(category) || category;

  // Show all dyes in category (most categories have 10-20 dyes)
  const dyeList = categoryDyes
    .map((dye, index) => {
      const localizedName = LocalizationService.getDyeName(dye.id) || dye.name;
      return `${index + 1}. ${emojiService.getDyeEmojiOrSwatch(dye, 3)} **${localizedName}** (${dye.hex.toUpperCase()})`;
    })
    .join('\n');

  const embed = new EmbedBuilder()
    .setColor(parseInt(categoryDyes[0].hex.replace('#', ''), 16) as ColorResolvable)
    .setTitle(`📋 ${localizedCategory} ${t('labels.dyes')}`)
    .setDescription(`**${categoryDyes.length}** ${t('labels.dyesInCategory')}:\n\n${dyeList}`)
    .setFooter({ text: t('embeds.useDyeInfoForFullDetails') })
    .setTimestamp();

  await sendPublicSuccess(interaction, { embeds: [embed] });
  logger.info(`Dye list completed: ${category} (${categoryDyes.length} dyes)`);
}

/**
 * Handle /dye random subcommand
 */
async function handleRandom(interaction: ChatInputCommandInteraction): Promise<void> {
  const count = interaction.options.getInteger('count') || 1;
  const excludeMetallic = interaction.options.getBoolean('exclude_metallic') ?? false;
  const excludePastel = interaction.options.getBoolean('exclude_pastel') ?? false;
  const excludeDark = interaction.options.getBoolean('exclude_dark') ?? false;
  const excludeCosmic = interaction.options.getBoolean('exclude_cosmic') ?? false;
  const excludeExpensive = interaction.options.getBoolean('exclude_expensive') ?? false;

  // Build filter log message
  const activeFilters: string[] = [];
  if (excludeMetallic) activeFilters.push('metallic');
  if (excludePastel) activeFilters.push('pastel');
  if (excludeDark) activeFilters.push('dark');
  if (excludeCosmic) activeFilters.push('cosmic');
  if (excludeExpensive) activeFilters.push('expensive');
  const filterLog = activeFilters.length > 0 ? ` (excludes: ${activeFilters.join(', ')})` : '';
  logger.info(`Dye random: ${count}${filterLog}`);

  // Validate count
  const countValidation = validateIntRange(count, 1, 5, t('labels.count'));
  if (!countValidation.valid) {
    const errorEmbed = createErrorEmbed(t('errors.invalidCount'), countValidation.error!);
    await sendEphemeralError(interaction, { embeds: [errorEmbed] });
    return;
  }

  // Get all dyes and apply filters
  const allDyes = dyeService.getAllDyes().filter((dye) => {
    // Exclude Facewear category
    if (dye.category === 'Facewear') return false;

    // Apply exclusion filters
    if (excludeMetallic && dye.name.startsWith('Metallic')) return false;
    if (excludePastel && dye.name.startsWith('Pastel')) return false;
    if (excludeDark && dye.name.startsWith('Dark')) return false;
    if (
      excludeCosmic &&
      (dye.acquisition === 'Cosmic Exploration' || dye.acquisition === 'Cosmic Fortunes')
    )
      return false;
    if (excludeExpensive && (dye.itemID === 13114 || dye.itemID === 13115)) return false;

    return true;
  });

  // Check if any dyes remain after filtering
  if (allDyes.length === 0) {
    const errorEmbed = createErrorEmbed(
      t('errors.noDyesAvailable'),
      t('errors.noMatchingFilterCriteria')
    );
    await sendEphemeralError(interaction, { embeds: [errorEmbed] });
    return;
  }

  // Get random dyes (no duplicates)
  const randomDyes: Dye[] = [];
  const usedIndices = new Set<number>();

  while (randomDyes.length < count && usedIndices.size < allDyes.length) {
    const randomIndex = Math.floor(Math.random() * allDyes.length);
    if (!usedIndices.has(randomIndex)) {
      usedIndices.add(randomIndex);
      randomDyes.push(allDyes[randomIndex]);
    }
  }

  if (count === 1) {
    // Single dye - use full embed
    const dye = randomDyes[0];

    // Attach emoji if available
    const emojiAttachment = createDyeEmojiAttachment(dye);
    const embed = createDyeEmbed(dye, true, true, !!emojiAttachment);
    embed.setTitle(`🎲 ${embed.data.title}`); // Add dice emoji

    const files = emojiAttachment ? [emojiAttachment] : [];

    await sendPublicSuccess(interaction, { embeds: [embed], files });
  } else {
    // Multiple dyes - use compact list
    const dyeList = randomDyes
      .map((dye, index) => {
        const localizedName = LocalizationService.getDyeName(dye.id);
        const localizedCategory = LocalizationService.getCategory(dye.category);
        const localizedAcquisition = dye.acquisition
          ? LocalizationService.getAcquisition(dye.acquisition) || dye.acquisition
          : null;
        return [
          `**${index + 1}. ${localizedName}**`,
          `${emojiService.getDyeEmojiOrSwatch(dye, 6)} ${dye.hex.toUpperCase()}`,
          `${t('embeds.category')}: ${localizedCategory}`,
          localizedAcquisition ? `${t('embeds.acquisition')}: ${localizedAcquisition}` : '',
        ]
          .filter(Boolean)
          .join('\n');
      })
      .join('\n\n');

    const embed = new EmbedBuilder()
      .setColor(parseInt(randomDyes[0].hex.replace('#', ''), 16) as ColorResolvable)
      .setTitle(`🎲 ${t('embeds.randomDyes')} (${count})`)
      .setDescription(dyeList)
      .setFooter({ text: t('embeds.useDyeInfoForMoreDetails') })
      .setTimestamp();

    await sendPublicSuccess(interaction, { embeds: [embed] });
  }

  logger.info(`Dye random completed: ${count} ${count === 1 ? 'dye' : 'dyes'}`);
}

/**
 * Autocomplete handler for dye names
 */
export async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const focusedOption = interaction.options.getFocused(true);

  if (focusedOption.name === 'name') {
    const query = focusedOption.value.toLowerCase();

    const allDyes = dyeService.getAllDyes();
    const matches = allDyes
      .filter((dye) => {
        // Exclude Facewear for general searches
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

export const dyeCommand: BotCommand = {
  data,
  execute,
  autocomplete,
};
