/**
 * Unit tests for CommandBase abstract class
 * Tests all protected methods and error handling branches
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  EmbedBuilder,
} from 'discord.js';
import { CommandBase } from './CommandBase.js';

// Mock dependencies
vi.mock('../../utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../utils/embed-builder.js', () => ({
  createErrorEmbed: vi.fn((title: string, description: string) => ({
    data: { title: `❌ ${title}`, description },
  })),
}));

vi.mock('../../utils/response-helper.js', () => ({
  sendEphemeralError: vi.fn().mockResolvedValue(undefined),
}));

/**
 * Concrete test implementation of CommandBase
 * Exposes protected methods for testing
 */
class TestCommand extends CommandBase {
  readonly data = new SlashCommandBuilder()
    .setName('test')
    .setDescription('Test command for unit testing');

  public executeError: Error | null = null;

  protected executeCommand(_interaction: ChatInputCommandInteraction): Promise<void> {
    if (this.executeError) {
      return Promise.reject(this.executeError);
    }
    return Promise.resolve();
  }

  // Expose protected methods for testing
  public testValidateInput(interaction: ChatInputCommandInteraction): {
    valid: boolean;
    error?: string;
  } {
    return this.validateInput(interaction);
  }

  public testCreateSuccessEmbed(title: string, description: string): EmbedBuilder {
    return this.createSuccessEmbed(title, description);
  }

  public testCreateInfoEmbed(title: string, description: string): EmbedBuilder {
    return this.createInfoEmbed(title, description);
  }

  public async testHandleError(
    interaction: ChatInputCommandInteraction,
    error: unknown,
    commandName: string
  ): Promise<void> {
    return this.handleError(interaction, error, commandName);
  }
}

/**
 * Create mock ChatInputCommandInteraction
 */
function createMockInteraction(
  overrides: Partial<{
    deferred: boolean;
    replied: boolean;
    guildId: string | null;
  }> = {}
): ChatInputCommandInteraction {
  return {
    user: { id: 'test-user-123' },
    guildId: overrides.guildId !== undefined ? overrides.guildId : 'test-guild-456',
    deferred: overrides.deferred ?? false,
    replied: overrides.replied ?? false,
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
    reply: vi.fn().mockResolvedValue(undefined),
    followUp: vi.fn().mockResolvedValue(undefined),
  } as unknown as ChatInputCommandInteraction;
}

/**
 * Create mock AutocompleteInteraction
 */
function createMockAutocompleteInteraction(): AutocompleteInteraction {
  return {
    respond: vi.fn().mockResolvedValue(undefined),
  } as unknown as AutocompleteInteraction;
}

describe('CommandBase', () => {
  let command: TestCommand;

  beforeEach(() => {
    vi.clearAllMocks();
    command = new TestCommand();
    command.executeError = null;
  });

  describe('execute()', () => {
    it('should defer reply if not already deferred', async () => {
      const interaction = createMockInteraction({ deferred: false, replied: false });
      await command.execute(interaction);

      expect(interaction.deferReply).toHaveBeenCalled();
    });

    it('should not defer reply if already deferred', async () => {
      const interaction = createMockInteraction({ deferred: true, replied: false });
      await command.execute(interaction);

      expect(interaction.deferReply).not.toHaveBeenCalled();
    });

    it('should not defer reply if already replied', async () => {
      const interaction = createMockInteraction({ deferred: false, replied: true });
      await command.execute(interaction);

      expect(interaction.deferReply).not.toHaveBeenCalled();
    });

    it('should handle DM interactions (no guildId)', async () => {
      const interaction = createMockInteraction({ guildId: null });
      await command.execute(interaction);

      // Should still execute without error
      expect(interaction.deferReply).toHaveBeenCalled();
    });

    it('should log command execution', async () => {
      const { logger } = await import('../../utils/logger.js');
      const interaction = createMockInteraction();
      await command.execute(interaction);

      expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Executing command: test'));
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Command test completed'));
    });

    it('should call handleError when executeCommand throws', async () => {
      const interaction = createMockInteraction();
      command.executeError = new Error('Test error');

      await command.execute(interaction);

      const { sendEphemeralError } = await import('../../utils/response-helper.js');
      expect(sendEphemeralError).toHaveBeenCalled();
    });
  });

  describe('autocomplete()', () => {
    it('should respond with empty array by default', async () => {
      const interaction = createMockAutocompleteInteraction();

      await command.autocomplete!(interaction);

      expect(interaction.respond).toHaveBeenCalledWith([]);
    });
  });

  describe('validateInput()', () => {
    it('should return valid: true by default', () => {
      const interaction = createMockInteraction();
      const result = command.testValidateInput(interaction);

      expect(result).toEqual({ valid: true });
    });
  });

  describe('createSuccessEmbed()', () => {
    it('should create embed with success formatting', () => {
      const embed = command.testCreateSuccessEmbed('Success Title', 'Success description');

      expect(embed.data.title).toBe('✅ Success Title');
      expect(embed.data.description).toBe('Success description');
      expect(embed.data.color).toBe(0x00ff00); // Green
      expect(embed.data.timestamp).toBeDefined();
    });

    it('should handle special characters in title', () => {
      const embed = command.testCreateSuccessEmbed('Test "Special" & <chars>', 'Desc');

      expect(embed.data.title).toContain('Test "Special" & <chars>');
    });
  });

  describe('createInfoEmbed()', () => {
    it('should create embed with info formatting', () => {
      const embed = command.testCreateInfoEmbed('Info Title', 'Info description');

      expect(embed.data.title).toBe('ℹ️ Info Title');
      expect(embed.data.description).toBe('Info description');
      expect(embed.data.color).toBe(0x0099ff); // Blue
      expect(embed.data.timestamp).toBeDefined();
    });

    it('should handle long descriptions', () => {
      const longDesc = 'A'.repeat(1000);
      const embed = command.testCreateInfoEmbed('Title', longDesc);

      expect(embed.data.description).toBe(longDesc);
    });
  });

  describe('handleError()', () => {
    it('should handle "Invalid input" errors with custom message', async () => {
      const interaction = createMockInteraction();
      const error = new Error('Invalid input: "xyz" is not a valid hex color');

      await command.testHandleError(interaction, error, 'test');

      const { createErrorEmbed } = await import('../../utils/embed-builder.js');
      expect(createErrorEmbed).toHaveBeenCalledWith(
        'Invalid Input',
        'Invalid input: "xyz" is not a valid hex color'
      );
    });

    it('should handle "rate limit" errors', async () => {
      const interaction = createMockInteraction();
      const error = new Error('You have hit the rate limit');

      await command.testHandleError(interaction, error, 'test');

      const { createErrorEmbed } = await import('../../utils/embed-builder.js');
      expect(createErrorEmbed).toHaveBeenCalledWith(
        'Rate Limit Exceeded',
        "You're sending commands too quickly. Please wait a moment and try again."
      );
    });

    it('should handle "permission" errors', async () => {
      const interaction = createMockInteraction();
      const error = new Error('Missing permission to access channel');

      await command.testHandleError(interaction, error, 'test');

      const { createErrorEmbed } = await import('../../utils/embed-builder.js');
      expect(createErrorEmbed).toHaveBeenCalledWith(
        'Permission Denied',
        "You don't have permission to use this command."
      );
    });

    it('should handle "Missing" permission errors', async () => {
      const interaction = createMockInteraction();
      const error = new Error('Missing Access');

      await command.testHandleError(interaction, error, 'test');

      const { createErrorEmbed } = await import('../../utils/embed-builder.js');
      expect(createErrorEmbed).toHaveBeenCalledWith(
        'Permission Denied',
        "You don't have permission to use this command."
      );
    });

    it('should handle "timeout" errors', async () => {
      const interaction = createMockInteraction();
      const error = new Error('Request timeout occurred');

      await command.testHandleError(interaction, error, 'test');

      const { createErrorEmbed } = await import('../../utils/embed-builder.js');
      expect(createErrorEmbed).toHaveBeenCalledWith(
        'Request Timeout',
        'The request took too long to process. Please try again.'
      );
    });

    it('should handle "network" errors', async () => {
      const interaction = createMockInteraction();
      const error = new Error('network connection failed');

      await command.testHandleError(interaction, error, 'test');

      const { createErrorEmbed } = await import('../../utils/embed-builder.js');
      expect(createErrorEmbed).toHaveBeenCalledWith(
        'Network Error',
        'Failed to connect to external services. Please try again later.'
      );
    });

    it('should handle "fetch" errors', async () => {
      const interaction = createMockInteraction();
      const error = new Error('fetch failed');

      await command.testHandleError(interaction, error, 'test');

      const { createErrorEmbed } = await import('../../utils/embed-builder.js');
      expect(createErrorEmbed).toHaveBeenCalledWith(
        'Network Error',
        'Failed to connect to external services. Please try again later.'
      );
    });

    it('should handle generic errors with fallback message', async () => {
      const interaction = createMockInteraction();
      const error = new Error('Some internal error');

      await command.testHandleError(interaction, error, 'test');

      const { createErrorEmbed } = await import('../../utils/embed-builder.js');
      expect(createErrorEmbed).toHaveBeenCalledWith(
        'Command Error',
        'Something went wrong. Please try again or contact support if the issue persists.'
      );
    });

    it('should handle non-Error objects', async () => {
      const interaction = createMockInteraction();
      const error = 'String error';

      await command.testHandleError(interaction, error, 'test');

      const { createErrorEmbed } = await import('../../utils/embed-builder.js');
      expect(createErrorEmbed).toHaveBeenCalledWith(
        'Command Error',
        'An unexpected error occurred while executing this command.'
      );
    });

    it('should log error when reply fails', async () => {
      const { sendEphemeralError } = await import('../../utils/response-helper.js');
      const { logger } = await import('../../utils/logger.js');

      vi.mocked(sendEphemeralError).mockRejectedValueOnce(new Error('Reply failed'));

      const interaction = createMockInteraction();
      const error = new Error('Original error');

      await command.testHandleError(interaction, error, 'test');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to send error message to user:',
        expect.any(Error)
      );
    });

    it('should log error details with stack trace', async () => {
      const { logger } = await import('../../utils/logger.js');
      const interaction = createMockInteraction();
      const error = new Error('Test error with stack');

      await command.testHandleError(interaction, error, 'test');

      expect(logger.error).toHaveBeenCalledWith(
        'Error in test:',
        expect.objectContaining({
          message: 'Test error with stack',
          stack: expect.any(String),
          name: 'Error',
        })
      );
    });
  });
});
