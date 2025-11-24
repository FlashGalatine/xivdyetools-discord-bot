/**
 * Integration tests for /comparison command
 */

import { describe, it, expect, vi } from 'vitest';
import { execute, autocomplete } from './comparison.js';
import type { ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';

/**
 * Create mock ChatInputCommandInteraction
 */
function createMockInteraction(options: {
    dye1: string;
    dye2: string;
    dye3?: string | null;
    dye4?: string | null;
}): ChatInputCommandInteraction {
    const deferReply = vi.fn().mockResolvedValue(undefined);
    const editReply = vi.fn().mockResolvedValue(undefined);
    const reply = vi.fn().mockResolvedValue(undefined);

    const mockInteraction = {
        deferReply,
        editReply,
        reply,
        deferred: true,
        options: {
            getString: vi.fn((name: string, required?: boolean) => {
                if (name === 'dye1') return options.dye1;
                if (name === 'dye2') return options.dye2;
                if (name === 'dye3') return options.dye3 ?? null;
                if (name === 'dye4') return options.dye4 ?? null;
                return null;
            }),
        },
    } as unknown as ChatInputCommandInteraction;

    return mockInteraction;
}

/**
 * Create mock AutocompleteInteraction
 */
function createMockAutocompleteInteraction(focusedOption: {
    name: string;
    value: string;
}): AutocompleteInteraction {
    const respond = vi.fn().mockResolvedValue(undefined);

    const mockInteraction = {
        respond,
        options: {
            getFocused: vi.fn(() => focusedOption),
        },
    } as unknown as AutocompleteInteraction;

    return mockInteraction;
}

describe('Comparison Command - Input Validation', () => {
    it('should accept 2 valid hex colors', async () => {
        const interaction = createMockInteraction({
            dye1: '#FF0000',
            dye2: '#0000FF',
        });

        await execute(interaction);

        expect(interaction.deferReply).toHaveBeenCalled();
        expect(interaction.editReply).toHaveBeenCalled();

        const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
        const embed = (editCall as any).embeds[0];
        expect(embed.data.title).not.toContain('❌');
        expect(embed.data.title).toContain('Dye Comparison');
    });

    it('should accept 2 valid dye names', async () => {
        const interaction = createMockInteraction({
            dye1: 'Dalamud Red',
            dye2: 'Snow White',
        });

        await execute(interaction);

        const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
        const embed = (editCall as any).embeds[0];
        expect(embed.data.title).not.toContain('❌');
    });

    it('should accept mixed hex and dye name inputs', async () => {
        const interaction = createMockInteraction({
            dye1: '#FF0000',
            dye2: 'Snow White',
        });

        await execute(interaction);

        const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
        const embed = (editCall as any).embeds[0];
        expect(embed.data.title).not.toContain('❌');
    });

    it('should accept 3 dyes', async () => {
        const interaction = createMockInteraction({
            dye1: '#FF0000',
            dye2: '#00FF00',
            dye3: '#0000FF',
        });

        await execute(interaction);

        const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
        const embed = (editCall as any).embeds[0];
        expect(embed.data.title).toContain('3 dyes');
    });

    it('should accept 4 dyes', async () => {
        const interaction = createMockInteraction({
            dye1: '#FF0000',
            dye2: '#00FF00',
            dye3: '#0000FF',
            dye4: '#FFFF00',
        });

        await execute(interaction);

        const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
        const embed = (editCall as any).embeds[0];
        expect(embed.data.title).toContain('4 dyes');
    });

    it('should reject invalid first dye', async () => {
        const interaction = createMockInteraction({
            dye1: 'Invalid!!!',
            dye2: '#0000FF',
        });

        await execute(interaction);

        const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
        const embed = (editCall as any).embeds[0];
        expect(embed.data.title).toContain('❌');
        expect(embed.data.title).toContain('Invalid Input');
    });

    it('should reject invalid second dye', async () => {
        const interaction = createMockInteraction({
            dye1: '#FF0000',
            dye2: 'Invalid!!!',
        });

        await execute(interaction);

        const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
        const embed = (editCall as any).embeds[0];
        expect(embed.data.title).toContain('❌');
    });

    it('should handle lowercase hex colors', async () => {
        const interaction = createMockInteraction({
            dye1: '#ff0000',
            dye2: '#0000ff',
        });

        await execute(interaction);

        const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
        const embed = (editCall as any).embeds[0];
        expect(embed.data.title).not.toContain('❌');
    });
});

describe('Comparison Command - Dye Count', () => {
    it('should show count in title for 2 dyes', async () => {
        const interaction = createMockInteraction({
            dye1: '#FF0000',
            dye2: '#0000FF',
        });

        await execute(interaction);

        const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
        const embed = (editCall as any).embeds[0];
        expect(embed.data.title).toMatch(/2 dyes/);
    });

    it('should create 2 dye fields for 2 dyes', async () => {
        const interaction = createMockInteraction({
            dye1: '#FF0000',
            dye2: '#0000FF',
        });

        await execute(interaction);

        const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
        const embed = (editCall as any).embeds[0];
        const fields = embed.data.fields || [];

        // Should have 2 dye fields + 1 comparison analysis field = 3 fields
        expect(fields.length).toBe(3);
    });

    it('should create 3 dye fields for 3 dyes', async () => {
        const interaction = createMockInteraction({
            dye1: '#FF0000',
            dye2: '#00FF00',
            dye3: '#0000FF',
        });

        await execute(interaction);

        const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
        const embed = (editCall as any).embeds[0];
        const fields = embed.data.fields || [];

        // Should have 3 dye fields + 1 comparison analysis field = 4 fields
        expect(fields.length).toBe(4);
    });

    it('should create 4 dye fields for 4 dyes', async () => {
        const interaction = createMockInteraction({
            dye1: '#FF0000',
            dye2: '#00FF00',
            dye3: '#0000FF',
            dye4: '#FFFF00',
        });

        await execute(interaction);

        const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
        const embed = (editCall as any).embeds[0];
        const fields = embed.data.fields || [];

        // Should have 4 dye fields + 1 comparison analysis field = 5 fields
        expect(fields.length).toBe(5);
    });
});

describe('Comparison Command - Comparison Analysis', () => {
    it('should include comparison analysis field', async () => {
        const interaction = createMockInteraction({
            dye1: '#FF0000',
            dye2: '#0000FF',
        });

        await execute(interaction);

        const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
        const embed = (editCall as any).embeds[0];
        const fields = embed.data.fields || [];

        const analysisField = fields.find((f: any) => f.name === '📊 Comparison Analysis');
        expect(analysisField).toBeDefined();
    });

    it('should show most similar pair', async () => {
        const interaction = createMockInteraction({
            dye1: '#FF0000',
            dye2: '#0000FF',
            dye3: '#00FF00',
        });

        await execute(interaction);

        const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
        const embed = (editCall as any).embeds[0];
        const fields = embed.data.fields || [];

        const analysisField = fields.find((f: any) => f.name === '📊 Comparison Analysis');
        expect(analysisField?.value).toContain('Most Similar:');
    });

    it('should show most different pair', async () => {
        const interaction = createMockInteraction({
            dye1: '#FF0000',
            dye2: '#0000FF',
            dye3: '#00FF00',
        });

        await execute(interaction);

        const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
        const embed = (editCall as any).embeds[0];
        const fields = embed.data.fields || [];

        const analysisField = fields.find((f: any) => f.name === '📊 Comparison Analysis');
        expect(analysisField?.value).toContain('Most Different:');
    });

    it('should show average distance', async () => {
        const interaction = createMockInteraction({
            dye1: '#FF0000',
            dye2: '#0000FF',
            dye3: '#00FF00',
        });

        await execute(interaction);

        const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
        const embed = (editCall as any).embeds[0];
        const fields = embed.data.fields || [];

        const analysisField = fields.find((f: any) => f.name === '📊 Comparison Analysis');
        expect(analysisField?.value).toContain('Average Distance:');
    });

    it('should include quality labels in analysis', async () => {
        const interaction = createMockInteraction({
            dye1: '#FF0000',
            dye2: '#0000FF',
        });

        await execute(interaction);

        const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
        const embed = (editCall as any).embeds[0];
        const fields = embed.data.fields || [];

        const analysisField = fields.find((f: any) => f.name === '📊 Comparison Analysis');
        // Should have quality labels like "Very Similar", "Different", etc.
        expect(analysisField?.value).toMatch(/Identical|Very Similar|Similar|Somewhat Different|Different|Very Different/);
    });
});

describe('Comparison Command - Embed Content', () => {
    it('should include numbered emojis for dyes', async () => {
        const interaction = createMockInteraction({
            dye1: '#FF0000',
            dye2: '#00FF00',
            dye3: '#0000FF',
        });

        await execute(interaction);

        const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
        const embed = (editCall as any).embeds[0];
        const fields = embed.data.fields || [];

        // Filter out analysis field
        const dyeFields = fields.filter((f: any) => !f.name.includes('📊'));
        expect(dyeFields[0].name).toContain('1️⃣');
        expect(dyeFields[1].name).toContain('2️⃣');
        expect(dyeFields[2].name).toContain('3️⃣');
    });

    it('should include dye information for each dye', async () => {
        const interaction = createMockInteraction({
            dye1: '#FF0000',
            dye2: '#0000FF',
        });

        await execute(interaction);

        const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
        const embed = (editCall as any).embeds[0];
        const fields = embed.data.fields || [];

        const dyeFields = fields.filter((f: any) => !f.name.includes('📊'));
        dyeFields.forEach((field: any) => {
            expect(field.value).toContain('Hex:');
            expect(field.value).toContain('RGB:');
            expect(field.value).toContain('HSV:');
            expect(field.value).toContain('Category:');
        });
    });

    it('should include color swatches', async () => {
        const interaction = createMockInteraction({
            dye1: '#FF0000',
            dye2: '#0000FF',
        });

        await execute(interaction);

        const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
        const embed = (editCall as any).embeds[0];
        const fields = embed.data.fields || [];

        const dyeFields = fields.filter((f: any) => !f.name.includes('📊'));
        dyeFields.forEach((field: any) => {
            expect(field.value).toContain('█');
        });
    });

    it('should have timestamp', async () => {
        const interaction = createMockInteraction({
            dye1: '#FF0000',
            dye2: '#0000FF',
        });

        await execute(interaction);

        const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
        const embed = (editCall as any).embeds[0];
        expect(embed.data.timestamp).toBeDefined();
    });

    it('should set embed color to first dye color', async () => {
        const interaction = createMockInteraction({
            dye1: '#FF0000',
            dye2: '#0000FF',
        });

        await execute(interaction);

        const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
        const embed = (editCall as any).embeds[0];
        expect(embed.data.color).toBeDefined();
        expect(typeof embed.data.color).toBe('number');
    });
});

describe('Comparison Command - Swatch Grid Image', () => {
    it('should include swatch grid attachment', async () => {
        const interaction = createMockInteraction({
            dye1: '#FF0000',
            dye2: '#0000FF',
        });

        await execute(interaction);

        const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
        const files = (editCall as any).files;

        expect(files.length).toBe(1);
        expect(files[0].name).toContain('comparison_');
        expect(files[0].name).toContain('dyes.png');
    });

    it('should set swatch grid as embed image', async () => {
        const interaction = createMockInteraction({
            dye1: '#FF0000',
            dye2: '#0000FF',
        });

        await execute(interaction);

        const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
        const embed = (editCall as any).embeds[0];

        expect(embed.data.image?.url).toContain('attachment://comparison_');
    });

    it('should name image file based on dye count', async () => {
        const interaction = createMockInteraction({
            dye1: '#FF0000',
            dye2: '#00FF00',
            dye3: '#0000FF',
        });

        await execute(interaction);

        const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
        const files = (editCall as any).files;

        expect(files[0].name).toBe('comparison_3dyes.png');
    });
});

describe('Comparison Command - Error Handling', () => {
    it('should handle errors gracefully', async () => {
        const interaction = createMockInteraction({
            dye1: 'Invalid!!!',
            dye2: '#0000FF',
        });

        await execute(interaction);

        expect(interaction.deferReply).toHaveBeenCalled();
        expect(interaction.editReply).toHaveBeenCalled();
    });

    it('should defer reply before editing', async () => {
        const interaction = createMockInteraction({
            dye1: '#FF0000',
            dye2: '#0000FF',
        });

        await execute(interaction);

        expect(interaction.deferReply).toHaveBeenCalled();
        expect(interaction.editReply).toHaveBeenCalled();
        expect(interaction.deferReply).toHaveBeenCalledTimes(1);
    });
});

describe('Comparison Command - Autocomplete', () => {
    it('should work for dye1 parameter', async () => {
        const interaction = createMockAutocompleteInteraction({
            name: 'dye1',
            value: 'red',
        });

        await autocomplete(interaction);

        const respondCall = vi.mocked(interaction.respond).mock.calls[0][0];
        expect(respondCall.length).toBeGreaterThan(0);
    });

    it('should work for dye2 parameter', async () => {
        const interaction = createMockAutocompleteInteraction({
            name: 'dye2',
            value: 'blue',
        });

        await autocomplete(interaction);

        const respondCall = vi.mocked(interaction.respond).mock.calls[0][0];
        expect(respondCall.length).toBeGreaterThan(0);
    });

    it('should work for dye3 parameter', async () => {
        const interaction = createMockAutocompleteInteraction({
            name: 'dye3',
            value: 'green',
        });

        await autocomplete(interaction);

        const respondCall = vi.mocked(interaction.respond).mock.calls[0][0];
        expect(respondCall.length).toBeGreaterThan(0);
    });

    it('should work for dye4 parameter', async () => {
        const interaction = createMockAutocompleteInteraction({
            name: 'dye4',
            value: 'white',
        });

        await autocomplete(interaction);

        const respondCall = vi.mocked(interaction.respond).mock.calls[0][0];
        expect(respondCall.length).toBeGreaterThan(0);
    });

    it('should return empty array for hex color query', async () => {
        const interaction = createMockAutocompleteInteraction({
            name: 'dye1',
            value: '#FF0000',
        });

        await autocomplete(interaction);

        expect(interaction.respond).toHaveBeenCalledWith([]);
    });

    it('should limit autocomplete results to 25', async () => {
        const interaction = createMockAutocompleteInteraction({
            name: 'dye1',
            value: '',
        });

        await autocomplete(interaction);

        const respondCall = vi.mocked(interaction.respond).mock.calls[0][0];
        expect(respondCall.length).toBeLessThanOrEqual(25);
    });

    it('should exclude Facewear category', async () => {
        const interaction = createMockAutocompleteInteraction({
            name: 'dye1',
            value: '',
        });

        await autocomplete(interaction);

        const respondCall = vi.mocked(interaction.respond).mock.calls[0][0];
        const hasFacewear = respondCall.some((choice: any) =>
            choice.name.includes('Facewear')
        );
        expect(hasFacewear).toBe(false);
    });
});
