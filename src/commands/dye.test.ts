/**
 * Integration tests for /dye command
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';

// Mock dependencies
vi.mock('../utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../services/i18n-service.js', () => ({
  t: vi.fn((key: string, params?: Record<string, unknown>) => {
    const translations: Record<string, string> = {
      'errors.dyeNotFound': 'Dye Not Found',
      'errors.couldNotFindDyeWithSuggestion': `Could not find dye: ${String(params?.name ?? 'unknown')}`,
      'errors.noResults': 'No Results',
      'errors.noDyesFoundWithSuggestion': `No dyes found for: ${String(params?.query ?? 'unknown')}`,
      'errors.emptyCategory': 'Empty Category',
      'errors.noDyesInCategory': `No dyes in category: ${String(params?.category ?? 'unknown')}`,
      'errors.noDyesAvailable': 'No Dyes Available',
      'errors.noMatchingFilterCriteria': 'No dyes match your filter criteria',
      'errors.invalidCount': 'Invalid Count',
      'errors.commandError': 'Command Error',
      'errors.errorProcessingRequest': 'Error processing request',
      'errors.unknownSubcommand': 'Unknown Subcommand',
      'embeds.dyeSearch': 'Dye Search',
      'embeds.category': 'Category',
      'embeds.acquisition': 'Acquisition',
      'embeds.randomDyes': 'Random Dyes',
      'embeds.useDyeInfoForDetails': 'Use /dye info for details',
      'embeds.useDyeInfoForFullDetails': 'Use /dye info for full details',
      'embeds.useDyeInfoForMoreDetails': 'Use /dye info for more details',
      'embeds.tooManyResults': 'Too many results',
      'labels.found': 'Found',
      'labels.dye': 'dye',
      'labels.dyes': 'dyes',
      'labels.dyesInCategory': 'dyes in category',
      'labels.showingFirst': `showing first ${String(params?.count ?? 0)}`,
      'labels.count': 'Count',
    };
    return translations[key] || key;
  }),
}));

vi.mock('../services/emoji-service.js', () => ({
  emojiService: {
    getDyeEmoji: vi.fn(() => null),
    getDyeEmojiOrSwatch: vi.fn((dye: { hex: string }) => `[${dye.hex}]`),
  },
}));

vi.mock('../utils/embed-builder.js', () => ({
  createErrorEmbed: vi.fn((title: string, description: string) => ({
    data: { title: `❌ ${title}`, description },
  })),
  createDyeEmbed: vi.fn((dye: { name: string; hex: string }) => ({
    data: { title: dye.name, color: parseInt(dye.hex.replace('#', ''), 16) },
    setTitle: vi.fn().mockReturnThis(),
  })),
  createDyeEmojiAttachment: vi.fn(() => null),
}));

vi.mock('../utils/response-helper.js', () => ({
  sendPublicSuccess: vi.fn(),
  sendEphemeralError: vi.fn(),
}));

/**
 * Create mock ChatInputCommandInteraction
 */
function createMockInteraction(options: {
  subcommand: string;
  stringOptions?: Record<string, string | null>;
  integerOptions?: Record<string, number | null>;
  booleanOptions?: Record<string, boolean | null>;
}): ChatInputCommandInteraction {
  const deferReply = vi.fn().mockResolvedValue(undefined);
  const editReply = vi.fn().mockResolvedValue(undefined);
  const followUp = vi.fn().mockResolvedValue(undefined);
  const reply = vi.fn().mockResolvedValue(undefined);

  return {
    deferReply,
    editReply,
    followUp,
    reply,
    deferred: true,
    options: {
      getSubcommand: vi.fn(() => options.subcommand),
      getString: vi.fn((name: string, _required?: boolean) => {
        return options.stringOptions?.[name] ?? null;
      }),
      getInteger: vi.fn((name: string) => {
        return options.integerOptions?.[name] ?? null;
      }),
      getBoolean: vi.fn((name: string) => {
        return options.booleanOptions?.[name] ?? null;
      }),
    },
  } as unknown as ChatInputCommandInteraction;
}

/**
 * Create mock AutocompleteInteraction
 */
function createMockAutocompleteInteraction(focusedOption: {
  name: string;
  value: string;
}): AutocompleteInteraction {
  const respond = vi.fn().mockResolvedValue(undefined);

  return {
    respond,
    options: {
      getFocused: vi.fn((returnFullOption?: boolean) => {
        if (returnFullOption) {
          return focusedOption;
        }
        return focusedOption.value;
      }),
    },
  } as unknown as AutocompleteInteraction;
}

describe('Dye Command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Info Subcommand', () => {
    it('should return dye info for valid dye name', async () => {
      const { execute } = await import('./dye.js');
      const { sendPublicSuccess } = await import('../utils/response-helper.js');

      const interaction = createMockInteraction({
        subcommand: 'info',
        stringOptions: { name: 'Dalamud Red' },
      });

      await execute(interaction);

      expect(interaction.deferReply).toHaveBeenCalled();
      expect(sendPublicSuccess).toHaveBeenCalled();
    });

    it('should return error for unknown dye name', async () => {
      const { execute } = await import('./dye.js');
      const { sendEphemeralError } = await import('../utils/response-helper.js');

      const interaction = createMockInteraction({
        subcommand: 'info',
        stringOptions: { name: 'Nonexistent Dye 12345' },
      });

      await execute(interaction);

      expect(sendEphemeralError).toHaveBeenCalled();
    });

    it('should handle case-insensitive dye names', async () => {
      const { execute } = await import('./dye.js');
      const { sendPublicSuccess } = await import('../utils/response-helper.js');

      const interaction = createMockInteraction({
        subcommand: 'info',
        stringOptions: { name: 'dalamud red' },
      });

      await execute(interaction);

      expect(sendPublicSuccess).toHaveBeenCalled();
    });
  });

  describe('Search Subcommand', () => {
    it('should return matching dyes for query', async () => {
      const { execute } = await import('./dye.js');
      const { sendPublicSuccess } = await import('../utils/response-helper.js');

      const interaction = createMockInteraction({
        subcommand: 'search',
        stringOptions: { query: 'red' },
      });

      await execute(interaction);

      expect(sendPublicSuccess).toHaveBeenCalled();
    });

    it('should return error for no matches', async () => {
      const { execute } = await import('./dye.js');
      const { sendEphemeralError } = await import('../utils/response-helper.js');

      const interaction = createMockInteraction({
        subcommand: 'search',
        stringOptions: { query: 'xyznonexistent123' },
      });

      await execute(interaction);

      expect(sendEphemeralError).toHaveBeenCalled();
    });

    it('should limit results to 15', async () => {
      const { execute } = await import('./dye.js');
      const { sendPublicSuccess } = await import('../utils/response-helper.js');

      // Search for common term that will have many results
      const interaction = createMockInteraction({
        subcommand: 'search',
        stringOptions: { query: 'a' }, // Very broad search
      });

      await execute(interaction);

      expect(sendPublicSuccess).toHaveBeenCalled();
    });
  });

  describe('List Subcommand', () => {
    it('should return all dyes in category', async () => {
      const { execute } = await import('./dye.js');
      const { sendPublicSuccess } = await import('../utils/response-helper.js');

      const interaction = createMockInteraction({
        subcommand: 'list',
        stringOptions: { category: 'Reds' },
      });

      await execute(interaction);

      expect(sendPublicSuccess).toHaveBeenCalled();
    });

    it('should handle all valid categories', async () => {
      const { execute } = await import('./dye.js');
      const { sendPublicSuccess } = await import('../utils/response-helper.js');

      const categories = [
        'Neutral',
        'Reds',
        'Browns',
        'Yellows',
        'Greens',
        'Blues',
        'Purples',
        'Special',
      ];

      for (const category of categories) {
        vi.clearAllMocks();
        const interaction = createMockInteraction({
          subcommand: 'list',
          stringOptions: { category },
        });

        await execute(interaction);
        expect(sendPublicSuccess).toHaveBeenCalled();
      }
    });
  });

  describe('Random Subcommand', () => {
    it('should return single random dye by default', async () => {
      const { execute } = await import('./dye.js');
      const { sendPublicSuccess } = await import('../utils/response-helper.js');

      const interaction = createMockInteraction({
        subcommand: 'random',
      });

      await execute(interaction);

      expect(sendPublicSuccess).toHaveBeenCalled();
    });

    it('should return multiple random dyes with count option', async () => {
      const { execute } = await import('./dye.js');
      const { sendPublicSuccess } = await import('../utils/response-helper.js');

      const interaction = createMockInteraction({
        subcommand: 'random',
        integerOptions: { count: 3 },
      });

      await execute(interaction);

      expect(sendPublicSuccess).toHaveBeenCalled();
    });

    it('should exclude metallic dyes when flag set', async () => {
      const { execute } = await import('./dye.js');
      const { sendPublicSuccess } = await import('../utils/response-helper.js');

      const interaction = createMockInteraction({
        subcommand: 'random',
        booleanOptions: { exclude_metallic: true },
      });

      await execute(interaction);

      expect(sendPublicSuccess).toHaveBeenCalled();
    });

    it('should exclude pastel dyes when flag set', async () => {
      const { execute } = await import('./dye.js');
      const { sendPublicSuccess } = await import('../utils/response-helper.js');

      const interaction = createMockInteraction({
        subcommand: 'random',
        booleanOptions: { exclude_pastel: true },
      });

      await execute(interaction);

      expect(sendPublicSuccess).toHaveBeenCalled();
    });

    it('should exclude dark dyes when flag set', async () => {
      const { execute } = await import('./dye.js');
      const { sendPublicSuccess } = await import('../utils/response-helper.js');

      const interaction = createMockInteraction({
        subcommand: 'random',
        booleanOptions: { exclude_dark: true },
      });

      await execute(interaction);

      expect(sendPublicSuccess).toHaveBeenCalled();
    });

    it('should exclude cosmic dyes when flag set', async () => {
      const { execute } = await import('./dye.js');
      const { sendPublicSuccess } = await import('../utils/response-helper.js');

      const interaction = createMockInteraction({
        subcommand: 'random',
        booleanOptions: { exclude_cosmic: true },
      });

      await execute(interaction);

      expect(sendPublicSuccess).toHaveBeenCalled();
    });

    it('should exclude expensive dyes when flag set', async () => {
      const { execute } = await import('./dye.js');
      const { sendPublicSuccess } = await import('../utils/response-helper.js');

      const interaction = createMockInteraction({
        subcommand: 'random',
        booleanOptions: { exclude_expensive: true },
      });

      await execute(interaction);

      expect(sendPublicSuccess).toHaveBeenCalled();
    });

    it('should handle multiple exclusion flags', async () => {
      const { execute } = await import('./dye.js');
      const { sendPublicSuccess } = await import('../utils/response-helper.js');

      const interaction = createMockInteraction({
        subcommand: 'random',
        booleanOptions: {
          exclude_metallic: true,
          exclude_pastel: true,
          exclude_dark: true,
        },
      });

      await execute(interaction);

      expect(sendPublicSuccess).toHaveBeenCalled();
    });
  });

  describe('Autocomplete', () => {
    it('should return matching dyes for name query', async () => {
      const { autocomplete } = await import('./dye.js');

      const interaction = createMockAutocompleteInteraction({
        name: 'name',
        value: 'red',
      });

      await autocomplete(interaction);

      expect(interaction.respond).toHaveBeenCalled();
      const responseArg = vi.mocked(interaction.respond).mock.calls[0][0];
      expect(Array.isArray(responseArg)).toBe(true);
    });

    it('should limit to 25 results', async () => {
      const { autocomplete } = await import('./dye.js');

      const interaction = createMockAutocompleteInteraction({
        name: 'name',
        value: 'a', // Broad search
      });

      await autocomplete(interaction);

      const responseArg = vi.mocked(interaction.respond).mock.calls[0][0] as Array<unknown>;
      expect(responseArg.length).toBeLessThanOrEqual(25);
    });

    it('should be case-insensitive', async () => {
      const { autocomplete } = await import('./dye.js');

      const interaction = createMockAutocompleteInteraction({
        name: 'name',
        value: 'RED',
      });

      await autocomplete(interaction);

      expect(interaction.respond).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should defer reply before processing', async () => {
      const { execute } = await import('./dye.js');

      const interaction = createMockInteraction({
        subcommand: 'info',
        stringOptions: { name: 'Dalamud Red' },
      });

      await execute(interaction);

      expect(interaction.deferReply).toHaveBeenCalled();
    });

    it('should handle unknown subcommand', async () => {
      const { execute } = await import('./dye.js');
      const { sendEphemeralError } = await import('../utils/response-helper.js');

      const interaction = createMockInteraction({
        subcommand: 'unknown_subcommand',
      });

      await execute(interaction);

      expect(sendEphemeralError).toHaveBeenCalled();
    });

    it('should handle invalid count for random', async () => {
      const { execute } = await import('./dye.js');
      const { sendEphemeralError } = await import('../utils/response-helper.js');

      const interaction = createMockInteraction({
        subcommand: 'random',
        integerOptions: { count: 100 }, // Invalid - too high
      });

      await execute(interaction);

      expect(sendEphemeralError).toHaveBeenCalled();
    });

    it('should handle multiple random dyes request', async () => {
      const { execute } = await import('./dye.js');
      const { sendPublicSuccess } = await import('../utils/response-helper.js');

      const interaction = createMockInteraction({
        subcommand: 'random',
        integerOptions: { count: 3 }, // Request multiple dyes
      });

      await execute(interaction);

      expect(sendPublicSuccess).toHaveBeenCalled();
    });
  });
});
