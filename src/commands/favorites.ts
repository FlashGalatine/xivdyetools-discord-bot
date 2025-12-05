/**
 * /favorites command - Manage favorite dyes
 * Subcommands: add, remove, list, clear
 */

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { DyeService, dyeDatabase, LocalizationService } from 'xivdyetools-core';
import { findDyeByName } from '../utils/validators.js';
import { createErrorEmbed, createSuccessEmbed } from '../utils/embed-builder.js';
import { collectionStorage, COLLECTION_LIMITS } from '../services/collection-storage.js';
import { emojiService } from '../services/emoji-service.js';
import { logger } from '../utils/logger.js';
import { sendEphemeralError } from '../utils/response-helper.js';
import { t } from '../services/i18n-service.js';
import type { BotCommand } from '../types/index.js';

const dyeService = new DyeService(dyeDatabase);

export const data = new SlashCommandBuilder()
  .setName('favorites')
  .setDescription('Manage your favorite dyes')
  .setDescriptionLocalizations({
    ja: 'お気に入りの染料を管理',
    de: 'Verwalten Sie Ihre Lieblingsfarbstoffe',
    fr: 'Gérer vos teintures préférées',
  })
  .addSubcommand((subcommand) =>
    subcommand
      .setName('add')
      .setDescription('Add a dye to your favorites')
      .setDescriptionLocalizations({
        ja: 'お気に入りに染料を追加',
        de: 'Einen Farbstoff zu Ihren Favoriten hinzufügen',
        fr: 'Ajouter une teinture à vos favoris',
      })
      .addStringOption((option) =>
        option
          .setName('dye')
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
      .setName('remove')
      .setDescription('Remove a dye from your favorites')
      .setDescriptionLocalizations({
        ja: 'お気に入りから染料を削除',
        de: 'Einen Farbstoff aus Ihren Favoriten entfernen',
        fr: 'Retirer une teinture de vos favoris',
      })
      .addStringOption((option) =>
        option
          .setName('dye')
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
      .setName('list')
      .setDescription('Show all your favorite dyes')
      .setDescriptionLocalizations({
        ja: 'すべてのお気に入り染料を表示',
        de: 'Alle Ihre Lieblingsfarbstoffe anzeigen',
        fr: 'Afficher toutes vos teintures préférées',
      })
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('clear')
      .setDescription('Clear all your favorites')
      .setDescriptionLocalizations({
        ja: 'すべてのお気に入りをクリア',
        de: 'Alle Favoriten löschen',
        fr: 'Effacer tous vos favoris',
      })
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'add':
        await handleAdd(interaction);
        break;
      case 'remove':
        await handleRemove(interaction);
        break;
      case 'list':
        await handleList(interaction);
        break;
      case 'clear':
        await handleClear(interaction);
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
    logger.error('Error executing favorites command:', error);
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
 * Handle /favorites add
 */
async function handleAdd(interaction: ChatInputCommandInteraction): Promise<void> {
  const dyeName = interaction.options.getString('dye', true);
  const userId = interaction.user.id;

  logger.info(`Favorites add: ${dyeName} for user ${userId}`);

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
  const result = await collectionStorage.addFavorite(userId, dye.id);

  if (!result.success) {
    let errorMessage: string;
    switch (result.reason) {
      case 'alreadyFavorite':
        errorMessage = t('favorites.alreadyFavorite', {
          name: LocalizationService.getDyeName(dye.id) || dye.name,
        });
        break;
      case 'limitReached':
        errorMessage = t('favorites.limitReached', { max: COLLECTION_LIMITS.MAX_FAVORITES });
        break;
      default:
        errorMessage = t('errors.errorProcessingRequest');
    }
    const errorEmbed = createErrorEmbed(t('errors.error'), errorMessage);
    await sendEphemeralError(interaction, { embeds: [errorEmbed] });
    return;
  }

  const localizedName = LocalizationService.getDyeName(dye.id) || dye.name;
  const embed = createSuccessEmbed(
    t('favorites.added'),
    t('favorites.addedMessage', { name: localizedName })
  );
  embed.setColor(parseInt(dye.hex.replace('#', ''), 16));

  await interaction.editReply({ embeds: [embed] });
  logger.info(`Added ${dye.name} to favorites for user ${userId}`);
}

/**
 * Handle /favorites remove
 */
async function handleRemove(interaction: ChatInputCommandInteraction): Promise<void> {
  const dyeName = interaction.options.getString('dye', true);
  const userId = interaction.user.id;

  logger.info(`Favorites remove: ${dyeName} for user ${userId}`);

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
  const removed = await collectionStorage.removeFavorite(userId, dye.id);

  if (!removed) {
    const localizedName = LocalizationService.getDyeName(dye.id) || dye.name;
    const errorEmbed = createErrorEmbed(
      t('errors.error'),
      t('favorites.notInFavorites', { name: localizedName })
    );
    await sendEphemeralError(interaction, { embeds: [errorEmbed] });
    return;
  }

  const localizedName = LocalizationService.getDyeName(dye.id) || dye.name;
  const embed = createSuccessEmbed(
    t('favorites.removed'),
    t('favorites.removedMessage', { name: localizedName })
  );

  await interaction.editReply({ embeds: [embed] });
  logger.info(`Removed ${dye.name} from favorites for user ${userId}`);
}

/**
 * Handle /favorites list
 */
async function handleList(interaction: ChatInputCommandInteraction): Promise<void> {
  const userId = interaction.user.id;

  logger.info(`Favorites list for user ${userId}`);

  const favorites = await collectionStorage.getFavorites(userId);

  if (favorites.length === 0) {
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`⭐ ${t('favorites.yourFavorites')}`)
      .setDescription(t('favorites.emptyList'))
      .setFooter({ text: t('favorites.addTip') })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // Build list of favorite dyes
  const dyeList = favorites
    .map((dyeId, index) => {
      const dye = dyeService.getDyeById(dyeId);
      if (!dye) return null;

      const localizedName = LocalizationService.getDyeName(dye.id) || dye.name;
      const localizedCategory = LocalizationService.getCategory(dye.category) || dye.category;
      return `${index + 1}. ${emojiService.getDyeEmojiOrSwatch(dye, 3)} **${localizedName}** (${localizedCategory})`;
    })
    .filter(Boolean)
    .join('\n');

  const embed = new EmbedBuilder()
    .setColor(0xffd700) // Gold color for favorites
    .setTitle(`⭐ ${t('favorites.yourFavorites')} (${favorites.length})`)
    .setDescription(dyeList || t('favorites.emptyList'))
    .setFooter({
      text: t('favorites.listFooter', {
        current: favorites.length,
        max: COLLECTION_LIMITS.MAX_FAVORITES,
      }),
    })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
  logger.info(`Listed ${favorites.length} favorites for user ${userId}`);
}

/**
 * Handle /favorites clear
 */
async function handleClear(interaction: ChatInputCommandInteraction): Promise<void> {
  const userId = interaction.user.id;

  logger.info(`Favorites clear for user ${userId}`);

  const favorites = await collectionStorage.getFavorites(userId);

  if (favorites.length === 0) {
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`⭐ ${t('favorites.yourFavorites')}`)
      .setDescription(t('favorites.alreadyEmpty'))
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const count = favorites.length;
  await collectionStorage.clearFavorites(userId);

  const embed = createSuccessEmbed(
    t('favorites.cleared'),
    t('favorites.clearedMessage', { count })
  );

  await interaction.editReply({ embeds: [embed] });
  logger.info(`Cleared ${count} favorites for user ${userId}`);
}

/**
 * Autocomplete handler for dye names
 */
export async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const focusedOption = interaction.options.getFocused(true);

  if (focusedOption.name === 'dye') {
    const query = focusedOption.value.toLowerCase();
    const subcommand = interaction.options.getSubcommand();

    // For 'remove', only show current favorites
    if (subcommand === 'remove') {
      const userId = interaction.user.id;
      const favorites = await collectionStorage.getFavorites(userId);

      const matches = favorites
        .map((dyeId) => {
          const dye = dyeService.getDyeById(dyeId);
          if (!dye) return null;

          const localizedName = LocalizationService.getDyeName(dye.id) || dye.name;
          const localizedCategory = LocalizationService.getCategory(dye.category) || dye.category;

          // Filter by query
          if (
            !dye.name.toLowerCase().includes(query) &&
            !localizedName.toLowerCase().includes(query)
          ) {
            return null;
          }

          return {
            name: `${localizedName} (${localizedCategory})`,
            value: dye.name,
          };
        })
        .filter(Boolean)
        .slice(0, 25) as { name: string; value: string }[];

      await interaction.respond(matches);
      return;
    }

    // For 'add', show all dyes (except Facewear)
    const allDyes = dyeService.getAllDyes();
    const matches = allDyes
      .filter((dye) => {
        if (dye.category === 'Facewear') return false;
        const localizedName = LocalizationService.getDyeName(dye.id);
        return (
          dye.name.toLowerCase().includes(query) ||
          (localizedName && localizedName.toLowerCase().includes(query))
        );
      })
      .slice(0, 25)
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

export const favoritesCommand: BotCommand = {
  data,
  execute,
  autocomplete,
};
