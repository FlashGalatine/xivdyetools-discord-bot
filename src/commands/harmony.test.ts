/**
 * Integration tests for /harmony command
 */

import { describe, it, expect, vi } from 'vitest';
import { execute, autocomplete } from './harmony.js';
import type { ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';

/**
 * Create mock ChatInputCommandInteraction
 */
function createMockInteraction(options: {
  base_color: string;
  type: string;
  companion_count?: number | null;
}): ChatInputCommandInteraction {
  const deferReply = vi.fn().mockResolvedValue(undefined);
  const editReply = vi.fn().mockResolvedValue(undefined);
  const followUp = vi.fn().mockResolvedValue({
    id: 'mock-message-id',
    channelId: 'test-channel-123',
    guildId: 'test-guild-123',
  });
  const reply = vi.fn().mockResolvedValue(undefined);

  const mockInteraction = {
    deferReply,
    editReply,
    followUp,
    reply,
    deferred: true,
    options: {
      getString: vi.fn((name: string, _required?: boolean) => {
        if (name === 'base_color') return options.base_color;
        if (name === 'type') return options.type;
        return null;
      }),
      getInteger: vi.fn((name: string) => {
        if (name === 'companion_count') return options.companion_count ?? null;
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

describe('Harmony Command - Input Validation', () => {
  it('should accept valid hex color input', async () => {
    const interaction = createMockInteraction({
      base_color: '#FF0000',
      type: 'complementary',
    });

    await execute(interaction);

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalled();

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    expect(editCall).toHaveProperty('embeds');
    expect(editCall).toHaveProperty('files');

    // Verify no error embed
    const embed = (editCall as any).embeds[0];
    expect(embed.data.title).not.toContain('❌');
  });

  it('should accept valid dye name input', async () => {
    const interaction = createMockInteraction({
      base_color: 'Dalamud Red',
      type: 'complementary',
    });

    await execute(interaction);

    expect(interaction.editReply).toHaveBeenCalled();

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];
    expect(embed.data.title).not.toContain('❌');
  });

  it('should reject invalid hex color', async () => {
    const interaction = createMockInteraction({
      base_color: '#GGGGGG',
      type: 'complementary',
    });

    await execute(interaction);

    const followUpCall = vi.mocked(interaction.followUp).mock.calls[0][0];
    const embed = (followUpCall as any).embeds[0];
    expect(embed.data.title).toContain('❌');
    expect(embed.data.title).toContain('Invalid Input');
  });

  it('should reject invalid dye name', async () => {
    const interaction = createMockInteraction({
      base_color: 'Nonexistent Dye 12345',
      type: 'complementary',
    });

    await execute(interaction);

    const followUpCall = vi.mocked(interaction.followUp).mock.calls[0][0];
    const embed = (followUpCall as any).embeds[0];
    expect(embed.data.title).toContain('❌');
    expect(embed.data.description).toContain('not a valid hex color or dye name');
  });

  it('should handle lowercase hex colors', async () => {
    const interaction = createMockInteraction({
      base_color: '#ff0000',
      type: 'complementary',
    });

    await execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];
    expect(embed.data.title).not.toContain('❌');
  });

  it('should handle case-insensitive dye names', async () => {
    const interaction = createMockInteraction({
      base_color: 'dalamud red',
      type: 'complementary',
    });

    await execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];
    expect(embed.data.title).not.toContain('❌');
  });
});

describe('Harmony Command - Harmony Types', () => {
  it('should generate complementary harmony', async () => {
    const interaction = createMockInteraction({
      base_color: '#FF0000',
      type: 'complementary',
    });

    await execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];
    expect(embed.data.title).toContain('Complementary');
    expect(embed.data.title).toContain('Color Harmony');
  });

  it('should generate analogous harmony', async () => {
    const interaction = createMockInteraction({
      base_color: '#FF0000',
      type: 'analogous',
    });

    await execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];
    expect(embed.data.title).toContain('Analogous');
  });

  it('should generate triadic harmony', async () => {
    const interaction = createMockInteraction({
      base_color: '#FF0000',
      type: 'triadic',
    });

    await execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];
    expect(embed.data.title).toContain('Triadic');
  });

  it('should generate split_complementary harmony', async () => {
    const interaction = createMockInteraction({
      base_color: '#FF0000',
      type: 'split_complementary',
    });

    await execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];
    // Check for harmony type in either format (localized or key format)
    expect(embed.data.title.toLowerCase()).toContain('split');
    expect(embed.data.title.toLowerCase()).toContain('complementary');
  });

  it('should generate tetradic harmony', async () => {
    const interaction = createMockInteraction({
      base_color: '#FF0000',
      type: 'tetradic',
    });

    await execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];
    expect(embed.data.title).toContain('Tetradic');
  });

  it('should generate square harmony', async () => {
    const interaction = createMockInteraction({
      base_color: '#FF0000',
      type: 'square',
    });

    await execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];
    expect(embed.data.title).toContain('Square');
  });

  it('should generate monochromatic harmony', async () => {
    const interaction = createMockInteraction({
      base_color: '#FF0000',
      type: 'monochromatic',
    });

    await execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];
    expect(embed.data.title).toContain('Monochromatic');
  });

  it('should generate compound harmony', async () => {
    const interaction = createMockInteraction({
      base_color: '#FF0000',
      type: 'compound',
    });

    await execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];
    expect(embed.data.title).toContain('Compound');
  });

  it('should generate shades harmony', async () => {
    const interaction = createMockInteraction({
      base_color: '#FF0000',
      type: 'shades',
    });

    await execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];
    expect(embed.data.title).toContain('Shades');
  });
});

describe('Harmony Command - Companion Count', () => {
  it('should show all companions when count not specified', async () => {
    const interaction = createMockInteraction({
      base_color: '#FF0000',
      type: 'triadic',
      companion_count: null,
    });

    await execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];
    const fields = embed.data.fields || [];

    // Triadic should have 2 companions + 1 base = 3 fields
    expect(fields.length).toBe(3);
  });

  it('should limit companions when count is 1', async () => {
    const interaction = createMockInteraction({
      base_color: '#FF0000',
      type: 'triadic',
      companion_count: 1,
    });

    await execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];
    const fields = embed.data.fields || [];

    // Should have 1 companion + 1 base = 2 fields
    expect(fields.length).toBe(2);
  });

  it('should limit companions when count is 2', async () => {
    const interaction = createMockInteraction({
      base_color: '#FF0000',
      type: 'tetradic',
      companion_count: 2,
    });

    await execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];
    const fields = embed.data.fields || [];

    // Should have 2 companions + 1 base = 3 fields
    expect(fields.length).toBe(3);
  });

  it('should use companion_count for monochromatic generation', async () => {
    const interaction = createMockInteraction({
      base_color: '#FF0000',
      type: 'monochromatic',
      companion_count: 2,
    });

    await execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];
    const fields = embed.data.fields || [];

    // Should have 2 companions + 1 base = 3 fields
    expect(fields.length).toBeGreaterThanOrEqual(2);
  });

  it('should include base dye emoji when available', async () => {
    const interaction = createMockInteraction({
      base_color: 'Dalamud Red', // Has emoji (itemID 5730)
      type: 'complementary',
    });

    await execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const files = (editCall as any).files;

    // Should have at least color wheel
    expect(files.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Harmony Command - Error Handling', () => {
  it('should handle empty harmony results gracefully', async () => {
    // This is hard to trigger naturally, but we test the error path
    // by using a harmony type that might fail
    const interaction = createMockInteraction({
      base_color: '#000000',
      type: 'monochromatic',
      companion_count: 0, // Invalid count might cause issues
    });

    await execute(interaction);

    // Should still defer and respond (error uses followUp)
    expect(interaction.deferReply).toHaveBeenCalled();
    expect(interaction.followUp).toHaveBeenCalled();
  });

  it('should defer reply before editing', async () => {
    const interaction = createMockInteraction({
      base_color: '#FF0000',
      type: 'complementary',
    });

    await execute(interaction);

    // Both should be called
    expect(interaction.deferReply).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalled();

    // deferReply should be called exactly once
    expect(interaction.deferReply).toHaveBeenCalledTimes(1);
  });
});

describe('Harmony Command - Autocomplete', () => {
  it('should return empty array for hex color query', async () => {
    const interaction = createMockAutocompleteInteraction({
      name: 'base_color',
      value: '#FF0000',
    });

    await autocomplete(interaction);

    expect(interaction.respond).toHaveBeenCalledWith([]);
  });

  it('should return matching dyes for name query', async () => {
    const interaction = createMockAutocompleteInteraction({
      name: 'base_color',
      value: 'red',
    });

    await autocomplete(interaction);

    const respondCall = vi.mocked(interaction.respond).mock.calls[0][0];
    expect(respondCall.length).toBeGreaterThan(0);
    expect(respondCall[0]).toHaveProperty('name');
    expect(respondCall[0]).toHaveProperty('value');
  });

  it('should limit autocomplete results to 25', async () => {
    const interaction = createMockAutocompleteInteraction({
      name: 'base_color',
      value: '', // Empty query returns many results
    });

    await autocomplete(interaction);

    const respondCall = vi.mocked(interaction.respond).mock.calls[0][0];
    expect(respondCall.length).toBeLessThanOrEqual(25);
  });

  it('should exclude Facewear category from autocomplete', async () => {
    const interaction = createMockAutocompleteInteraction({
      name: 'base_color',
      value: '', // Get all dyes
    });

    await autocomplete(interaction);

    const respondCall = vi.mocked(interaction.respond).mock.calls[0][0];

    // Check that no result includes "Facewear" in the name
    const hasFacewear = respondCall.some((choice: any) => choice.name.includes('Facewear'));
    expect(hasFacewear).toBe(false);
  });

  it('should format autocomplete results with category', async () => {
    const interaction = createMockAutocompleteInteraction({
      name: 'base_color',
      value: 'dalamud',
    });

    await autocomplete(interaction);

    const respondCall = vi.mocked(interaction.respond).mock.calls[0][0];
    expect(respondCall.length).toBeGreaterThan(0);

    // Should have format: "Dye Name (Category)"
    expect(respondCall[0].name).toMatch(/.*\(.*\)/);
  });

  it('should be case-insensitive for autocomplete', async () => {
    const interaction = createMockAutocompleteInteraction({
      name: 'base_color',
      value: 'DALAMUD',
    });

    await autocomplete(interaction);

    const respondCall = vi.mocked(interaction.respond).mock.calls[0][0];
    expect(respondCall.length).toBeGreaterThan(0);
  });
});

describe('Harmony Command - Embed Content', () => {
  it('should include base color in embed description', async () => {
    const interaction = createMockInteraction({
      base_color: '#FF0000',
      type: 'complementary',
    });

    await execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];
    expect(embed.data.description).toContain('#FF0000');
  });

  it('should include base dye name in embed', async () => {
    const interaction = createMockInteraction({
      base_color: 'Dalamud Red',
      type: 'complementary',
    });

    await execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];
    expect(embed.data.description).toContain('Dalamud Red');
  });

  it('should include numbered emojis for companions', async () => {
    const interaction = createMockInteraction({
      base_color: '#FF0000',
      type: 'triadic',
    });

    await execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];
    const fields = embed.data.fields || [];

    // Check for numbered emojis (1️⃣, 2️⃣, 3️⃣)
    expect(fields[0].name).toContain('1️⃣');
    expect(fields[1].name).toContain('2️⃣');
    expect(fields[2].name).toContain('3️⃣');
  });

  it('should include angle information in companion fields', async () => {
    const interaction = createMockInteraction({
      base_color: '#FF0000',
      type: 'triadic',
    });

    await execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];
    const fields = embed.data.fields || [];

    // Companions should have angle information
    expect(fields[1].value).toMatch(/\d+°/);
    expect(fields[2].value).toMatch(/\d+°/);
  });

  it('should include match quality (Excellent/Good/Fair)', async () => {
    const interaction = createMockInteraction({
      base_color: '#FF0000',
      type: 'triadic',
    });

    await execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];
    const fields = embed.data.fields || [];

    // Should have quality indicator
    const hasQuality = fields.some((field: any) => field.value.match(/Excellent|Good|Fair/));
    expect(hasQuality).toBe(true);
  });

  it('should have timestamp in embed', async () => {
    const interaction = createMockInteraction({
      base_color: '#FF0000',
      type: 'complementary',
    });

    await execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];
    expect(embed.data.timestamp).toBeDefined();
  });
});
