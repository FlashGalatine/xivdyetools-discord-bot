/**
 * /match command - Find the closest dye to a given color
 */

import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    AutocompleteInteraction,
    EmbedBuilder,
    ColorResolvable,
} from 'discord.js';
import {
    DyeService,
    ColorService,
    dyeDatabase,
    type Dye,
} from 'xivdyetools-core';
import { validateHexColor, findDyeByName } from '../utils/validators.js';
import { createErrorEmbed, formatColorSwatch, formatRGB, formatHSV } from '../utils/embed-builder.js';
import { logger } from '../utils/logger.js';
import { emojiService } from '../services/emoji-service.js';
import type { BotCommand } from '../types/index.js';

const dyeService = new DyeService(dyeDatabase);

export const data = new SlashCommandBuilder()
    .setName('match')
    .setDescription('Find the closest FFXIV dye to a given color')
    .addStringOption((option) =>
        option
            .setName('color')
            .setDescription('Color: hex (e.g., #FF0000) or dye name (e.g., Dalamud Red)')
            .setRequired(true)
            .setAutocomplete(true)
    );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    try {
        const colorInput = interaction.options.getString('color', true);

        logger.info(`Match command: ${colorInput}`);

        // Determine if input is hex or dye name
        let targetColor: string;
        let inputDye: Dye | null = null;

        const hexValidation = validateHexColor(colorInput);
        if (hexValidation.valid) {
            // Input is a hex color
            targetColor = colorInput;
        } else {
            // Input might be a dye name
            const dyeResult = findDyeByName(colorInput);
            if (dyeResult.error) {
                const errorEmbed = createErrorEmbed(
                    'Invalid Input',
                    `"${colorInput}" is not a valid hex color or dye name.\n\n` +
                    `**Examples:**\n` +
                    `• Hex: \`#FF0000\`, \`#8A2BE2\`\n` +
                    `• Dye: \`Dalamud Red\`, \`Snow White\``
                );
                await interaction.editReply({ embeds: [errorEmbed] });
                return;
            }
            inputDye = dyeResult.dye!;
            targetColor = inputDye.hex;
        }

        // Find closest dye
        const closestDye = dyeService.findClosestDye(targetColor);
        if (!closestDye) {
            const errorEmbed = createErrorEmbed('Error', 'Could not find matching dye.');
            await interaction.editReply({ embeds: [errorEmbed] });
            return;
        }

        // Calculate color distance
        const distance = ColorService.getColorDistance(targetColor, closestDye.hex);

        // Determine match quality
        let matchQuality: string;
        let matchEmoji: string;
        if (distance === 0) {
            matchQuality = 'Perfect match';
            matchEmoji = '🎯';
        } else if (distance < 10) {
            matchQuality = 'Excellent match';
            matchEmoji = '✨';
        } else if (distance < 25) {
            matchQuality = 'Good match';
            matchEmoji = '👍';
        } else if (distance < 50) {
            matchQuality = 'Fair match';
            matchEmoji = '👌';
        } else {
            matchQuality = 'Approximate match';
            matchEmoji = '🔍';
        }

        // Create embed
        const embed = new EmbedBuilder()
            .setColor(parseInt(closestDye.hex.replace('#', ''), 16) as ColorResolvable)
            .setTitle(`${matchEmoji} Dye Match: ${closestDye.name}`)
            .setDescription(
                inputDye
                    ? `Finding closest match for **${inputDye.name}**`
                    : `Finding closest match for **${targetColor.toUpperCase()}**`
            )
            .addFields(
                {
                    name: 'Input Color',
                    value: [
                        formatColorSwatch(targetColor, 6),
                        `**Hex:** ${targetColor.toUpperCase()}`,
                        `**RGB:** ${formatRGB(targetColor)}`,
                        `**HSV:** ${formatHSV(targetColor)}`,
                    ].join('\n'),
                    inline: false,
                },
                {
                    name: `Closest Dye: ${closestDye.name}`,
                    value: [
                        emojiService.getDyeEmojiOrSwatch(closestDye, 6),
                        `**Hex:** ${closestDye.hex.toUpperCase()}`,
                        `**RGB:** ${formatRGB(closestDye.hex)}`,
                        `**HSV:** ${formatHSV(closestDye.hex)}`,
                        `**Category:** ${closestDye.category}`,
                    ].join('\n'),
                    inline: false,
                },
                {
                    name: 'Match Quality',
                    value: [
                        `**Distance:** ${distance.toFixed(2)} (Euclidean)`,
                        `**Quality:** ${matchQuality}`,
                    ].join('\n'),
                    inline: false,
                }
            )
            .setTimestamp();

        // Add acquisition info if available
        if (closestDye.acquisition) {
            embed.addFields({
                name: 'Acquisition',
                value: closestDye.acquisition,
                inline: false,
            });
        }

        // Add emoji thumbnail if available
        const emoji = emojiService.getDyeEmoji(closestDye);
        if (emoji) {
            embed.setThumbnail(emoji.url);
        }

        // Send response
        await interaction.editReply({ embeds: [embed] });

        logger.info(`Match command completed: ${closestDye.name} (distance: ${distance.toFixed(2)})`);
    } catch (error) {
        logger.error('Error executing match command:', error);
        const errorEmbed = createErrorEmbed(
            'Command Error',
            'An error occurred while finding the closest dye. Please try again.'
        );

        if (interaction.deferred) {
            await interaction.editReply({ embeds: [errorEmbed] });
        } else {
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    }
}

/**
 * Autocomplete handler for color parameter
 */
export async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focusedOption = interaction.options.getFocused(true);

    if (focusedOption.name === 'color') {
        const query = focusedOption.value.toLowerCase();

        // If it looks like a hex color, don't suggest dyes
        if (query.startsWith('#')) {
            await interaction.respond([]);
            return;
        }

        // Search for matching dyes
        const allDyes = dyeService.getAllDyes();
        const matches = allDyes
            .filter(dye => {
                // Exclude Facewear category
                if (dye.category === 'Facewear') return false;

                // Match name (case-insensitive)
                return dye.name.toLowerCase().includes(query);
            })
            .slice(0, 25) // Discord limits to 25 choices
            .map(dye => ({
                name: `${dye.name} (${dye.category})`,
                value: dye.name,
            }));

        await interaction.respond(matches);
    }
}

export const matchCommand: BotCommand = {
    data,
    execute,
    autocomplete,
};
