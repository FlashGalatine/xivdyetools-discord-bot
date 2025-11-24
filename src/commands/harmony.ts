/**
 * /harmony command - Generate color harmonies
 */

import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    AttachmentBuilder,
    AutocompleteInteraction,
} from 'discord.js';
import {
    DyeService,
    ColorService,
    dyeDatabase,
    type Dye,
} from 'xivdyetools-core';
import { validateHexColor, validateHarmonyType, findDyeByName } from '../utils/validators.js';
import { createErrorEmbed, createHarmonyEmbed, createDyeEmojiAttachment } from '../utils/embed-builder.js';
import { renderColorWheel } from '../renderers/color-wheel.js';
import { logger } from '../utils/logger.js';
import type { BotCommand } from '../types/index.js';

const dyeService = new DyeService(dyeDatabase);

/**
 * Harmony type choices for slash command
 */
const harmonyTypes = [
    { name: 'Complementary', value: 'complementary' },
    { name: 'Analogous', value: 'analogous' },
    { name: 'Triadic', value: 'triadic' },
    { name: 'Split-Complementary', value: 'split_complementary' },
    { name: 'Tetradic (Rectangle)', value: 'tetradic' },
    { name: 'Square', value: 'square' },
    { name: 'Monochromatic', value: 'monochromatic' },
    { name: 'Compound', value: 'compound' },
    { name: 'Shades', value: 'shades' },
];

export const data = new SlashCommandBuilder()
    .setName('harmony')
    .setDescription('Generate color harmony suggestions based on color theory')
    .addStringOption((option) =>
        option
            .setName('base_color')
            .setDescription('Base color: hex (e.g., #FF0000) or dye name (e.g., Dalamud Red)')
            .setRequired(true)
            .setAutocomplete(true) // Enable autocomplete
    )
    .addStringOption((option) =>
        option
            .setName('type')
            .setDescription('Harmony type')
            .setRequired(true)
            .addChoices(...harmonyTypes)
    )
    .addIntegerOption((option) =>
        option
            .setName('companion_count')
            .setDescription('Limit number of companions (optional - shows all by default)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(3)
    );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    try {
        // Get parameters - companionCount is null if not specified
        const baseColorInput = interaction.options.getString('base_color', true);
        const harmonyType = interaction.options.getString('type', true);
        const companionCount = interaction.options.getInteger('companion_count'); // Can be null

        logger.info(`Harmony command: ${baseColorInput} (${harmonyType}), limit: ${companionCount ?? 'none'}`);

        // Determine if input is hex or dye name
        let baseColor: string;
        let baseDye: Dye;

        const hexValidation = validateHexColor(baseColorInput);
        if (hexValidation.valid) {
            // Input is a hex color
            baseColor = baseColorInput;
            const foundDye = dyeService.findClosestDye(baseColor);
            if (!foundDye) {
                const errorEmbed = createErrorEmbed('Error', 'Could not find matching dye.');
                await interaction.editReply({ embeds: [errorEmbed] });
                return;
            }
            baseDye = foundDye;
        } else {
            // Input might be a dye name
            const dyeResult = findDyeByName(baseColorInput);
            if (dyeResult.error) {
                const errorEmbed = createErrorEmbed(
                    'Invalid Input',
                    `"${baseColorInput}" is not a valid hex color or dye name.\n\n` +
                    `**Examples:**\n` +
                    `• Hex: \`#FF0000\`, \`#8A2BE2\`\n` +
                    `• Dye: \`Dalamud Red\`, \`Snow White\``
                );
                await interaction.editReply({ embeds: [errorEmbed] });
                return;
            }
            baseDye = dyeResult.dye!;
            baseColor = baseDye.hex;
        }

        // Validate harmony type
        const typeValidation = validateHarmonyType(harmonyType);
        if (!typeValidation.valid) {
            const errorEmbed = createErrorEmbed('Invalid Harmony Type', typeValidation.error!);
            await interaction.editReply({ embeds: [errorEmbed] });
            return;
        }

        // Generate harmony using appropriate method
        let harmonyDyes: Dye[] = [];
        switch (harmonyType) {
            case 'complementary':
                const comp = dyeService.findComplementaryPair(baseColor);
                if (comp) harmonyDyes = [comp];
                break;
            case 'analogous':
                harmonyDyes = dyeService.findAnalogousDyes(baseColor);
                break;
            case 'triadic':
                harmonyDyes = dyeService.findTriadicDyes(baseColor);
                break;
            case 'split_complementary':
                harmonyDyes = dyeService.findSplitComplementaryDyes(baseColor);
                break;
            case 'tetradic':
                harmonyDyes = dyeService.findTetradicDyes(baseColor);
                break;
            case 'square':
                harmonyDyes = dyeService.findSquareDyes(baseColor);
                break;
            case 'monochromatic':
                // For monochromatic, use specified count or default to 3
                const monoCount = companionCount ?? 3;
                harmonyDyes = dyeService.findMonochromaticDyes(baseColor, monoCount + 1);
                break;
            case 'compound':
                harmonyDyes = dyeService.findCompoundDyes(baseColor);
                break;
            case 'shades':
                harmonyDyes = dyeService.findShadesDyes(baseColor);
                break;
        }

        if (harmonyDyes.length === 0) {
            const errorEmbed = createErrorEmbed('Error', 'Could not generate harmony.');
            await interaction.editReply({ embeds: [errorEmbed] });
            return;
        }

        // Only limit if user explicitly requested a limit
        if (companionCount !== null && harmonyDyes.length > companionCount) {
            harmonyDyes = harmonyDyes.slice(0, companionCount);
        }

        // Get companion dyes with angle information
        const baseHsv = ColorService.hexToHsv(baseColor);
        const companions = harmonyDyes.map((dye) => {
            const compHsv = ColorService.hexToHsv(dye.hex);
            let angle = compHsv.h - baseHsv.h;
            if (angle < 0) angle += 360;

            // Calculate deviation from theoretical angle
            const theoreticalAngles = getTheoreticalAngles(harmonyType, harmonyDyes.length);
            const deviation = Math.min(
                ...theoreticalAngles.map((ta) => Math.abs(angle - ta))
            );

            return {
                dye,
                angle,
                deviation,
            };
        });

        // Render color wheel
        const harmonyAngles = harmonyDyes.map((dye) => {
            const compHsv = ColorService.hexToHsv(dye.hex);
            return compHsv.h;
        });

        const wheelBuffer = await renderColorWheel({
            baseHue: baseHsv.h,
            harmonyAngles,
        });

        const attachment = new AttachmentBuilder(wheelBuffer, {
            name: 'color-wheel.png', // Use consistent name for attachment reference
        });

        // Create embed with color wheel image
        const embed = createHarmonyEmbed(baseColor, baseDye, harmonyType, companions);
        embed.setImage('attachment://color-wheel.png'); // Reference the attachment

        // Collect attachments (color wheel + base dye emoji if available)
        const files = [attachment];
        const baseDyeEmoji = createDyeEmojiAttachment(baseDye);
        if (baseDyeEmoji) {
            files.push(baseDyeEmoji);
        }

        // Send response
        await interaction.editReply({
            embeds: [embed],
            files,
        });

        logger.info(`Harmony command completed successfully`);
    } catch (error) {
        logger.error('Error executing harmony command:', error);
        const errorEmbed = createErrorEmbed(
            'Command Error',
            'An error occurred while generating the color harmony. Please try again.'
        );

        if (interaction.deferred) {
            await interaction.editReply({ embeds: [errorEmbed] });
        } else {
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    }
}

/**
 * Autocomplete handler for base_color parameter
 */
export async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focusedOption = interaction.options.getFocused(true);

    if (focusedOption.name === 'base_color') {
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

/**
 * Get theoretical angles for harmony type
 */
function getTheoreticalAngles(harmonyType: string, companionCount: number): number[] {
    switch (harmonyType) {
        case 'complementary':
            return [180];
        case 'analogous':
            return [30, 330]; // ±30°
        case 'triadic':
            return [120, 240];
        case 'split_complementary':
            return [150, 210]; // 180° ± 30°
        case 'tetradic':
            return [60, 180, 240];
        case 'square':
            return [90, 180, 270];
        case 'monochromatic':
            return [0, 0]; // Same hue
        case 'compound':
            return [30, 330, 180]; // Analogous + complement
        case 'shades':
            return [15, 345]; // ±15°
        default:
            return [];
    }
}

export const harmonyCommand: BotCommand = {
    data,
    execute,
    autocomplete,
};
