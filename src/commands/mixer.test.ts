/**
 * Integration tests for /mixer command
 */

import { describe, it, expect, vi } from 'vitest';
import type { ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';
import type { Dye } from 'xivdyetools-core';

// Mock config before importing modules that depend on it
vi.mock('../config.js', () => ({
  config: {
    logLevel: 'info',
    token: 'test-token',
    clientId: 'test-client-id',
  },
}));

// Mock emoji service
vi.mock('../services/emoji-service.js', () => ({
  emojiService: {
    getDyeEmojiOrSwatch: vi.fn((dye: Dye) => {
      if (dye.name === 'Dalamud Red') {
        return '<:dye_5730:123456789>';
      }
      return `████ ${dye.hex.toUpperCase()}`;
    }),
  },
}));

// Import after mocks are set up
import { execute, autocomplete } from './mixer.js';

/**
 * Create mock ChatInputCommandInteraction
 */
function createMockInteraction(options: {
  start_color: string;
  end_color: string;
  steps?: number | null;
}): ChatInputCommandInteraction {
  const mockInteraction = {
    deferred: false,
    replied: false,
    user: {
      id: 'test-user-123',
      username: 'TestUser',
      discriminator: '0000',
      avatar: null,
      bot: false,
    },
    guildId: 'test-guild-123',
    options: {
      getString: vi.fn((name: string, _required?: boolean) => {
        if (name === 'start_color') return options.start_color;
        if (name === 'end_color') return options.end_color;
        return null;
      }),
      getInteger: vi.fn((name: string) => {
        if (name === 'steps') return options.steps ?? null;
        return null;
      }),
    },
  } as any;

  // Mock methods that update state
  mockInteraction.deferReply = vi.fn().mockImplementation(() => {
    mockInteraction.deferred = true;
    return Promise.resolve();
  });
  mockInteraction.editReply = vi.fn().mockResolvedValue(undefined);
  mockInteraction.followUp = vi.fn().mockResolvedValue({
    id: 'mock-message-id',
    channelId: 'test-channel-123',
    guildId: 'test-guild-123',
  });
  mockInteraction.reply = vi.fn().mockImplementation(() => {
    mockInteraction.replied = true;
    return Promise.resolve();
  });

  return mockInteraction as unknown as ChatInputCommandInteraction;
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

describe('Mixer Command - Input Validation', () => {
  it('should accept valid hex colors for both inputs', async () => {
    const interaction = createMockInteraction({
      start_color: '#FF0000',
      end_color: '#0000FF',
    });

    await execute(interaction);

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalled();

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];
    expect(embed.data.title).not.toContain('❌');
    expect(embed.data.title).toContain('Color Gradient Mixer');
  });

  it('should accept valid dye names for both inputs', async () => {
    const interaction = createMockInteraction({
      start_color: 'Dalamud Red',
      end_color: 'Snow White',
    });

    await execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];
    expect(embed.data.title).not.toContain('❌');
    expect(embed.data.description).toContain('Dalamud Red');
    expect(embed.data.description).toContain('Snow White');
  });

  it('should accept mixed hex and dye name inputs', async () => {
    const interaction = createMockInteraction({
      start_color: '#FF0000',
      end_color: 'Snow White',
    });

    await execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];
    expect(embed.data.title).not.toContain('❌');
  });

  it('should reject invalid start color', async () => {
    const interaction = createMockInteraction({
      start_color: 'Invalid Color!!!',
      end_color: '#0000FF',
    });

    await execute(interaction);

    const followUpCall = vi.mocked(interaction.followUp).mock.calls[0][0];
    const embed = (followUpCall as any).embeds[0];
    expect(embed.data.title).toContain('❌');
    expect(embed.data.title).toContain('Invalid Start Color');
  });

  it('should reject invalid end color', async () => {
    const interaction = createMockInteraction({
      start_color: '#FF0000',
      end_color: 'Invalid Color!!!',
    });

    await execute(interaction);

    const followUpCall = vi.mocked(interaction.followUp).mock.calls[0][0];
    const embed = (followUpCall as any).embeds[0];
    expect(embed.data.title).toContain('❌');
    expect(embed.data.title).toContain('Invalid End Color');
  });

  it('should handle lowercase hex colors', async () => {
    const interaction = createMockInteraction({
      start_color: '#ff0000',
      end_color: '#0000ff',
    });

    await execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];
    expect(embed.data.title).not.toContain('❌');
  });
});

describe('Mixer Command - Steps Parameter', () => {
  it('should use default 6 steps when not specified', async () => {
    const interaction = createMockInteraction({
      start_color: '#FF0000',
      end_color: '#0000FF',
      steps: null,
    });

    await execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];
    const fields = embed.data.fields || [];

    // Should have 6 step fields + 1 tip field = 7 fields
    expect(fields.length).toBe(7);
    expect(embed.data.description).toContain('Steps:** 6');
  });

  it('should accept minimum 2 steps', async () => {
    const interaction = createMockInteraction({
      start_color: '#FF0000',
      end_color: '#0000FF',
      steps: 2,
    });

    await execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];
    const fields = embed.data.fields || [];

    // Should have 2 step fields + 1 tip field = 3 fields
    expect(fields.length).toBe(3);
  });

  it('should accept maximum 10 steps', async () => {
    const interaction = createMockInteraction({
      start_color: '#FF0000',
      end_color: '#0000FF',
      steps: 10,
    });

    await execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];
    const fields = embed.data.fields || [];

    // Should have 10 step fields + 1 tip field = 11 fields
    expect(fields.length).toBe(11);
  });

  it('should accept mid-range steps (e.g., 7)', async () => {
    const interaction = createMockInteraction({
      start_color: '#FF0000',
      end_color: '#0000FF',
      steps: 7,
    });

    await execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];
    expect(embed.data.description).toContain('Steps:** 7');
  });
});

describe('Mixer Command - Gradient Generation', () => {
  it('should generate correct number of gradient colors', async () => {
    const interaction = createMockInteraction({
      start_color: '#FF0000',
      end_color: '#0000FF',
      steps: 5,
    });

    await execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];
    const fields = embed.data.fields || [];

    // Filter out the tip field
    const stepFields = fields.filter((f: any) => f.name.includes('Step'));
    expect(stepFields.length).toBe(5);
  });

  it('should find dyes for each gradient step', async () => {
    const interaction = createMockInteraction({
      start_color: '#FF0000',
      end_color: '#0000FF',
      steps: 3,
    });

    await execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];
    const fields = embed.data.fields || [];

    // Each step should have a dye match
    const stepFields = fields.filter((f: any) => f.name.includes('Step'));
    stepFields.forEach((field: any) => {
      expect(field.value).toContain('Target:');
      expect(field.value).toContain('Match:');
      expect(field.value).toContain('Category:');
    });
  });

  it('should calculate match quality for each step', async () => {
    const interaction = createMockInteraction({
      start_color: '#FF0000',
      end_color: '#0000FF',
      steps: 3,
    });

    await execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];
    const fields = embed.data.fields || [];

    const stepFields = fields.filter((f: any) => f.name.includes('Step'));
    stepFields.forEach((field: any) => {
      // Should have quality label
      expect(field.value).toMatch(/Perfect|Excellent|Good|Fair|Approximate/);
      // Should have distance
      expect(field.value).toContain('Δ=');
    });
  });
});

describe('Mixer Command - Embed Content', () => {
  it('should include start color in description', async () => {
    const interaction = createMockInteraction({
      start_color: '#FF0000',
      end_color: '#0000FF',
    });

    await execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];
    expect(embed.data.description).toContain('Start:');
    expect(embed.data.description).toContain('#FF0000');
  });

  it('should include end color in description', async () => {
    const interaction = createMockInteraction({
      start_color: '#FF0000',
      end_color: '#0000FF',
    });

    await execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];
    expect(embed.data.description).toContain('End:');
    expect(embed.data.description).toContain('#0000FF');
  });

  it('should include steps count in description', async () => {
    const interaction = createMockInteraction({
      start_color: '#FF0000',
      end_color: '#0000FF',
      steps: 7,
    });

    await execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];
    expect(embed.data.description).toContain('Steps:** 7');
  });

  it('should show dye names when provided', async () => {
    const interaction = createMockInteraction({
      start_color: 'Dalamud Red',
      end_color: 'Snow White',
    });

    await execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];
    expect(embed.data.description).toContain('Dalamud Red');
    expect(embed.data.description).toContain('Snow White');
  });

  it('should use emojis for dyes when available', async () => {
    const interaction = createMockInteraction({
      start_color: 'Dalamud Red',
      end_color: 'Snow White',
    });

    await execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];
    // Check for mocked emoji
    expect(embed.data.description).toContain('<:dye_5730:123456789>');
  });

  it('should include numbered emojis for steps', async () => {
    const interaction = createMockInteraction({
      start_color: '#FF0000',
      end_color: '#0000FF',
      steps: 5,
    });

    await execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];
    const fields = embed.data.fields || [];

    // Check for numbered emojis (1️⃣, 2️⃣, 3️⃣, 4️⃣, 5️⃣)
    expect(fields[0].name).toContain('1️⃣');
    expect(fields[1].name).toContain('2️⃣');
    expect(fields[2].name).toContain('3️⃣');
    expect(fields[3].name).toContain('4️⃣');
    expect(fields[4].name).toContain('5️⃣');
  });

  it('should include tip field', async () => {
    const interaction = createMockInteraction({
      start_color: '#FF0000',
      end_color: '#0000FF',
    });

    await execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];
    const fields = embed.data.fields || [];

    const tipField = fields.find((f: any) => f.name === '💡 Tip');
    expect(tipField).toBeDefined();
    expect(tipField?.value).toContain('/match');
  });

  it('should have timestamp', async () => {
    const interaction = createMockInteraction({
      start_color: '#FF0000',
      end_color: '#0000FF',
    });

    await execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];
    expect(embed.data.timestamp).toBeDefined();
  });

  it('should set embed color to start color', async () => {
    const interaction = createMockInteraction({
      start_color: '#FF0000',
      end_color: '#0000FF',
    });

    await execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];
    expect(embed.data.color).toBeDefined();
    expect(typeof embed.data.color).toBe('number');
  });
});

describe('Mixer Command - Gradient Image', () => {
  it('should include gradient image attachment', async () => {
    const interaction = createMockInteraction({
      start_color: '#FF0000',
      end_color: '#0000FF',
    });

    await execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const files = (editCall as any).files;

    expect(files.length).toBe(1);
    expect(files[0].name).toContain('gradient_');
    expect(files[0].name).toContain('steps.png');
  });

  it('should set gradient as embed image', async () => {
    const interaction = createMockInteraction({
      start_color: '#FF0000',
      end_color: '#0000FF',
      steps: 5,
    });

    await execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];

    expect(embed.data.image?.url).toContain('attachment://gradient_5steps.png');
  });

  it('should name gradient file based on steps count', async () => {
    const interaction = createMockInteraction({
      start_color: '#FF0000',
      end_color: '#0000FF',
      steps: 7,
    });

    await execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const files = (editCall as any).files;

    expect(files[0].name).toBe('gradient_7steps.png');
  });
});

describe('Mixer Command - Step Fields', () => {
  it('should include target color for each step', async () => {
    const interaction = createMockInteraction({
      start_color: '#FF0000',
      end_color: '#0000FF',
      steps: 3,
    });

    await execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];
    const fields = embed.data.fields || [];

    const stepFields = fields.filter((f: any) => f.name.includes('Step'));
    stepFields.forEach((field: any) => {
      expect(field.value).toContain('Target:');
      expect(field.value).toMatch(/#[0-9A-F]{6}/);
    });
  });

  it('should include matched dye hex for each step', async () => {
    const interaction = createMockInteraction({
      start_color: '#FF0000',
      end_color: '#0000FF',
      steps: 3,
    });

    await execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];
    const fields = embed.data.fields || [];

    const stepFields = fields.filter((f: any) => f.name.includes('Step'));
    stepFields.forEach((field: any) => {
      expect(field.value).toContain('Match:');
    });
  });

  it('should include category for each matched dye', async () => {
    const interaction = createMockInteraction({
      start_color: '#FF0000',
      end_color: '#0000FF',
      steps: 3,
    });

    await execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];
    const fields = embed.data.fields || [];

    const stepFields = fields.filter((f: any) => f.name.includes('Step'));
    stepFields.forEach((field: any) => {
      expect(field.value).toContain('Category:');
    });
  });

  it('should include color swatches for steps', async () => {
    const interaction = createMockInteraction({
      start_color: '#FF0000',
      end_color: '#0000FF',
      steps: 3,
    });

    await execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];
    const fields = embed.data.fields || [];

    const stepFields = fields.filter((f: any) => f.name.includes('Step'));
    stepFields.forEach((field: any) => {
      expect(field.value).toContain('█');
    });
  });
});

describe('Mixer Command - Error Handling', () => {
  it('should handle errors gracefully', async () => {
    const interaction = createMockInteraction({
      start_color: 'Invalid!!!',
      end_color: '#0000FF',
    });

    await execute(interaction);

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(interaction.followUp).toHaveBeenCalled();
  });

  it('should defer reply before editing', async () => {
    const interaction = createMockInteraction({
      start_color: '#FF0000',
      end_color: '#0000FF',
    });

    await execute(interaction);

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalled();
    expect(interaction.deferReply).toHaveBeenCalledTimes(1);
  });
});

describe('Mixer Command - Autocomplete', () => {
  it('should return empty array for hex color query on start_color', async () => {
    const interaction = createMockAutocompleteInteraction({
      name: 'start_color',
      value: '#FF0000',
    });

    await autocomplete(interaction);

    expect(interaction.respond).toHaveBeenCalledWith([]);
  });

  it('should return empty array for hex color query on end_color', async () => {
    const interaction = createMockAutocompleteInteraction({
      name: 'end_color',
      value: '#FF0000',
    });

    await autocomplete(interaction);

    expect(interaction.respond).toHaveBeenCalledWith([]);
  });

  it('should return matching dyes for name query on start_color', async () => {
    const interaction = createMockAutocompleteInteraction({
      name: 'start_color',
      value: 'red',
    });

    await autocomplete(interaction);

    const respondCall = vi.mocked(interaction.respond).mock.calls[0][0];
    expect(respondCall.length).toBeGreaterThan(0);
  });

  it('should return matching dyes for name query on end_color', async () => {
    const interaction = createMockAutocompleteInteraction({
      name: 'end_color',
      value: 'blue',
    });

    await autocomplete(interaction);

    const respondCall = vi.mocked(interaction.respond).mock.calls[0][0];
    expect(respondCall.length).toBeGreaterThan(0);
  });

  it('should limit autocomplete results to 25', async () => {
    const interaction = createMockAutocompleteInteraction({
      name: 'start_color',
      value: '',
    });

    await autocomplete(interaction);

    const respondCall = vi.mocked(interaction.respond).mock.calls[0][0];
    expect(respondCall.length).toBeLessThanOrEqual(25);
  });

  it('should exclude Facewear category', async () => {
    const interaction = createMockAutocompleteInteraction({
      name: 'start_color',
      value: '',
    });

    await autocomplete(interaction);

    const respondCall = vi.mocked(interaction.respond).mock.calls[0][0];
    const hasFacewear = respondCall.some((choice: any) => choice.name.includes('Facewear'));
    expect(hasFacewear).toBe(false);
  });
});
