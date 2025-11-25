/**
 * Integration tests for command execution flow
 * Per R-5: Tests end-to-end command execution
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChatInputCommandInteraction, InteractionEditReplyOptions } from 'discord.js';
import { matchCommand } from '../../commands/match.js';
// Note: harmony and dye commands may need to be imported differently
// For now, we'll focus on match command which we know works

/**
 * Create mock ChatInputCommandInteraction
 */
function createMockInteraction(
  commandName: string,
  options: Record<string, string | number | null> = {},
  subcommand?: string
): ChatInputCommandInteraction {
  const getString = vi.fn((name: string, _required?: boolean) => {
    return (options[name] as string) || null;
  });

  const getInteger = vi.fn((name: string, _required?: boolean) => {
    return (options[name] as number) || null;
  });

  const getSubcommand = vi.fn(() => {
    return subcommand || null;
  });

  const mockInteraction = {
    commandName,
    deferred: false,
    replied: false,
    options: {
      getString,
      getInteger,
      getSubcommand,
    },
    user: {
      id: 'test-user-123',
      username: 'TestUser',
      discriminator: '0000',
      avatar: null,
      bot: false,
    },
    guildId: 'test-guild-456',
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

describe('Command Flow - Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Match Command Flow', () => {
    it('should execute match command with hex color', async () => {
      const interaction = createMockInteraction('match', { color: '#FF0000' });

      await matchCommand.execute(interaction);

      expect(interaction.deferReply).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalled();

      const editCall = vi.mocked(interaction.editReply).mock
        .calls[0][0] as InteractionEditReplyOptions;
      expect(editCall).toHaveProperty('embeds');
      expect(editCall.embeds).toBeInstanceOf(Array);
      expect(editCall.embeds?.length).toBeGreaterThan(0);
    });

    it('should execute match command with dye name', async () => {
      const interaction = createMockInteraction('match', { color: 'Dalamud Red' });

      await matchCommand.execute(interaction);

      expect(interaction.deferReply).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalled();
    });

    it('should handle invalid input gracefully', async () => {
      const interaction = createMockInteraction('match', { color: 'InvalidColor123' });

      await matchCommand.execute(interaction);

      expect(interaction.deferReply).toHaveBeenCalled();
      expect(interaction.followUp).toHaveBeenCalled();

      // Should show error message (errors use followUp with ephemeral)
      const editCall = vi.mocked(interaction.followUp).mock
        .calls[0][0] as InteractionEditReplyOptions;
      const embed = editCall.embeds?.[0];
      if (embed && 'title' in embed) {
        expect(embed.title).toContain('❌');
      } else if (embed && 'toJSON' in embed) {
        const json = embed.toJSON();
        expect(json.title).toContain('❌');
      }
    });
  });

  describe('Command Error Handling', () => {
    it('should handle errors gracefully without crashing', async () => {
      // Create interaction that will cause an error
      const interaction = createMockInteraction('match', { color: '#FF0000' });

      // Mock editReply to throw error
      vi.mocked(interaction.editReply).mockRejectedValueOnce(new Error('Test error'));

      // Should not throw (CommandBase handles errors)
      await expect(matchCommand.execute(interaction)).resolves.not.toThrow();
    });

    it('should handle missing required options', async () => {
      const interaction = createMockInteraction('match', {}); // No color option

      await matchCommand.execute(interaction);

      // Should handle gracefully (validation or error)
      expect(interaction.deferReply).toHaveBeenCalled();
    });
  });

  describe('Command Response Format', () => {
    it('should return properly formatted embeds', async () => {
      const interaction = createMockInteraction('match', { color: '#FF0000' });

      await matchCommand.execute(interaction);

      const editCall = vi.mocked(interaction.editReply).mock
        .calls[0][0] as InteractionEditReplyOptions;
      const embed = editCall.embeds?.[0];
      const embedData = embed && 'toJSON' in embed ? embed.toJSON() : embed;

      // Should have required embed fields
      expect(embedData?.title).toBeDefined();
      expect(embedData?.fields).toBeDefined();
      expect(Array.isArray(embedData?.fields)).toBe(true);
    });

    it('should include color information in response', async () => {
      const interaction = createMockInteraction('match', { color: '#FF0000' });

      await matchCommand.execute(interaction);

      const editCall = vi.mocked(interaction.editReply).mock
        .calls[0][0] as InteractionEditReplyOptions;
      const embed = editCall.embeds?.[0];
      const embedData = embed && 'toJSON' in embed ? embed.toJSON() : embed;

      // Should contain color-related fields
      const fieldNames = embedData?.fields?.map((f: any) => f.name) || [];
      expect(
        fieldNames.some((name: string) => name.includes('Color') || name.includes('Dye'))
      ).toBe(true);
    });
  });

  describe('Command Performance', () => {
    it('should execute commands within reasonable time', async () => {
      const interaction = createMockInteraction('match', { color: '#FF0000' });

      const start = performance.now();
      await matchCommand.execute(interaction);
      const duration = performance.now() - start;

      // Should complete within 2 seconds
      expect(duration).toBeLessThan(2000);
    });
  });
});
