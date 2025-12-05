/**
 * Button Interaction Handler
 * Handles copy button clicks for dye color values
 */

import { ButtonInteraction, MessageFlags } from 'discord.js';
import { ColorService } from 'xivdyetools-core';
import { t } from '../services/i18n-service.js';
import { logger } from '../utils/logger.js';
import { COPY_HEX_PREFIX, COPY_RGB_PREFIX, COPY_HSV_PREFIX } from '../utils/button-builder.js';

/**
 * Handle button interactions for copy dye info buttons
 *
 * Button customIds are formatted as: `copy_<type>_<hex>`
 * - copy_hex_#E71828 -> Returns hex value
 * - copy_rgb_#E71828 -> Calculates and returns RGB
 * - copy_hsv_#E71828 -> Calculates and returns HSV
 *
 * @param interaction - The button interaction from Discord
 */
export async function handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
  const customId = interaction.customId;

  try {
    if (customId.startsWith(COPY_HEX_PREFIX)) {
      const hex = customId.slice(COPY_HEX_PREFIX.length);
      await interaction.reply({
        content: t('buttons.copyHexResponse', { value: hex.toUpperCase() }),
        flags: MessageFlags.Ephemeral,
      });
    } else if (customId.startsWith(COPY_RGB_PREFIX)) {
      const hex = customId.slice(COPY_RGB_PREFIX.length);
      const rgb = ColorService.hexToRgb(hex);
      const rgbString = `RGB(${rgb.r}, ${rgb.g}, ${rgb.b})`;
      await interaction.reply({
        content: t('buttons.copyRgbResponse', { value: rgbString }),
        flags: MessageFlags.Ephemeral,
      });
    } else if (customId.startsWith(COPY_HSV_PREFIX)) {
      const hex = customId.slice(COPY_HSV_PREFIX.length);
      const hsv = ColorService.hexToHsv(hex);
      const hsvString = `HSV(${Math.round(hsv.h)}°, ${Math.round(hsv.s)}%, ${Math.round(hsv.v)}%)`;
      await interaction.reply({
        content: t('buttons.copyHsvResponse', { value: hsvString }),
        flags: MessageFlags.Ephemeral,
      });
    }
    // Unknown button customIds are silently ignored (could be from other features)
  } catch (error) {
    logger.error('Error handling button interaction:', error);
    if (!interaction.replied) {
      await interaction.reply({
        content: t('errors.errorExecutingCommand'),
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}
