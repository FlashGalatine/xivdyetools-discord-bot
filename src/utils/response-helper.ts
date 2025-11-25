import {
  ChatInputCommandInteraction,
  InteractionReplyOptions,
  InteractionEditReplyOptions,
  MessageFlags,
} from 'discord.js';

/**
 * Send a public success response.
 *
 * This function uses editReply() to update the deferred message with the success response.
 * The message is public and visible to everyone in the channel.
 *
 * @param interaction - The command interaction
 * @param response - The response options (embeds, files, content, etc.)
 *
 * @example
 * ```typescript
 * await interaction.deferReply();
 * // ... command logic ...
 * await sendPublicSuccess(interaction, {
 *   embeds: [successEmbed],
 *   files: [attachment],
 * });
 * ```
 */
export async function sendPublicSuccess(
  interaction: ChatInputCommandInteraction,
  response: InteractionEditReplyOptions
): Promise<void> {
  await interaction.editReply(response);
}

/**
 * Send an ephemeral error response.
 *
 * If the interaction has been deferred, uses followUp() with ephemeral flag.
 * Otherwise, uses reply() with the ephemeral flag.
 * This ensures error messages are only visible to the user who ran the command.
 *
 * @param interaction - The command interaction
 * @param response - The response options (embeds, content, etc.)
 *
 * @example
 * ```typescript
 * await interaction.deferReply();
 * // ... validation ...
 * if (error) {
 *   await sendEphemeralError(interaction, {
 *     embeds: [errorEmbed],
 *   });
 *   return;
 * }
 * ```
 */
export async function sendEphemeralError(
  interaction: ChatInputCommandInteraction,
  response: InteractionEditReplyOptions
): Promise<void> {
  if (interaction.deferred) {
    // Use followUp with ephemeral flag to send error only to user
    await interaction.followUp({
      ...response,
      flags: MessageFlags.Ephemeral,
    } as InteractionReplyOptions);
  } else {
    // Not deferred yet, reply with ephemeral flag
    await interaction.reply({
      ...response,
      flags: MessageFlags.Ephemeral,
    } as InteractionReplyOptions);
  }
}
