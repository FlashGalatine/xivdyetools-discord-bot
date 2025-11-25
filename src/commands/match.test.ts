/**
 * Integration tests for /match command
 */

import { describe, it, expect, vi } from 'vitest';
import { matchCommand } from './match.js';
import type { ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';
import type { Dye } from 'xivdyetools-core';

// Mock emoji service
vi.mock('../services/emoji-service.js', () => ({
  emojiService: {
    getDyeEmojiOrSwatch: vi.fn((dye: Dye) => {
      if (dye.name === 'Dalamud Red') {
        return '<:dye_5730:123456789>';
      }
      return `████ ${dye.hex.toUpperCase()}`;
    }),
    getDyeEmoji: vi.fn((dye: Dye) => {
      if (dye.name === 'Dalamud Red') {
        return {
          id: '123456789',
          name: 'dye_5730',
          url: 'https://cdn.discordapp.com/emojis/dye_5730.webp',
          imageURL: vi.fn(() => 'https://cdn.discordapp.com/emojis/dye_5730.webp'),
        };
      }
      return undefined;
    }),
  },
}));

/**
 * Create mock ChatInputCommandInteraction
 */
function createMockInteraction(color: string): ChatInputCommandInteraction {
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
      getString: vi.fn((name: string) => {
        if (name === 'color') return color;
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

describe('Match Command - Input Validation', () => {
  it('should accept valid hex color input', async () => {
    const interaction = createMockInteraction('#FF0000');

    await matchCommand.execute(interaction);

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalled();

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];
    expect(embed.data.title).not.toContain('❌');
    expect(embed.data.title).toContain('Dye Match');
  });

  it('should accept valid dye name input', async () => {
    const interaction = createMockInteraction('Dalamud Red');

    await matchCommand.execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];
    expect(embed.data.title).not.toContain('❌');
    expect(embed.data.description).toContain('Dalamud Red');
  });

  it('should reject invalid hex color', async () => {
    const interaction = createMockInteraction('#GGGGGG');

    await matchCommand.execute(interaction);

    const followUpCall = vi.mocked(interaction.followUp).mock.calls[0][0];
    const embed = (followUpCall as any).embeds[0];
    expect(embed.data.title).toContain('❌');
    expect(embed.data.title).toContain('Invalid Input');
  });

  it('should reject invalid dye name', async () => {
    const interaction = createMockInteraction('Nonexistent Dye 12345');

    await matchCommand.execute(interaction);

    const followUpCall = vi.mocked(interaction.followUp).mock.calls[0][0];
    const embed = (followUpCall as any).embeds[0];
    expect(embed.data.title).toContain('❌');
    expect(embed.data.description).toContain('not a valid hex color or dye name');
  });

  it('should handle lowercase hex colors', async () => {
    const interaction = createMockInteraction('#ff0000');

    await matchCommand.execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];
    expect(embed.data.title).not.toContain('❌');
  });

  it('should handle case-insensitive dye names', async () => {
    const interaction = createMockInteraction('dalamud red');

    await matchCommand.execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];
    expect(embed.data.title).not.toContain('❌');
  });
});

describe('Match Command - Match Quality Levels', () => {
  it('should show Perfect match when searching for exact dye', async () => {
    // Use dye name to ensure perfect match
    const interaction = createMockInteraction('Dalamud Red');

    await matchCommand.execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];
    expect(embed.data.title).toContain('🎯');

    const matchQualityField = embed.data.fields?.find((f: any) => f.name === 'Match Quality');
    expect(matchQualityField?.value).toContain('Perfect match');
    expect(matchQualityField?.value).toContain('0.00');
  });

  it('should show match quality based on distance', async () => {
    // Use arbitrary hex color - will match to some dye
    const interaction = createMockInteraction('#FF0000');

    await matchCommand.execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];

    const matchQualityField = embed.data.fields?.find((f: any) => f.name === 'Match Quality');
    // Should have one of the quality levels
    expect(matchQualityField?.value).toMatch(
      /Perfect match|Excellent match|Good match|Fair match|Approximate match/
    );
  });

  it('should show appropriate quality emoji in title', async () => {
    const interaction = createMockInteraction('#FF0000');

    await matchCommand.execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];

    // Should have one of the quality emojis
    expect(embed.data.title).toMatch(/🎯|✨|👍|👌|🔍/);
  });

  it('should calculate and display distance in match quality', async () => {
    const interaction = createMockInteraction('#FF0000');

    await matchCommand.execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];

    const matchQualityField = embed.data.fields?.find((f: any) => f.name === 'Match Quality');
    expect(matchQualityField?.value).toContain('Distance:');
    expect(matchQualityField?.value).toContain('Euclidean');
  });
});

describe('Match Command - Embed Content', () => {
  it('should include input color field', async () => {
    const interaction = createMockInteraction('#FF0000');

    await matchCommand.execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];

    const inputField = embed.data.fields?.find((f: any) => f.name === 'Input Color');
    expect(inputField).toBeDefined();
    expect(inputField?.value).toContain('#FF0000');
    expect(inputField?.value).toContain('RGB');
    expect(inputField?.value).toContain('HSV');
  });

  it('should include closest dye field with all info', async () => {
    const interaction = createMockInteraction('#FF0000');

    await matchCommand.execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];

    const dyeField = embed.data.fields?.find((f: any) => f.name.includes('Closest Dye'));
    expect(dyeField).toBeDefined();
    expect(dyeField?.value).toContain('Hex:');
    expect(dyeField?.value).toContain('RGB:');
    expect(dyeField?.value).toContain('HSV:');
    expect(dyeField?.value).toContain('Category:');
  });

  it('should include match quality field', async () => {
    const interaction = createMockInteraction('#FF0000');

    await matchCommand.execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];

    const qualityField = embed.data.fields?.find((f: any) => f.name === 'Match Quality');
    expect(qualityField).toBeDefined();
    expect(qualityField?.value).toContain('Distance:');
    expect(qualityField?.value).toContain('Quality:');
  });

  it('should include acquisition field when available', async () => {
    const interaction = createMockInteraction('Dalamud Red');

    await matchCommand.execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];

    const acquisitionField = embed.data.fields?.find((f: any) => f.name === 'Acquisition');
    expect(acquisitionField).toBeDefined();
  });

  it('should set embed color to match dye color', async () => {
    const interaction = createMockInteraction('#FF0000');

    await matchCommand.execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];

    expect(embed.data.color).toBeDefined();
    expect(typeof embed.data.color).toBe('number');
  });

  it('should have timestamp', async () => {
    const interaction = createMockInteraction('#FF0000');

    await matchCommand.execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];

    expect(embed.data.timestamp).toBeDefined();
  });

  it('should show hex input in description when hex provided', async () => {
    const interaction = createMockInteraction('#FF0000');

    await matchCommand.execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];

    expect(embed.data.description).toContain('#FF0000');
  });

  it('should show dye name in description when dye name provided', async () => {
    const interaction = createMockInteraction('Dalamud Red');

    await matchCommand.execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];

    expect(embed.data.description).toContain('Dalamud Red');
  });

  it('should include dye name in closest dye field name', async () => {
    const interaction = createMockInteraction('#FF0000');

    await matchCommand.execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];

    const dyeField = embed.data.fields?.find((f: any) => f.name.includes('Closest Dye'));
    expect(dyeField?.name).toMatch(/Closest Dye: .+/);
  });
});

describe('Match Command - Emoji Attachments', () => {
  it('should not include emoji attachment', async () => {
    const interaction = createMockInteraction('Dalamud Red'); // Has emoji

    await matchCommand.execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const files = (editCall as any).files;

    // Should be undefined as we use URL now
    expect(files).toBeUndefined();
  });

  it('should set thumbnail when emoji available', async () => {
    const interaction = createMockInteraction('Dalamud Red');

    await matchCommand.execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];

    expect(embed.data.thumbnail?.url).toContain('https://cdn.discordapp.com/emojis/dye_5730.webp');
  });

  it('should not include emoji when not available', async () => {
    const interaction = createMockInteraction('#ABCDEF'); // Random color

    await matchCommand.execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const files = (editCall as any).files;

    expect(files).toBeUndefined();
  });
});

describe('Match Command - Error Handling', () => {
  it('should handle errors gracefully', async () => {
    const interaction = createMockInteraction('Invalid Input!!!');

    await matchCommand.execute(interaction);

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(interaction.followUp).toHaveBeenCalled();
  });

  it('should defer reply before editing', async () => {
    const interaction = createMockInteraction('#FF0000');

    await matchCommand.execute(interaction);

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalled();
    expect(interaction.deferReply).toHaveBeenCalledTimes(1);
  });
});

describe('Match Command - Autocomplete', () => {
  it('should return empty array for hex color query', async () => {
    const interaction = createMockAutocompleteInteraction({
      name: 'color',
      value: '#FF0000',
    });

    await matchCommand.autocomplete!(interaction);

    expect(interaction.respond).toHaveBeenCalledWith([]);
  });

  it('should return matching dyes for name query', async () => {
    const interaction = createMockAutocompleteInteraction({
      name: 'color',
      value: 'red',
    });

    await matchCommand.autocomplete!(interaction);

    const respondCall = vi.mocked(interaction.respond).mock.calls[0][0];
    expect(respondCall.length).toBeGreaterThan(0);
    expect(respondCall[0]).toHaveProperty('name');
    expect(respondCall[0]).toHaveProperty('value');
  });

  it('should limit autocomplete results to 25', async () => {
    const interaction = createMockAutocompleteInteraction({
      name: 'color',
      value: '', // Empty query returns many results
    });

    await matchCommand.autocomplete!(interaction);

    const respondCall = vi.mocked(interaction.respond).mock.calls[0][0];
    expect(respondCall.length).toBeLessThanOrEqual(25);
  });

  it('should exclude Facewear category from autocomplete', async () => {
    const interaction = createMockAutocompleteInteraction({
      name: 'color',
      value: '',
    });

    await matchCommand.autocomplete!(interaction);

    const respondCall = vi.mocked(interaction.respond).mock.calls[0][0];
    const hasFacewear = respondCall.some((choice: any) => choice.name.includes('Facewear'));
    expect(hasFacewear).toBe(false);
  });

  it('should format autocomplete results with category', async () => {
    const interaction = createMockAutocompleteInteraction({
      name: 'color',
      value: 'dalamud',
    });

    await matchCommand.autocomplete!(interaction);

    const respondCall = vi.mocked(interaction.respond).mock.calls[0][0];
    expect(respondCall.length).toBeGreaterThan(0);
    expect(respondCall[0].name).toMatch(/.*\(.*\)/);
  });

  it('should be case-insensitive for autocomplete', async () => {
    const interaction = createMockAutocompleteInteraction({
      name: 'color',
      value: 'DALAMUD',
    });

    await matchCommand.autocomplete!(interaction);

    const respondCall = vi.mocked(interaction.respond).mock.calls[0][0];
    expect(respondCall.length).toBeGreaterThan(0);
  });
});

describe('Match Command - Color Formatting', () => {
  it('should uppercase hex colors in output', async () => {
    const interaction = createMockInteraction('#ff0000');

    await matchCommand.execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];

    const inputField = embed.data.fields?.find((f: any) => f.name === 'Input Color');
    expect(inputField?.value).toContain('#FF0000');
  });

  it('should include color swatches or emojis for both input and match', async () => {
    const interaction = createMockInteraction('#FF0000');

    await matchCommand.execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];

    const inputField = embed.data.fields?.find((f: any) => f.name === 'Input Color');
    const dyeField = embed.data.fields?.find((f: any) => f.name.includes('Closest Dye'));

    // Input field always uses swatch
    expect(inputField?.value).toContain('█');
    // Dye field uses emoji or swatch
    expect(dyeField?.value).toMatch(/█|<:dye_/);
  });

  it('should format RGB values correctly', async () => {
    const interaction = createMockInteraction('#FF0000');

    await matchCommand.execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];

    const inputField = embed.data.fields?.find((f: any) => f.name === 'Input Color');
    expect(inputField?.value).toMatch(/RGB\(\d+, \d+, \d+\)/);
  });

  it('should format HSV values correctly', async () => {
    const interaction = createMockInteraction('#FF0000');

    await matchCommand.execute(interaction);

    const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
    const embed = (editCall as any).embeds[0];

    const inputField = embed.data.fields?.find((f: any) => f.name === 'Input Color');
    expect(inputField?.value).toMatch(/HSV\(\d+°, \d+%, \d+%\)/);
  });
});
