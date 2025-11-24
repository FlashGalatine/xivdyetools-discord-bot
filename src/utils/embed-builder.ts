/**
 * Disc

ord embed builder utilities
 */

import { EmbedBuilder, ColorResolvable, AttachmentBuilder } from 'discord.js';
import { ColorService, type Dye } from 'xivdyetools-core';
import { getDyeEmojiFilename, getDyeEmojiBuffer } from './emoji.js';
import { emojiService } from '../services/emoji-service.js';

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
  const embed = new EmbedBuilder()
    .setColor(parseInt(dye.hex.replace('#', ''), 16) as ColorResolvable)
    .setTitle(`🎨 ${dye.name}`)
    .setDescription(`${emojiService.getDyeEmojiOrSwatch(dye, 8)}`)
    .addFields({
      name: 'Color Information',
      value: [
        `**Hex:** ${dye.hex.toUpperCase()}`,
        `**RGB:** ${formatRGB(dye.hex)}`,
        `**HSV:** ${formatHSV(dye.hex)}`,
        `**Category:** ${dye.category}`,
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
    embed.addFields({
      name: 'Acquisition',
      value: dye.acquisition,
      inline: false,
    });
  }

  return embed;
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
  const embed = new EmbedBuilder()
    .setColor(parseInt(baseColor.replace('#', ''), 16) as ColorResolvable)
    .setTitle(`🎨 Color Harmony: ${formatHarmonyType(harmonyType)}`)
    .setDescription(
      [
        `**Base Color:** ${formatColorSwatch(baseColor, 4)}`,
        `**Closest Match:** ${emojiService.getDyeEmojiOrSwatch(baseDye)} ${baseDye.name} (${baseDye.hex.toUpperCase()})`,
        '',
        `**🎯 Harmony Suggestions:**`,
      ].join('\n')
    )
    .setTimestamp();

  // Add base dye
  embed.addFields({
    name: `1️⃣ ${baseDye.name} [Base]`,
    value: [
      emojiService.getDyeEmojiOrSwatch(baseDye, 4),
      formatHSV(baseDye.hex),
      `**Acquisition:** ${baseDye.acquisition || 'Unknown'}`,
    ].join('\n'),
    inline: false,
  });

  // Add companion dyes
  companions.forEach((comp, index) => {
    const number = ['2️⃣', '3️⃣', '4️⃣', '5️⃣'][index] || `${index + 2}️⃣`;
    const deviationText =
      comp.deviation < 5 ? 'Excellent match' : comp.deviation < 15 ? 'Good match' : 'Fair match';

    embed.addFields({
      name: `${number} ${comp.dye.name}`,
      value: [
        emojiService.getDyeEmojiOrSwatch(comp.dye, 4),
        `Angle: ${Math.round(comp.angle)}° from base`,
        `Deviation: ${comp.deviation.toFixed(1)}° (${deviationText})`,
        `**Acquisition:** ${comp.dye.acquisition || 'Unknown'}`,
      ].join('\n'),
      inline: false,
    });
  });

  return embed;
}

/**
 * Format harmony type for display
 */
function formatHarmonyType(type: string): string {
  const typeMap: Record<string, string> = {
    complementary: 'Complementary',
    analogous: 'Analogous',
    triadic: 'Triadic',
    split_complementary: 'Split-Complementary',
    tetradic: 'Tetradic (Rectangle)',
    square: 'Square',
    monochromatic: 'Monochromatic',
    compound: 'Compound',
    shades: 'Shades',
  };

  return typeMap[type] || type;
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
