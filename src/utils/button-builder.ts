/**
 * Button Builder Utilities
 * Creates ActionRow components with copy buttons for dye color values
 */

import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { t } from '../services/i18n-service.js';

// Button customId prefixes - used by button-handler to identify button type
export const COPY_HEX_PREFIX = 'copy_hex_';
export const COPY_RGB_PREFIX = 'copy_rgb_';
export const COPY_HSV_PREFIX = 'copy_hsv_';

/**
 * Create a row of copy buttons for a dye's color values
 *
 * @param hex - The hex color value (e.g., "#E71828")
 * @returns ActionRowBuilder with Copy Hex, Copy RGB, Copy HSV buttons
 *
 * @example
 * const buttons = createCopyButtonsRow('#E71828');
 * await interaction.editReply({ embeds: [embed], components: [buttons] });
 */
export function createCopyButtonsRow(hex: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${COPY_HEX_PREFIX}${hex}`)
      .setLabel(t('buttons.copyHex'))
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📋'),
    new ButtonBuilder()
      .setCustomId(`${COPY_RGB_PREFIX}${hex}`)
      .setLabel(t('buttons.copyRgb'))
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`${COPY_HSV_PREFIX}${hex}`)
      .setLabel(t('buttons.copyHsv'))
      .setStyle(ButtonStyle.Secondary)
  );
}
