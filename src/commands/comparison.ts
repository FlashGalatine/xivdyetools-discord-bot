/**
 * /comparison command - Compare multiple dyes side-by-side
 */

import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    AttachmentBuilder,
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
import { renderSwatchGrid } from '../renderers/swatch-grid.js';
import { logger } from '../utils/logger.js';
import { emojiService } from '../services/emoji-service.js';
import type { BotCommand } from '../types/index.js';

const dyeService = new DyeService(dyeDatabase);

interface DyePair {
    dye1: Dye;
    dye2: Dye;
    distance: number;
}

export const data = new SlashCommandBuilder()
    .setName('comparison')
    .setDescription('Compare multiple FFXIV dyes side-by-side')
    .addStringOption((option) =>
        option
            .setName('dye1')
            .setDescription('First dye: hex (e.g., #FF0000) or dye name')
            .setRequired(true)
            .setAutocomplete(true)
    )
    .addStringOption((option) =>
        option
            .setName('dye2')
            .setDescription('Second dye: hex (e.g., #00FF00) or dye name')
            .setRequired(true)
            .setAutocomplete(true)
    )
    .addStringOption((option) =>
        option
            .setName('dye3')
            .setDescription('Third dye (optional): hex or dye name')
            .setRequired(false)
            .setAutocomplete(true)
    )
    .addStringOption((option) =>
        option
            .setName('dye4')
            .setDescription('Fourth dye (optional): hex or dye name')
            .setRequired(false)
            .setAutocomplete(true)
    );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    try {
        const dyeInputs = [
            interaction.options.getString('dye1', true),
            interaction.options.getString('dye2', true),
            interaction.options.getString('dye3'),
            interaction.options.getString('dye4'),
        ].filter((input): input is string => input !== null);

        logger.info(`Comparison command: ${dyeInputs.join(', ')}`);

        // Parse each input (hex or dye name) to get Dye objects
        const dyes: Dye[] = [];
        const dyeColors: string[] = [];

        for (const input of dyeInputs) {
            const hexValidation = validateHexColor(input);
            if (hexValidation.success) {
                // Input is a hex color - use normalized value and find closest dye
                const normalizedHex = hexValidation.value;
                const closestDye = dyeService.findClosestDye(normalizedHex);
                if (!closestDye) {
                    const errorEmbed = createErrorEmbed('Error', `Could not find matching dye for ${normalizedHex}.`);
                    await interaction.editReply({ embeds: [errorEmbed] });
                    return;
                }
                dyes.push(closestDye);
                dyeColors.push(normalizedHex); // Store normalized hex
            } else {
                // Input is a dye name
                const dyeResult = findDyeByName(input);
                if (dyeResult.error) {
                    const errorEmbed = createErrorEmbed(
                        'Invalid Input',
                        `"${input}" is not a valid hex color or dye name.\n\n` +
                        `**Examples:**\n` +
                        `• Hex: \`#FF0000\`, \`#8A2BE2\`\n` +
                        `• Dye: \`Dalamud Red\`, \`Snow White\``
                    );
                    await interaction.editReply({ embeds: [errorEmbed] });
                    return;
                }
                dyes.push(dyeResult.dye!);
                dyeColors.push(dyeResult.dye!.hex);
            }
        }

        // Calculate pairwise distances
        const pairs = calculatePairwiseDistances(dyes);
        const closestPair = pairs.reduce((min, pair) => pair.distance < min.distance ? pair : min);
        const furthestPair = pairs.reduce((max, pair) => pair.distance > max.distance ? pair : max);
        const averageDistance = pairs.reduce((sum, pair) => sum + pair.distance, 0) / pairs.length;

        // Render swatch grid
        const gridBuffer = await renderSwatchGrid({
            dyes,
            showValues: false,
        });

        const attachment = new AttachmentBuilder(gridBuffer, {
            name: `comparison_${dyes.length}dyes.png`,
        });

        // Create embed
        const embed = new EmbedBuilder()
            .setColor(parseInt(dyes[0].hex.replace('#', ''), 16) as ColorResolvable)
            .setTitle(`🔍 Dye Comparison (${dyes.length} ${dyes.length === 1 ? 'dye' : 'dyes'})`)
            .setImage(`attachment://comparison_${dyes.length}dyes.png`)
            .setTimestamp();

        // Add field for each dye
        dyes.forEach((dye, index) => {
            const emoji = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'][index] || `${index + 1}.`;
            embed.addFields({
                name: `${emoji} ${dye.name}`,
                value: [
                    emojiService.getDyeEmojiOrSwatch(dye, 6),
                    `**Hex:** ${dye.hex.toUpperCase()}`,
                    `**RGB:** ${formatRGB(dye.hex)}`,
                    `**HSV:** ${formatHSV(dye.hex)}`,
                    `**Category:** ${dye.category}`,
                ].join('\n'),
                inline: true,
            });
        });

        // Add comparison analysis (only if 2+ dyes)
        if (dyes.length >= 2) {
            embed.addFields({
                name: '📊 Comparison Analysis',
                value: [
                    `**Most Similar:** ${closestPair.dye1.name} ↔ ${closestPair.dye2.name}`,
                    `Distance: ${closestPair.distance.toFixed(1)} (${getQualityLabel(closestPair.distance)})`,
                    '',
                    `**Most Different:** ${furthestPair.dye1.name} ↔ ${furthestPair.dye2.name}`,
                    `Distance: ${furthestPair.distance.toFixed(1)} (${getQualityLabel(furthestPair.distance)})`,
                    '',
                    `**Average Distance:** ${averageDistance.toFixed(1)}`,
                ].join('\n'),
                inline: false,
            });
        }

        // Send response
        await interaction.editReply({
            embeds: [embed],
            files: [attachment],
        });

        logger.info(`Comparison completed: ${dyes.length} dyes`);
    } catch (error) {
        logger.error('Error executing comparison command:', error);
        const errorEmbed = createErrorEmbed(
            'Command Error',
            'An error occurred while comparing dyes. Please try again.'
        );

        if (interaction.deferred) {
            await interaction.editReply({ embeds: [errorEmbed] });
        } else {
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    }
}

/**
 * Calculate pairwise distances between all dyes
 */
function calculatePairwiseDistances(dyes: Dye[]): DyePair[] {
    const pairs: DyePair[] = [];

    for (let i = 0; i < dyes.length; i++) {
        for (let j = i + 1; j < dyes.length; j++) {
            const distance = ColorService.getColorDistance(dyes[i].hex, dyes[j].hex);
            pairs.push({
                dye1: dyes[i],
                dye2: dyes[j],
                distance,
            });
        }
    }

    return pairs;
}

/**
 * Get quality label for color distance
 */
function getQualityLabel(distance: number): string {
    if (distance === 0) return 'Identical';
    if (distance < 10) return 'Very Similar';
    if (distance < 25) return 'Similar';
    if (distance < 50) return 'Somewhat Different';
    if (distance < 100) return 'Different';
    return 'Very Different';
}

/**
 * Autocomplete handler for dye parameters
 */
export async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focusedOption = interaction.options.getFocused(true);

    if (['dye1', 'dye2', 'dye3', 'dye4'].includes(focusedOption.name)) {
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

export const comparisonCommand: BotCommand = {
    data,
    execute,
    autocomplete,
};
