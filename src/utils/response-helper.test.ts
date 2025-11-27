/**
 * Unit tests for Response Helper utility
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockInteraction } from '../__tests__/helpers/mock-interaction.js';
import { MessageFlags } from 'discord.js';

describe('Response Helper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sendPublicSuccess', () => {
    it('should call editReply with provided options', async () => {
      const { sendPublicSuccess } = await import('./response-helper.js');
      const interaction = createMockInteraction({ deferred: true });

      const response = {
        content: 'Success message',
      };

      await sendPublicSuccess(interaction, response);

      expect(interaction.editReply).toHaveBeenCalledWith(response);
    });

    it('should preserve all response fields', async () => {
      const { sendPublicSuccess } = await import('./response-helper.js');
      const interaction = createMockInteraction({ deferred: true });

      const response = {
        content: 'Success',
        embeds: [{ data: { title: 'Test' } }],
        files: [{ name: 'test.png', attachment: Buffer.from('test') }],
      };

      await sendPublicSuccess(interaction, response as any);

      expect(interaction.editReply).toHaveBeenCalledWith(response);
    });

    it('should handle interaction with embeds', async () => {
      const { sendPublicSuccess } = await import('./response-helper.js');
      const interaction = createMockInteraction({ deferred: true });

      const response = {
        embeds: [{ data: { title: 'Embed Title', description: 'Embed description' } }],
      };

      await sendPublicSuccess(interaction, response as any);

      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              data: expect.objectContaining({ title: 'Embed Title' }),
            }),
          ]),
        })
      );
    });

    it('should handle interaction with files', async () => {
      const { sendPublicSuccess } = await import('./response-helper.js');
      const interaction = createMockInteraction({ deferred: true });

      const response = {
        files: [{ name: 'image.png', attachment: Buffer.from([0x89, 0x50, 0x4e, 0x47]) }],
      };

      await sendPublicSuccess(interaction, response as any);

      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          files: expect.any(Array),
        })
      );
    });
  });

  describe('sendEphemeralError', () => {
    it('should use followUp when deferred', async () => {
      const { sendEphemeralError } = await import('./response-helper.js');
      const interaction = createMockInteraction({ deferred: true });

      const response = {
        content: 'Error message',
      };

      await sendEphemeralError(interaction, response);

      expect(interaction.followUp).toHaveBeenCalled();
      expect(interaction.reply).not.toHaveBeenCalled();
    });

    it('should use reply when not deferred', async () => {
      const { sendEphemeralError } = await import('./response-helper.js');
      const interaction = createMockInteraction({ deferred: false });

      const response = {
        content: 'Error message',
      };

      await sendEphemeralError(interaction, response);

      expect(interaction.reply).toHaveBeenCalled();
      expect(interaction.followUp).not.toHaveBeenCalled();
    });

    it('should set Ephemeral flag when deferred', async () => {
      const { sendEphemeralError } = await import('./response-helper.js');
      const interaction = createMockInteraction({ deferred: true });

      const response = {
        content: 'Error message',
      };

      await sendEphemeralError(interaction, response);

      expect(interaction.followUp).toHaveBeenCalledWith(
        expect.objectContaining({
          flags: MessageFlags.Ephemeral,
        })
      );
    });

    it('should set Ephemeral flag when not deferred', async () => {
      const { sendEphemeralError } = await import('./response-helper.js');
      const interaction = createMockInteraction({ deferred: false });

      const response = {
        content: 'Error message',
      };

      await sendEphemeralError(interaction, response);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          flags: MessageFlags.Ephemeral,
        })
      );
    });

    it('should preserve embed content', async () => {
      const { sendEphemeralError } = await import('./response-helper.js');
      const interaction = createMockInteraction({ deferred: true });

      const response = {
        embeds: [{ data: { title: '❌ Error', description: 'Something went wrong' } }],
      };

      await sendEphemeralError(interaction, response as any);

      expect(interaction.followUp).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.any(Array),
          flags: MessageFlags.Ephemeral,
        })
      );
    });
  });
});
