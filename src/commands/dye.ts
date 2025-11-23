/**
 * /dye command - Dye information and lookup
 * Subcommands: info, search, list, random
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
    dyeDatabase,
    type Dye,
} from 'xivdyetools-core';
import { findDyeByName, validateIntRange } from '../utils/validators.js';
import { createErrorEmbed, createDyeEmbed, formatColorSwatch } from '../utils/embed-builder.js';
import { logger } from '../utils/logger.js';
import type { BotCommand } from '../types/index.js';

const dyeService = new DyeService(dyeDatabase);

/**
 * Available dye categories
 */
const CATEGORIES = [
    { name: 'Neutral', value: 'Neutral' },
    { name: 'Reds', value: 'Reds' },
    { name: 'Browns', value: 'Browns' },
    { name: 'Yellows', value: 'Yellows' },
    { name: 'Greens', value: 'Greens' },
    { name: 'Blues', value: 'Blues' },
    { name: 'Purples', value: 'Purples' },
    { name: 'Special', value: 'Special' },
    { name: 'Facewear', value: 'Facewear' },
];

export const data = new SlashCommandBuilder()
    .setName('dye')
    .setDescription('FFXIV dye information and lookup')
    .addSubcommand((subcommand) =>
        subcommand
            .setName('info')
            .setDescription('Get information about a specific dye')
            .addStringOption((option) =>
                option
                    .setName('name')
                    .setDescription('Dye name')
                    .setRequired(true)
                    .setAutocomplete(true)
            )
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName('search')
            .setDescription('Search for dyes by name')
            .addStringOption((option) =>
                option
                    .setName('query')
                    .setDescription('Search term (partial name match)')
                    .setRequired(true)
                    .setMinLength(2)
            )
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName('list')
            .setDescription('List dyes by category')
            .addStringOption((option) =>
                option
                    .setName('category')
                    .setDescription('Dye category')
                    .setRequired(true)
                    .addChoices(...CATEGORIES)
            )
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName('random')
            .setDescription('Get random dye(s)')
            .addIntegerOption((option) =>
                option
                    .setName('count')
                    .setDescription('Number of random dyes (default: 1)')
                    .setRequired(false)
                    .setMinValue(1)
                    .setMaxValue(5)
            )
    );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    try {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'info':
                await handleInfo(interaction);
                break;
            case 'search':
                await handleSearch(interaction);
                break;
            case 'list':
                await handleList(interaction);
                break;
            case 'random':
                await handleRandom(interaction);
                break;
            default:
                const errorEmbed = createErrorEmbed('Unknown Subcommand', 'Invalid subcommand');
                await interaction.editReply({ embeds: [errorEmbed] });
        }
    } catch (error) {
        logger.error('Error executing dye command:', error);
        const errorEmbed = createErrorEmbed(
            'Command Error',
            'An error occurred while processing your request. Please try again.'
        );

        if (interaction.deferred) {
            await interaction.editReply({ embeds: [errorEmbed] });
        } else {
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    }
}

/**
 * Handle /dye info subcommand
 */
async function handleInfo(interaction: ChatInputCommandInteraction): Promise<void> {
    const dyeName = interaction.options.getString('name', true);

    logger.info(`Dye info: ${dyeName}`);

    const dyeResult = findDyeByName(dyeName);
    if (dyeResult.error) {
        const errorEmbed = createErrorEmbed(
            'Dye Not Found',
            `Could not find dye "${dyeName}".\n\nTry using autocomplete or \`/dye search\` to find similar names.`
        );
        await interaction.editReply({ embeds: [errorEmbed] });
        return;
    }

    const dye = dyeResult.dye!;
    const embed = createDyeEmbed(dye, true); // Show extended info

    await interaction.editReply({ embeds: [embed] });
    logger.info(`Dye info completed: ${dye.name}`);
}

/**
 * Handle /dye search subcommand
 */
async function handleSearch(interaction: ChatInputCommandInteraction): Promise<void> {
    const query = interaction.options.getString('query', true);

    logger.info(`Dye search: ${query}`);

    const allDyes = dyeService.getAllDyes();
    const matches = allDyes.filter((dye) =>
        dye.name.toLowerCase().includes(query.toLowerCase())
    );

    if (matches.length === 0) {
        const errorEmbed = createErrorEmbed(
            'No Results',
            `No dyes found matching "${query}".\n\nTry a different search term or use \`/dye list\` to browse by category.`
        );
        await interaction.editReply({ embeds: [errorEmbed] });
        return;
    }

    // Limit to first 15 results
    const displayMatches = matches.slice(0, 15);
    const hasMore = matches.length > 15;

    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`🔍 Dye Search: "${query}"`)
        .setDescription(
            `Found **${matches.length}** ${matches.length === 1 ? 'dye' : 'dyes'}${hasMore ? ` (showing first 15)` : ''}:\n\n` +
            displayMatches
                .map((dye) => `${formatColorSwatch(dye.hex, 3)} **${dye.name}** (${dye.category})`)
                .join('\n')
        )
        .setFooter({
            text: hasMore
                ? 'Too many results! Use a more specific search or /dye info <name>'
                : 'Use /dye info <name> to see details',
        })
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    logger.info(`Dye search completed: ${matches.length} results`);
}

/**
 * Handle /dye list subcommand
 */
async function handleList(interaction: ChatInputCommandInteraction): Promise<void> {
    const category = interaction.options.getString('category', true);

    logger.info(`Dye list: ${category}`);

    const allDyes = dyeService.getAllDyes();
    const categoryDyes = allDyes.filter((dye) => dye.category === category);

    if (categoryDyes.length === 0) {
        const errorEmbed = createErrorEmbed(
            'Empty Category',
            `No dyes found in category "${category}".`
        );
        await interaction.editReply({ embeds: [errorEmbed] });
        return;
    }

    // Show all dyes in category (most categories have 10-20 dyes)
    const dyeList = categoryDyes
        .map((dye, index) => `${index + 1}. ${formatColorSwatch(dye.hex, 3)} **${dye.name}** (${dye.hex.toUpperCase()})`)
        .join('\n');

    const embed = new EmbedBuilder()
        .setColor(parseInt(categoryDyes[0].hex.replace('#', ''), 16) as ColorResolvable)
        .setTitle(`📋 ${category} Dyes`)
        .setDescription(`**${categoryDyes.length}** dyes in this category:\n\n${dyeList}`)
        .setFooter({ text: 'Use /dye info <name> to see full details' })
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    logger.info(`Dye list completed: ${category} (${categoryDyes.length} dyes)`);
}

/**
 * Handle /dye random subcommand
 */
async function handleRandom(interaction: ChatInputCommandInteraction): Promise<void> {
    const count = interaction.options.getInteger('count') || 1;

    logger.info(`Dye random: ${count}`);

    // Validate count
    const countValidation = validateIntRange(count, 1, 5, 'Count');
    if (!countValidation.valid) {
        const errorEmbed = createErrorEmbed('Invalid Count', countValidation.error!);
        await interaction.editReply({ embeds: [errorEmbed] });
        return;
    }

    // Get all dyes except Facewear
    const allDyes = dyeService.getAllDyes().filter((dye) => dye.category !== 'Facewear');

    // Get random dyes (no duplicates)
    const randomDyes: Dye[] = [];
    const usedIndices = new Set<number>();

    while (randomDyes.length < count && usedIndices.size < allDyes.length) {
        const randomIndex = Math.floor(Math.random() * allDyes.length);
        if (!usedIndices.has(randomIndex)) {
            usedIndices.add(randomIndex);
            randomDyes.push(allDyes[randomIndex]);
        }
    }

    if (count === 1) {
        // Single dye - use full embed
        const embed = createDyeEmbed(randomDyes[0], true);
        embed.setTitle(`🎲 ${embed.data.title}`); // Add dice emoji
        await interaction.editReply({ embeds: [embed] });
    } else {
        // Multiple dyes - use compact list
        const dyeList = randomDyes
            .map((dye, index) =>
                [
                    `**${index + 1}. ${dye.name}**`,
                    `${formatColorSwatch(dye.hex, 6)} ${dye.hex.toUpperCase()}`,
                    `Category: ${dye.category}`,
                    dye.acquisition ? `Acquisition: ${dye.acquisition}` : '',
                ].filter(Boolean).join('\n')
            )
            .join('\n\n');

        const embed = new EmbedBuilder()
            .setColor(parseInt(randomDyes[0].hex.replace('#', ''), 16) as ColorResolvable)
            .setTitle(`🎲 Random Dyes (${count})`)
            .setDescription(dyeList)
            .setFooter({ text: 'Use /dye info <name> for more details' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    }

    logger.info(`Dye random completed: ${count} ${count === 1 ? 'dye' : 'dyes'}`);
}

/**
 * Autocomplete handler for dye names
 */
export async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focusedOption = interaction.options.getFocused(true);

    if (focusedOption.name === 'name') {
        const query = focusedOption.value.toLowerCase();

        const allDyes = dyeService.getAllDyes();
        const matches = allDyes
            .filter((dye) => {
                // Exclude Facewear for general searches
                if (dye.category === 'Facewear') return false;
                // Match name (case-insensitive)
                return dye.name.toLowerCase().includes(query);
            })
            .slice(0, 25) // Discord limits to 25 choices
            .map((dye) => ({
                name: `${dye.name} (${dye.category})`,
                value: dye.name,
            }));

        await interaction.respond(matches);
    }
}

export const dyeCommand: BotCommand = {
    data,
    execute,
    autocomplete,
};
