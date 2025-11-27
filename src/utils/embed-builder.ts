/**
 * Discord embed builder utilities
 */

import { EmbedBuilder, ColorResolvable, AttachmentBuilder } from 'discord.js';
import { ColorService, LocalizationService, type Dye } from 'xivdyetools-core';
import { getDyeEmojiFilename, getDyeEmojiBuffer } from './emoji.js';
import { emojiService } from '../services/emoji-service.js';
import { t } from '../services/i18n-service.js';

/**
 * Brand colors for embeds
 */
export const COLORS = {
  PRIMARY: 0x5865f2, // Discord blurple
  SUCCESS: 0x57f287, // Green
  ERROR: 0xed4245, // Red
  WARNING: 0xfee75c, // Yellow
  INFO: 0x5865f2, // Blue
};

/**
 * Format hex color as Unicode block swatch
 */
export function formatColorSwatch(hexColor: string, size: number = 4): string {
  return '█'.repeat(size) + ' ' + hexColor.toUpperCase();
}

/**
 * Format RGB values
 */
export function formatRGB(hexColor: string): string {
  const rgb = ColorService.hexToRgb(hexColor);
  return `RGB(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}

/**
 * Format HSV values
 */
export function formatHSV(hexColor: string): string {
  const hsv = ColorService.hexToHsv(hexColor);
  return `HSV(${Math.round(hsv.h)}°, ${Math.round(hsv.s)}%, ${Math.round(hsv.v)}%)`;
}

/**
 * Format price in Gil
 */
export function formatPrice(gil: number): string {
  return `${gil.toLocaleString()} Gil`;
}

/**
 * Create an error embed
 */
export function createErrorEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.ERROR)
    .setTitle(`❌ ${title}`)
    .setDescription(description)
    .setTimestamp();
}

/**
 * Create a success embed
 */
export function createSuccessEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.SUCCESS)
    .setTitle(`✅ ${title}`)
    .setDescription(description)
    .setTimestamp();
}

/**
 * Create an info embed
 */
export function createInfoEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.INFO)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}

/**
 * Create dye information embed
 * @param dye - The dye to create an embed for
 * @param showExtended - Whether to show acquisition info
 * @param useEmoji - Whether to add emoji thumbnail (default: true)
 * @param useFileAttachment - Whether to use attachment:// URL for thumbnail (default: false)
 */
export function createDyeEmbed(
  dye: Dye,
  showExtended: boolean = false,
  useEmoji: boolean = true,
  useFileAttachment: boolean = false
): EmbedBuilder {
  // Get localized dye name and category from core library (with fallbacks)
  const localizedDyeName = LocalizationService.getDyeName(dye.id) || dye.name;
  const localizedCategory = LocalizationService.getCategory(dye.category) || dye.category;

  const embed = new EmbedBuilder()
    .setColor(parseInt(dye.hex.replace('#', ''), 16) as ColorResolvable)
    .setTitle(`🎨 ${localizedDyeName}`)
    .setDescription(`${emojiService.getDyeEmojiOrSwatch(dye, 8)}`)
    .addFields({
      name: t('embeds.colorInformation'),
      value: [
        `**${t('embeds.hex')}:** ${dye.hex.toUpperCase()}`,
        `**${t('embeds.rgb')}:** ${formatRGB(dye.hex)}`,
        `**${t('embeds.hsv')}:** ${formatHSV(dye.hex)}`,
        `**${t('embeds.category')}:** ${localizedCategory}`,
      ].join('\n'),
      inline: false,
    })
    .setTimestamp();

  // Add emoji thumbnail if available
  if (useFileAttachment) {
    // Use attachment:// to reference the attached file
    embed.setThumbnail(`attachment://${getDyeEmojiFilename(dye)}`);
  } else {
    const emoji = emojiService.getDyeEmoji(dye);
    if (useEmoji && emoji) {
      embed.setThumbnail(emoji.imageURL());
    }
  }

  if (showExtended && dye.acquisition) {
    const localizedAcquisition =
      LocalizationService.getAcquisition(dye.acquisition) || dye.acquisition;
    embed.addFields({
      name: t('embeds.acquisition'),
      value: localizedAcquisition,
      inline: false,
    });
  }

  return embed;
}

/**
 * Format harmony type for display (Title Case with proper formatting)
 */
function formatHarmonyType(harmonyType: string): string {
  return harmonyType
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('-');
}

/**
 * Create harmony result embed
 */
export function createHarmonyEmbed(
  baseColor: string,
  baseDye: Dye,
  harmonyType: string,
  companions: Array<{ dye: Dye; angle: number; deviation: number }>
): EmbedBuilder {
  // Get localized harmony type from core library (with fallback)
  const localizedHarmonyType =
    LocalizationService.getHarmonyType(
      harmonyType as Parameters<typeof LocalizationService.getHarmonyType>[0]
    ) || formatHarmonyType(harmonyType);
  const localizedBaseDyeName = LocalizationService.getDyeName(baseDye.id) || baseDye.name;

  const embed = new EmbedBuilder()
    .setColor(parseInt(baseColor.replace('#', ''), 16) as ColorResolvable)
    .setTitle(`🎨 ${t('embeds.colorHarmony')}: ${localizedHarmonyType}`)
    .setDescription(
      [
        `**${t('embeds.baseColor')}:** ${formatColorSwatch(baseColor, 4)}`,
        `**${t('embeds.closestMatch')}:** ${emojiService.getDyeEmojiOrSwatch(baseDye)} ${localizedBaseDyeName} (${baseDye.hex.toUpperCase()})`,
        '',
        `**🎯 ${t('embeds.harmonySuggestions')}:**`,
      ].join('\n')
    )
    .setTimestamp();

  // Add base dye
  const localizedBaseAcquisition = baseDye.acquisition
    ? LocalizationService.getAcquisition(baseDye.acquisition) || baseDye.acquisition
    : t('labels.unknown');
  embed.addFields({
    name: `1️⃣ ${localizedBaseDyeName} [${t('embeds.base')}]`,
    value: [
      emojiService.getDyeEmojiOrSwatch(baseDye, 4),
      formatHSV(baseDye.hex),
      `**${t('embeds.acquisition')}:** ${localizedBaseAcquisition}`,
    ].join('\n'),
    inline: false,
  });

  // Add companion dyes
  companions.forEach((comp, index) => {
    const number = ['2️⃣', '3️⃣', '4️⃣', '5️⃣'][index] || `${index + 2}️⃣`;
    const localizedCompDyeName = LocalizationService.getDyeName(comp.dye.id) || comp.dye.name;
    const localizedCompAcquisition = comp.dye.acquisition
      ? LocalizationService.getAcquisition(comp.dye.acquisition) || comp.dye.acquisition
      : t('labels.unknown');
    const deviationText =
      comp.deviation < 5
        ? t('matchQuality.excellent')
        : comp.deviation < 15
          ? t('matchQuality.good')
          : t('matchQuality.fair');

    embed.addFields({
      name: `${number} ${localizedCompDyeName}`,
      value: [
        emojiService.getDyeEmojiOrSwatch(comp.dye, 4),
        `${t('embeds.angle')}: ${Math.round(comp.angle)}° ${t('embeds.fromBase')}`,
        `${t('embeds.deviation')}: ${comp.deviation.toFixed(1)}° (${deviationText})`,
        `**${t('embeds.acquisition')}:** ${localizedCompAcquisition}`,
      ].join('\n'),
      inline: false,
    });
  });

  return embed;
}

/**
 * Create dye emoji attachment if available
 * Returns null if emoji doesn't exist for this dye
 */
export function createDyeEmojiAttachment(dye: Dye): AttachmentBuilder | null {
  const emojiBuffer = getDyeEmojiBuffer(dye);

  if (!emojiBuffer) {
    return null;
  }

  return new AttachmentBuilder(emojiBuffer, {
    name: getDyeEmojiFilename(dye),
  });
}
