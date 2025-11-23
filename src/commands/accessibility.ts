/**
 * /accessibility command - Colorblind simulation for dyes
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
import { createErrorEmbed, formatColorSwatch } from '../utils/embed-builder.js';
import {
    renderAccessibilityComparison,
    type VisionType,
} from '../renderers/accessibility-comparison.js';
import { logger } from '../utils/logger.js';
import type { BotCommand } from '../types/index.js';

const dyeService = new DyeService(dyeDatabase);

export const data = new SlashCommandBuilder()
    .setName('accessibility')
    .setDescription('Simulate how a dye appears with colorblindness')
    .addStringOption((option) =>
        option
            .setName('dye')
            .setDescription('Dye name or hex color (e.g., "Dalamud Red" or "#FF0000")')
            .setRequired(true)
            .setAutocomplete(true)
    )
    .addStringOption((option) =>
        option
            .setName('vision_type')
            .setDescription('Colorblind vision type (default: show all)')
            .setRequired(false)
            .addChoices(
                { name: 'All Types', value: 'all' },
                { name: 'Protanopia (Red-blind)', value: 'protanopia' },
                { name: 'Deuteranopia (Green-blind)', value: 'deuteranopia' },
                { name: 'Tritanopia (Blue-blind)', value: 'tritanopia' }
            )
    );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    try {
        const dyeInput = interaction.options.getString('dye', true);
        const visionTypeInput = interaction.options.getString('vision_type') || 'all';

        logger.info(`Accessibility command: ${dyeInput} (${visionTypeInput})`);

        // Parse dye input (hex or dye name)
        let dye: Dye;
        let inputHex: string;

        const hexValidation = validateHexColor(dyeInput);
        if (hexValidation.valid) {
            // Input is hex - find closest dye
            const closestDye = dyeService.findClosestDye(dyeInput);
            if (!closestDye) {
                const errorEmbed = createErrorEmbed(
                    'Error',
                    `Could not find matching dye for ${dyeInput}.`
                );
                await interaction.editReply({ embeds: [errorEmbed] });
                return;
            }
            dye = closestDye;
            inputHex = dyeInput;
        } else {
            // Input is dye name
            const dyeResult = findDyeByName(dyeInput);
            if (dyeResult.error) {
                const errorEmbed = createErrorEmbed(
                    'Invalid Input',
                    `"${dyeInput}" is not a valid hex color or dye name.\n\n` +
                    `**Examples:**\n` +
                    `• Hex: \`#FF0000\`, \`#8A2BE2\`\n` +
                    `• Dye: \`Dalamud Red\`, \`Snow White\``
                );
                await interaction.editReply({ embeds: [errorEmbed] });
                return;
            }
            dye = dyeResult.dye!;
            inputHex = dye.hex;
        }

        // Determine which vision types to show
        let visionTypes: VisionType[] | undefined;
        if (visionTypeInput !== 'all') {
            visionTypes = [visionTypeInput as VisionType];
        }

        // Render accessibility comparison
        const imageBuffer = await renderAccessibilityComparison({
            dyeHex: inputHex,
            dyeName: dye.name,
            visionTypes,
        });

        const attachment = new AttachmentBuilder(imageBuffer, {
            name: `accessibility_${dye.name.replace(/\s/g, '_')}.png`,
        });

        // Calculate simulated colors for embed
        const inputRgb = ColorService.hexToRgb(inputHex);
        const protanopiaRgb = ColorService.simulateColorblindness(inputRgb, 'protanopia');
        const deuteranopiaRgb = ColorService.simulateColorblindness(inputRgb, 'deuteranopia');
        const tritanopiaRgb = ColorService.simulateColorblindness(inputRgb, 'tritanopia');

        const protanopiaHex = ColorService.rgbToHex(protanopiaRgb.r, protanopiaRgb.g, protanopiaRgb.b);
        const deuteranopiaHex = ColorService.rgbToHex(deuteranopiaRgb.r, deuteranopiaRgb.g, deuteranopiaRgb.b);
        const tritanopiaHex = ColorService.rgbToHex(tritanopiaRgb.r, tritanopiaRgb.g, tritanopiaRgb.b);

        // Create embed
        const embed = new EmbedBuilder()
            .setColor(parseInt(inputHex.replace('#', ''), 16) as ColorResolvable)
            .setTitle(`♿ Accessibility: ${dye.name}`)
            .setDescription(
                `**Category:** ${dye.category}\n` +
                `**Original Hex:** ${inputHex.toUpperCase()}`
            )
            .setImage(`attachment://accessibility_${dye.name.replace(/\s/g, '_')}.png`)
            .setTimestamp();

        // Add vision type comparisons
        if (visionTypeInput === 'all' || visionTypeInput === 'protanopia') {
            embed.addFields({
                name: '🔴 Protanopia (Red-blind)',
                value: [
                    `${formatColorSwatch(protanopiaHex, 6)}`,
                    `**Hex:** ${protanopiaHex.toUpperCase()}`,
                    `**Affects:** ~1% of males`,
                    `**Impact:** Reds appear darker/brownish`,
                ].join('\n'),
                inline: true,
            });
        }

        if (visionTypeInput === 'all' || visionTypeInput === 'deuteranopia') {
            embed.addFields({
                name: '🟢 Deuteranopia (Green-blind)',
                value: [
                    `${formatColorSwatch(deuteranopiaHex, 6)}`,
                    `**Hex:** ${deuteranopiaHex.toUpperCase()}`,
                    `**Affects:** ~1% of males`,
                    `**Impact:** Greens appear beige/tan`,
                ].join('\n'),
                inline: true,
            });
        }

        if (visionTypeInput === 'all' || visionTypeInput === 'tritanopia') {
            embed.addFields({
                name: '🔵 Tritanopia (Blue-blind)',
                value: [
                    `${formatColorSwatch(tritanopiaHex, 6)}`,
                    `**Hex:** ${tritanopiaHex.toUpperCase()}`,
                    `**Affects:** <0.01% of people`,
                    `**Impact:** Blues appear greenish`,
                ].join('\n'),
                inline: true,
            });
        }

        // Add footer with info
        embed.addFields({
            name: 'ℹ️ About Color Vision Deficiency',
            value:
                'Color vision deficiency (colorblindness) affects approximately 8% of males and 0.5% of females. ' +
                'These simulations use the Brettel 1997 algorithm to approximate how colors appear to individuals with different types of color vision deficiency.',
            inline: false,
        });

        // Send response
        await interaction.editReply({
            embeds: [embed],
            files: [attachment],
        });

        logger.info(`Accessibility command completed: ${dye.name} (${visionTypeInput})`);
    } catch (error) {
        logger.error('Error executing accessibility command:', error);
        const errorEmbed = createErrorEmbed(
            'Command Error',
            'An error occurred while generating accessibility comparison. Please try again.'
        );

        if (interaction.deferred) {
            await interaction.editReply({ embeds: [errorEmbed] });
        } else {
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    }
}

/**
 * Autocomplete handler for dye parameter
 */
export async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focusedOption = interaction.options.getFocused(true);

    if (focusedOption.name === 'dye') {
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

export const accessibilityCommand: BotCommand = {
    data,
    execute,
    autocomplete,
};
