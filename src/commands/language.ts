/**
 * /language command - Set user language preference
 */

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { i18nService, t, type LocaleCode } from '../services/i18n-service.js';
import { COLORS } from '../utils/embed-builder.js';
import type { BotCommand } from '../types/index.js';

/**
 * Language choices for the command
 */
const languageChoices = [
  { name: 'English', value: 'en' },
  { name: '日本語 (Japanese)', value: 'ja' },
  { name: 'Deutsch (German)', value: 'de' },
  { name: 'Français (French)', value: 'fr' },
];

export const data = new SlashCommandBuilder()
  .setName('language')
  .setDescription('Set your preferred language for bot responses')
  .setDescriptionLocalizations({
    ja: 'ボットの応答に使用する言語を設定',
    de: 'Stelle deine bevorzugte Sprache für Bot-Antworten ein',
    fr: 'Définir votre langue préférée pour les réponses du bot',
  })
  .addSubcommand((subcommand) =>
    subcommand
      .setName('set')
      .setDescription('Set your preferred language')
      .setDescriptionLocalizations({
        ja: '使用言語を設定',
        de: 'Stelle deine bevorzugte Sprache ein',
        fr: 'Définir votre langue préférée',
      })
      .addStringOption((option) =>
        option
          .setName('language')
          .setDescription('Language to use')
          .setDescriptionLocalizations({
            ja: '使用する言語',
            de: 'Zu verwendende Sprache',
            fr: 'Langue à utiliser',
          })
          .setRequired(true)
          .addChoices(...languageChoices)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('show')
      .setDescription('Show your current language setting')
      .setDescriptionLocalizations({
        ja: '現在の言語設定を表示',
        de: 'Zeige deine aktuelle Spracheinstellung an',
        fr: 'Afficher votre paramètre de langue actuel',
      })
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('reset')
      .setDescription("Reset to use Discord's language")
      .setDescriptionLocalizations({
        ja: 'Discordの言語設定を使用するようにリセット',
        de: 'Setze auf Discord-Sprache zurück',
        fr: 'Réinitialiser pour utiliser la langue de Discord',
      })
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  // Set locale from interaction first (for proper translations)
  await i18nService.setLocaleFromInteraction(interaction);

  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'set':
      await handleSet(interaction);
      break;
    case 'show':
      await handleShow(interaction);
      break;
    case 'reset':
      await handleReset(interaction);
      break;
    default:
      await interaction.reply({
        content: t('errors.unknownSubcommand'),
        flags: MessageFlags.Ephemeral,
      });
  }
}

/**
 * Handle /language set
 */
async function handleSet(interaction: ChatInputCommandInteraction): Promise<void> {
  const locale = interaction.options.getString('language', true) as LocaleCode;
  const userId = interaction.user.id;

  // Save preference to Redis
  const success = await i18nService.setUserPreference(userId, locale);

  if (!success) {
    await interaction.reply({
      content: t('errors.errorProcessingRequest'),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Update current locale
  i18nService.setLocale(locale);

  // Create success embed
  const displayName = i18nService.getLocaleDisplayName(locale);
  const embed = new EmbedBuilder()
    .setColor(COLORS.SUCCESS)
    .setTitle(`✅ ${t('language.languageSet')}`)
    .setDescription(t('language.languageSetTo', { language: displayName }))
    .setTimestamp();

  await interaction.reply({
    embeds: [embed],
    flags: MessageFlags.Ephemeral,
  });
}

/**
 * Handle /language show
 */
async function handleShow(interaction: ChatInputCommandInteraction): Promise<void> {
  const userId = interaction.user.id;
  const userPreference = await i18nService.getUserPreference(userId);

  const embed = new EmbedBuilder()
    .setColor(COLORS.INFO)
    .setTitle(`🌐 ${t('language.currentLanguage')}`)
    .setTimestamp();

  if (userPreference) {
    const displayName = i18nService.getLocaleDisplayName(userPreference);
    embed.setDescription(t('language.yourLanguage', { language: displayName }));
  } else {
    // Using Discord locale
    const discordLocale = i18nService.discordLocaleToLocaleCode(interaction.locale);
    const displayName = discordLocale ? i18nService.getLocaleDisplayName(discordLocale) : 'English';
    embed.setDescription(t('language.usingDiscordLocale', { language: displayName }));
  }

  // Add supported languages
  const supportedLocales = i18nService.getSupportedLocales();
  embed.addFields({
    name: '📋 Supported Languages',
    value: supportedLocales.map((l) => `• ${l.name} (\`${l.code}\`)`).join('\n'),
    inline: false,
  });

  await interaction.reply({
    embeds: [embed],
    flags: MessageFlags.Ephemeral,
  });
}

/**
 * Handle /language reset
 */
async function handleReset(interaction: ChatInputCommandInteraction): Promise<void> {
  const userId = interaction.user.id;

  // Clear preference from Redis
  await i18nService.clearUserPreference(userId);

  // Update locale from Discord
  await i18nService.setLocaleFromInteraction(interaction);

  const embed = new EmbedBuilder()
    .setColor(COLORS.SUCCESS)
    .setTitle(`🔄 ${t('language.languageReset')}`)
    .setDescription(t('language.languageResetMessage'))
    .setTimestamp();

  await interaction.reply({
    embeds: [embed],
    flags: MessageFlags.Ephemeral,
  });
}

export const languageCommand: BotCommand = {
  data,
  execute,
};
