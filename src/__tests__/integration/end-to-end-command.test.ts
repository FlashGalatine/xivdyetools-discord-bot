/**
 * End-to-end command execution tests
 * Per R-5: Tests complete command execution workflows
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';
import { matchCommand } from '../../commands/match.js';
import { harmonyCommand } from '../../commands/harmony.js';
import { dyeCommand } from '../../commands/dye.js';

/**
 * Create mock ChatInputCommandInteraction
 */
function createMockInteraction(
  commandName: string,
  options: Record<string, string | number | null> = {}
): ChatInputCommandInteraction {
  const deferReply = vi.fn().mockResolvedValue(undefined);
  const editReply = vi.fn().mockResolvedValue(undefined);
  const reply = vi.fn().mockResolvedValue(undefined);

  const getString = vi.fn((name: string) => {
    return (options[name] as string) || null;
  });

  const getInteger = vi.fn((name: string) => {
    return (options[name] as number) || null;
  });

  return {
    commandName,
    deferReply,
    editReply,
    reply,
    deferred: false,
    replied: false,
    options: {
      getString,
      getInteger,
    },
    user: {
      id: 'test-user-123',
    },
    guildId: 'test-guild-456',
  } as unknown as ChatInputCommandInteraction;
}

/**
 * Create mock AutocompleteInteraction
 */
function createMockAutocomplete(
  commandName: string,
  focusedOption: { name: string; value: string }
): AutocompleteInteraction {
  const respond = vi.fn().mockResolvedValue(undefined);

  return {
    commandName,
    respond,
    options: {
      getFocused: vi.fn(() => focusedOption),
    },
  } as unknown as AutocompleteInteraction;
}

describe('End-to-End Command Execution - Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Complete Command Workflows', () => {
    it('should execute match command end-to-end', async () => {
      const interaction = createMockInteraction('match', { color: '#FF0000' });

      await matchCommand.execute(interaction);

      expect(interaction.deferReply).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalled();

      const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
      const embed = editCall.embeds[0];

      // Verify response structure
      expect(embed.data.title).toBeDefined();
      expect(embed.data.fields).toBeDefined();
      expect(embed.data.fields?.length).toBeGreaterThan(0);

      // Verify content
      const fieldNames = embed.data.fields?.map((f: any) => f.name) || [];
      expect(fieldNames.some((name: string) => name.includes('Color'))).toBe(true);
      expect(fieldNames.some((name: string) => name.includes('Dye'))).toBe(true);
    });

    it('should execute harmony command end-to-end', async () => {
      const interaction = createMockInteraction('harmony', {
        base_color: '#FF0000',
        type: 'triadic',
      });

      await harmonyCommand.execute(interaction);

      expect(interaction.deferReply).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalled();
    });

    it('should execute dye command end-to-end', async () => {
      const interaction = createMockInteraction('dye', { dye: 'Dalamud Red' });

      await dyeCommand.execute(interaction);

      expect(interaction.deferReply).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalled();
    });
  });

  describe('Autocomplete Workflows', () => {
    it('should handle match command autocomplete', async () => {
      const interaction = createMockAutocomplete('match', {
        name: 'color',
        value: 'dalamud',
      });

      await matchCommand.autocomplete!(interaction);

      expect(interaction.respond).toHaveBeenCalled();
      const respondCall = vi.mocked(interaction.respond).mock.calls[0][0];
      expect(Array.isArray(respondCall)).toBe(true);
      expect(respondCall.length).toBeGreaterThan(0);
      expect(respondCall.length).toBeLessThanOrEqual(25); // Discord limit
    });

    it('should handle harmony command autocomplete', async () => {
      const interaction = createMockAutocomplete('harmony', {
        name: 'base_color',
        value: 'red',
      });

      if (harmonyCommand.autocomplete) {
        await harmonyCommand.autocomplete(interaction);
        expect(interaction.respond).toHaveBeenCalled();
      }
    });
  });

  describe('Error Recovery Workflows', () => {
    it('should recover from validation errors gracefully', async () => {
      const interaction = createMockInteraction('match', { color: 'InvalidColor!!!' });

      await matchCommand.execute(interaction);

      // Should still defer and respond (with error)
      expect(interaction.deferReply).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalled();

      const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
      const embed = editCall.embeds[0];
      expect(embed.data.title).toContain('❌');
    });

    it('should handle missing options gracefully', async () => {
      const interaction = createMockInteraction('match', {}); // No color

      await matchCommand.execute(interaction);

      // Should handle gracefully
      expect(interaction.deferReply).toHaveBeenCalled();
    });
  });

  describe('Command Performance - End-to-End', () => {
    it('should execute match command within performance target', async () => {
      const interaction = createMockInteraction('match', { color: '#FF0000' });

      const start = performance.now();
      await matchCommand.execute(interaction);
      const duration = performance.now() - start;

      // Target: < 1500ms (per optimization goals)
      expect(duration).toBeLessThan(1500);
    });

    it('should execute harmony command within performance target', async () => {
      const interaction = createMockInteraction('harmony', {
        base_color: '#FF0000',
        type: 'triadic',
      });

      const start = performance.now();
      await harmonyCommand.execute(interaction);
      const duration = performance.now() - start;

      // Target: < 1000ms (per optimization goals)
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Command Response Quality', () => {
    it('should return complete and accurate information', async () => {
      const interaction = createMockInteraction('match', { color: '#FF0000' });

      await matchCommand.execute(interaction);

      const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
      const embed = editCall.embeds[0];

      // Should have all required fields
      const fields = embed.data.fields || [];
      const hasInputColor = fields.some((f: any) => f.name.includes('Input Color'));
      const hasClosestDye = fields.some((f: any) => f.name.includes('Closest Dye'));
      const hasMatchQuality = fields.some((f: any) => f.name === 'Match Quality');

      expect(hasInputColor).toBe(true);
      expect(hasClosestDye).toBe(true);
      expect(hasMatchQuality).toBe(true);
    });

    it('should format color information correctly', async () => {
      const interaction = createMockInteraction('match', { color: '#FF0000' });

      await matchCommand.execute(interaction);

      const editCall = vi.mocked(interaction.editReply).mock.calls[0][0];
      const embed = editCall.embeds[0];

      // Should contain hex color in response
      const description = embed.data.description || '';
      const fields = embed.data.fields || [];
      const fieldValues = fields.map((f: any) => f.value).join(' ');

      expect(description + fieldValues).toMatch(/#[0-9A-F]{6}/i);
    });
  });
});
