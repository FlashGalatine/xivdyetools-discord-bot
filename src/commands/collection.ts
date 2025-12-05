/**
 * /collection command - Manage dye collections
 * Subcommands: create, delete, add, remove, show, list, rename
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
  .setName('collection')
  .setDescription('Manage your dye collections')
  .setDescriptionLocalizations({
    ja: '染料コレクションを管理',
    de: 'Verwalten Sie Ihre Farbstoffsammlungen',
    fr: 'Gérer vos collections de teintures',
  })
  .addSubcommand((subcommand) =>
    subcommand
      .setName('create')
      .setDescription('Create a new collection')
      .setDescriptionLocalizations({
        ja: '新しいコレクションを作成',
        de: 'Eine neue Sammlung erstellen',
        fr: 'Créer une nouvelle collection',
      })
      .addStringOption((option) =>
        option
          .setName('name')
          .setDescription('Collection name')
          .setDescriptionLocalizations({
            ja: 'コレクション名',
            de: 'Sammlungsname',
            fr: 'Nom de la collection',
          })
          .setRequired(true)
          .setMaxLength(COLLECTION_LIMITS.MAX_COLLECTION_NAME_LENGTH)
      )
      .addStringOption((option) =>
        option
          .setName('description')
          .setDescription('Optional description')
          .setDescriptionLocalizations({
            ja: '説明（任意）',
            de: 'Optionale Beschreibung',
            fr: 'Description optionnelle',
          })
          .setRequired(false)
          .setMaxLength(COLLECTION_LIMITS.MAX_DESCRIPTION_LENGTH)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('delete')
      .setDescription('Delete a collection')
      .setDescriptionLocalizations({
        ja: 'コレクションを削除',
        de: 'Eine Sammlung löschen',
        fr: 'Supprimer une collection',
      })
      .addStringOption((option) =>
        option
          .setName('name')
          .setDescription('Collection name')
          .setDescriptionLocalizations({
            ja: 'コレクション名',
            de: 'Sammlungsname',
            fr: 'Nom de la collection',
          })
          .setRequired(true)
          .setAutocomplete(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('add')
      .setDescription('Add a dye to a collection')
      .setDescriptionLocalizations({
        ja: 'コレクションに染料を追加',
        de: 'Einen Farbstoff zu einer Sammlung hinzufügen',
        fr: 'Ajouter une teinture à une collection',
      })
      .addStringOption((option) =>
        option
          .setName('collection')
          .setDescription('Collection name')
          .setDescriptionLocalizations({
            ja: 'コレクション名',
            de: 'Sammlungsname',
            fr: 'Nom de la collection',
          })
          .setRequired(true)
          .setAutocomplete(true)
      )
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
      .setDescription('Remove a dye from a collection')
      .setDescriptionLocalizations({
        ja: 'コレクションから染料を削除',
        de: 'Einen Farbstoff aus einer Sammlung entfernen',
        fr: "Retirer une teinture d'une collection",
      })
      .addStringOption((option) =>
        option
          .setName('collection')
          .setDescription('Collection name')
          .setDescriptionLocalizations({
            ja: 'コレクション名',
            de: 'Sammlungsname',
            fr: 'Nom de la collection',
          })
          .setRequired(true)
          .setAutocomplete(true)
      )
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
      .setName('show')
      .setDescription("Display a collection's dyes")
      .setDescriptionLocalizations({
        ja: 'コレクションの染料を表示',
        de: 'Die Farbstoffe einer Sammlung anzeigen',
        fr: "Afficher les teintures d'une collection",
      })
      .addStringOption((option) =>
        option
          .setName('name')
          .setDescription('Collection name')
          .setDescriptionLocalizations({
            ja: 'コレクション名',
            de: 'Sammlungsname',
            fr: 'Nom de la collection',
          })
          .setRequired(true)
          .setAutocomplete(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('list')
      .setDescription('List all your collections')
      .setDescriptionLocalizations({
        ja: 'すべてのコレクションを一覧表示',
        de: 'Alle Ihre Sammlungen auflisten',
        fr: 'Lister toutes vos collections',
      })
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('rename')
      .setDescription('Rename a collection')
      .setDescriptionLocalizations({
        ja: 'コレクションの名前を変更',
        de: 'Eine Sammlung umbenennen',
        fr: 'Renommer une collection',
      })
      .addStringOption((option) =>
        option
          .setName('old_name')
          .setDescription('Current collection name')
          .setDescriptionLocalizations({
            ja: '現在のコレクション名',
            de: 'Aktueller Sammlungsname',
            fr: 'Nom actuel de la collection',
          })
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addStringOption((option) =>
        option
          .setName('new_name')
          .setDescription('New collection name')
          .setDescriptionLocalizations({
            ja: '新しいコレクション名',
            de: 'Neuer Sammlungsname',
            fr: 'Nouveau nom de la collection',
          })
          .setRequired(true)
          .setMaxLength(COLLECTION_LIMITS.MAX_COLLECTION_NAME_LENGTH)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'create':
        await handleCreate(interaction);
        break;
      case 'delete':
        await handleDelete(interaction);
        break;
      case 'add':
        await handleAdd(interaction);
        break;
      case 'remove':
        await handleRemove(interaction);
        break;
      case 'show':
        await handleShow(interaction);
        break;
      case 'list':
        await handleList(interaction);
        break;
      case 'rename':
        await handleRename(interaction);
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
    logger.error('Error executing collection command:', error);
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
 * Handle /collection create
 */
async function handleCreate(interaction: ChatInputCommandInteraction): Promise<void> {
  const name = interaction.options.getString('name', true);
  const description = interaction.options.getString('description') || undefined;
  const userId = interaction.user.id;

  logger.info(`Collection create: "${name}" for user ${userId}`);

  const result = await collectionStorage.createCollection(userId, name, description);

  if (!result.success) {
    let errorMessage: string;
    switch (result.reason) {
      case 'invalidName':
        errorMessage = t('collection.invalidName', {
          max: COLLECTION_LIMITS.MAX_COLLECTION_NAME_LENGTH,
        });
        break;
      case 'descriptionTooLong':
        errorMessage = t('collection.descriptionTooLong', {
          max: COLLECTION_LIMITS.MAX_DESCRIPTION_LENGTH,
        });
        break;
      case 'limitReached':
        errorMessage = t('collection.limitReached', { max: COLLECTION_LIMITS.MAX_COLLECTIONS });
        break;
      case 'nameExists':
        errorMessage = t('collection.nameExists', { name });
        break;
      default:
        errorMessage = t('errors.errorProcessingRequest');
    }
    const errorEmbed = createErrorEmbed(t('errors.error'), errorMessage);
    await sendEphemeralError(interaction, { embeds: [errorEmbed] });
    return;
  }

  const embed = createSuccessEmbed(
    t('collection.created'),
    t('collection.createdMessage', { name: result.collection!.name })
  );

  if (description) {
    embed.addFields({ name: t('collection.description'), value: description, inline: false });
  }

  await interaction.editReply({ embeds: [embed] });
  logger.info(`Created collection "${name}" for user ${userId}`);
}

/**
 * Handle /collection delete
 */
async function handleDelete(interaction: ChatInputCommandInteraction): Promise<void> {
  const name = interaction.options.getString('name', true);
  const userId = interaction.user.id;

  logger.info(`Collection delete: "${name}" for user ${userId}`);

  const collection = await collectionStorage.getCollection(userId, name);
  if (!collection) {
    const errorEmbed = createErrorEmbed(t('errors.error'), t('collection.notFound', { name }));
    await sendEphemeralError(interaction, { embeds: [errorEmbed] });
    return;
  }

  const deleted = await collectionStorage.deleteCollection(userId, name);

  if (!deleted) {
    const errorEmbed = createErrorEmbed(t('errors.error'), t('collection.notFound', { name }));
    await sendEphemeralError(interaction, { embeds: [errorEmbed] });
    return;
  }

  const embed = createSuccessEmbed(
    t('collection.deleted'),
    t('collection.deletedMessage', { name: collection.name, count: collection.dyes.length })
  );

  await interaction.editReply({ embeds: [embed] });
  logger.info(`Deleted collection "${name}" for user ${userId}`);
}

/**
 * Handle /collection add
 */
async function handleAdd(interaction: ChatInputCommandInteraction): Promise<void> {
  const collectionName = interaction.options.getString('collection', true);
  const dyeName = interaction.options.getString('dye', true);
  const userId = interaction.user.id;

  logger.info(`Collection add dye: "${dyeName}" to "${collectionName}" for user ${userId}`);

  // Find the dye
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
  const result = await collectionStorage.addDyeToCollection(userId, collectionName, dye.id);

  if (!result.success) {
    let errorMessage: string;
    switch (result.reason) {
      case 'notFound':
        errorMessage = t('collection.notFound', { name: collectionName });
        break;
      case 'alreadyInCollection':
        errorMessage = t('collection.dyeAlreadyInCollection', {
          dye: LocalizationService.getDyeName(dye.id) || dye.name,
          collection: collectionName,
        });
        break;
      case 'collectionFull':
        errorMessage = t('collection.collectionFull', {
          max: COLLECTION_LIMITS.MAX_DYES_PER_COLLECTION,
        });
        break;
      default:
        errorMessage = t('errors.errorProcessingRequest');
    }
    const errorEmbed = createErrorEmbed(t('errors.error'), errorMessage);
    await sendEphemeralError(interaction, { embeds: [errorEmbed] });
    return;
  }

  const localizedDyeName = LocalizationService.getDyeName(dye.id) || dye.name;
  const embed = createSuccessEmbed(
    t('collection.dyeAdded'),
    t('collection.dyeAddedMessage', { dye: localizedDyeName, collection: collectionName })
  );
  embed.setColor(parseInt(dye.hex.replace('#', ''), 16));

  await interaction.editReply({ embeds: [embed] });
  logger.info(`Added ${dye.name} to collection "${collectionName}" for user ${userId}`);
}

/**
 * Handle /collection remove
 */
async function handleRemove(interaction: ChatInputCommandInteraction): Promise<void> {
  const collectionName = interaction.options.getString('collection', true);
  const dyeName = interaction.options.getString('dye', true);
  const userId = interaction.user.id;

  logger.info(`Collection remove dye: "${dyeName}" from "${collectionName}" for user ${userId}`);

  // Find the dye
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
  const result = await collectionStorage.removeDyeFromCollection(userId, collectionName, dye.id);

  if (!result.success) {
    let errorMessage: string;
    switch (result.reason) {
      case 'notFound':
        errorMessage = t('collection.notFound', { name: collectionName });
        break;
      case 'dyeNotInCollection':
        errorMessage = t('collection.dyeNotInCollection', {
          dye: LocalizationService.getDyeName(dye.id) || dye.name,
          collection: collectionName,
        });
        break;
      default:
        errorMessage = t('errors.errorProcessingRequest');
    }
    const errorEmbed = createErrorEmbed(t('errors.error'), errorMessage);
    await sendEphemeralError(interaction, { embeds: [errorEmbed] });
    return;
  }

  const localizedDyeName = LocalizationService.getDyeName(dye.id) || dye.name;
  const embed = createSuccessEmbed(
    t('collection.dyeRemoved'),
    t('collection.dyeRemovedMessage', { dye: localizedDyeName, collection: collectionName })
  );

  await interaction.editReply({ embeds: [embed] });
  logger.info(`Removed ${dye.name} from collection "${collectionName}" for user ${userId}`);
}

/**
 * Handle /collection show
 */
async function handleShow(interaction: ChatInputCommandInteraction): Promise<void> {
  const name = interaction.options.getString('name', true);
  const userId = interaction.user.id;

  logger.info(`Collection show: "${name}" for user ${userId}`);

  const collection = await collectionStorage.getCollection(userId, name);

  if (!collection) {
    const errorEmbed = createErrorEmbed(t('errors.error'), t('collection.notFound', { name }));
    await sendEphemeralError(interaction, { embeds: [errorEmbed] });
    return;
  }

  // Build embed
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`📁 ${collection.name}`)
    .setTimestamp();

  if (collection.description) {
    embed.setDescription(collection.description);
  }

  if (collection.dyes.length === 0) {
    embed.addFields({
      name: t('collection.dyes'),
      value: t('collection.emptyCollection'),
      inline: false,
    });
  } else {
    // Build dye list
    const dyeList = collection.dyes
      .map((dyeId, index) => {
        const dye = dyeService.getDyeById(dyeId);
        if (!dye) return null;

        const localizedName = LocalizationService.getDyeName(dye.id) || dye.name;
        return `${index + 1}. ${emojiService.getDyeEmojiOrSwatch(dye, 3)} **${localizedName}** (${dye.hex.toUpperCase()})`;
      })
      .filter(Boolean)
      .join('\n');

    embed.addFields({
      name: `${t('collection.dyes')} (${collection.dyes.length})`,
      value: dyeList || t('collection.emptyCollection'),
      inline: false,
    });
  }

  // Add metadata
  const createdDate = new Date(collection.createdAt).toLocaleDateString();
  const updatedDate = new Date(collection.updatedAt).toLocaleDateString();
  embed.setFooter({
    text: `${t('collection.created')}: ${createdDate} • ${t('collection.updated')}: ${updatedDate}`,
  });

  await interaction.editReply({ embeds: [embed] });
  logger.info(`Showed collection "${name}" for user ${userId}`);
}

/**
 * Handle /collection list
 */
async function handleList(interaction: ChatInputCommandInteraction): Promise<void> {
  const userId = interaction.user.id;

  logger.info(`Collection list for user ${userId}`);

  const collections = await collectionStorage.getCollections(userId);

  if (collections.length === 0) {
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`📁 ${t('collection.yourCollections')}`)
      .setDescription(t('collection.emptyList'))
      .setFooter({ text: t('collection.createTip') })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // Build collection list
  const collectionList = collections
    .map((collection, index) => {
      const dyeCount = collection.dyes.length;
      const description = collection.description ? `\n   ${collection.description}` : '';
      return `${index + 1}. **${collection.name}** (${dyeCount} ${dyeCount === 1 ? t('labels.dye') : t('labels.dyes')})${description}`;
    })
    .join('\n\n');

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`📁 ${t('collection.yourCollections')} (${collections.length})`)
    .setDescription(collectionList)
    .setFooter({
      text: t('collection.listFooter', {
        current: collections.length,
        max: COLLECTION_LIMITS.MAX_COLLECTIONS,
      }),
    })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
  logger.info(`Listed ${collections.length} collections for user ${userId}`);
}

/**
 * Handle /collection rename
 */
async function handleRename(interaction: ChatInputCommandInteraction): Promise<void> {
  const oldName = interaction.options.getString('old_name', true);
  const newName = interaction.options.getString('new_name', true);
  const userId = interaction.user.id;

  logger.info(`Collection rename: "${oldName}" to "${newName}" for user ${userId}`);

  const result = await collectionStorage.renameCollection(userId, oldName, newName);

  if (!result.success) {
    let errorMessage: string;
    switch (result.reason) {
      case 'invalidName':
        errorMessage = t('collection.invalidName', {
          max: COLLECTION_LIMITS.MAX_COLLECTION_NAME_LENGTH,
        });
        break;
      case 'notFound':
        errorMessage = t('collection.notFound', { name: oldName });
        break;
      case 'nameExists':
        errorMessage = t('collection.nameExists', { name: newName });
        break;
      default:
        errorMessage = t('errors.errorProcessingRequest');
    }
    const errorEmbed = createErrorEmbed(t('errors.error'), errorMessage);
    await sendEphemeralError(interaction, { embeds: [errorEmbed] });
    return;
  }

  const embed = createSuccessEmbed(
    t('collection.renamed'),
    t('collection.renamedMessage', { oldName, newName })
  );

  await interaction.editReply({ embeds: [embed] });
  logger.info(`Renamed collection "${oldName}" to "${newName}" for user ${userId}`);
}

/**
 * Autocomplete handler
 */
export async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const focusedOption = interaction.options.getFocused(true);
  const userId = interaction.user.id;

  // Collection name autocomplete
  if (
    focusedOption.name === 'name' ||
    focusedOption.name === 'collection' ||
    focusedOption.name === 'old_name'
  ) {
    const query = focusedOption.value.toLowerCase();
    const collections = await collectionStorage.getCollections(userId);

    const matches = collections
      .filter((c) => c.name.toLowerCase().includes(query))
      .slice(0, 25)
      .map((c) => ({
        name: `${c.name} (${c.dyes.length} ${c.dyes.length === 1 ? 'dye' : 'dyes'})`,
        value: c.name,
      }));

    await interaction.respond(matches);
    return;
  }

  // Dye autocomplete
  if (focusedOption.name === 'dye') {
    const query = focusedOption.value.toLowerCase();
    const subcommand = interaction.options.getSubcommand();

    // For 'remove', only show dyes in the selected collection
    if (subcommand === 'remove') {
      const collectionName = interaction.options.getString('collection');
      if (collectionName) {
        const collection = await collectionStorage.getCollection(userId, collectionName);
        if (collection) {
          const matches = collection.dyes
            .map((dyeId) => {
              const dye = dyeService.getDyeById(dyeId);
              if (!dye) return null;

              const localizedName = LocalizationService.getDyeName(dye.id) || dye.name;

              // Filter by query
              if (
                !dye.name.toLowerCase().includes(query) &&
                !localizedName.toLowerCase().includes(query)
              ) {
                return null;
              }

              return {
                name: `${localizedName} (${dye.hex.toUpperCase()})`,
                value: dye.name,
              };
            })
            .filter(Boolean)
            .slice(0, 25) as { name: string; value: string }[];

          await interaction.respond(matches);
          return;
        }
      }
    }

    // For 'add' and other cases, show all dyes
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

export const collectionCommand: BotCommand = {
  data,
  execute,
  autocomplete,
};
