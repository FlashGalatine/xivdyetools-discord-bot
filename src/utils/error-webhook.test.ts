/**
 * Unit tests for Error Webhook utility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock logger
vi.mock('./logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock Discord.js WebhookClient
const mockSend = vi.fn().mockResolvedValue(undefined);
const mockDestroy = vi.fn();

vi.mock('discord.js', async () => {
  const actual = await vi.importActual<typeof import('discord.js')>('discord.js');
  return {
    ...actual,
    WebhookClient: vi.fn().mockImplementation(() => ({
      send: mockSend,
      destroy: mockDestroy,
    })),
  };
});

describe('Error Webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initErrorWebhook', () => {
    it('should create WebhookClient with valid URL', async () => {
      const { WebhookClient } = await import('discord.js');
      const { initErrorWebhook } = await import('./error-webhook.js');

      initErrorWebhook('https://discord.com/api/webhooks/123/abc');

      expect(WebhookClient).toHaveBeenCalledWith({
        url: 'https://discord.com/api/webhooks/123/abc',
      });
    });

    it('should handle invalid URL gracefully', async () => {
      const { WebhookClient } = await import('discord.js');
      const { logger } = await import('./logger.js');
      vi.mocked(WebhookClient).mockImplementationOnce(() => {
        throw new Error('Invalid webhook URL');
      });

      const { initErrorWebhook } = await import('./error-webhook.js');
      initErrorWebhook('invalid-url');

      expect(logger.warn).toHaveBeenCalled();
    });

    it('should log when URL not configured', async () => {
      const { logger } = await import('./logger.js');
      const { initErrorWebhook } = await import('./error-webhook.js');

      initErrorWebhook(undefined);

      expect(logger.info).toHaveBeenCalledWith(
        'Error webhook not configured (ERROR_WEBHOOK_URL not set)'
      );
    });
  });

  describe('notifyError', () => {
    it('should do nothing when webhook not initialized', async () => {
      vi.resetModules();
      // Don't initialize webhook
      const { notifyError } = await import('./error-webhook.js');

      await notifyError(new Error('Test error'), 'Test context');

      expect(mockSend).not.toHaveBeenCalled();
    });

    it('should send embed with error message', async () => {
      vi.resetModules();
      const { initErrorWebhook, notifyError } = await import('./error-webhook.js');

      initErrorWebhook('https://discord.com/api/webhooks/123/abc');

      await notifyError(new Error('Test error message'), 'Command: /harmony');

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              data: expect.objectContaining({
                title: '🚨 Bot Error',
              }),
            }),
          ]),
        })
      );
    });

    it('should include error context', async () => {
      vi.resetModules();
      const { initErrorWebhook, notifyError } = await import('./error-webhook.js');

      initErrorWebhook('https://discord.com/api/webhooks/123/abc');

      await notifyError(new Error('Database error'), 'Analytics tracking');

      expect(mockSend).toHaveBeenCalled();
      const call = mockSend.mock.calls[0][0];
      const embed = call.embeds[0];
      const contextField = embed.data.fields.find((f: any) => f.name === 'Context');
      expect(contextField.value).toBe('Analytics tracking');
    });

    it('should include truncated stack trace', async () => {
      vi.resetModules();
      const { initErrorWebhook, notifyError } = await import('./error-webhook.js');

      initErrorWebhook('https://discord.com/api/webhooks/123/abc');

      const error = new Error('Stack trace test');
      error.stack = 'Error: Stack trace test\n    at Object.<anonymous>\n    at Module._compile';

      await notifyError(error, 'Test');

      expect(mockSend).toHaveBeenCalled();
      const call = mockSend.mock.calls[0][0];
      const embed = call.embeds[0];
      const stackField = embed.data.fields.find((f: any) => f.name === 'Stack Trace');
      expect(stackField).toBeDefined();
      expect(stackField.value).toContain('Stack trace test');
    });

    it('should handle webhook send errors', async () => {
      vi.resetModules();
      mockSend.mockRejectedValueOnce(new Error('Webhook failed'));

      const { initErrorWebhook, notifyError } = await import('./error-webhook.js');
      const { logger } = await import('./logger.js');

      initErrorWebhook('https://discord.com/api/webhooks/123/abc');

      // Should not throw
      await expect(notifyError(new Error('Test'), 'Context')).resolves.not.toThrow();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('closeErrorWebhook', () => {
    it('should destroy webhook client', async () => {
      vi.resetModules();
      const { initErrorWebhook, closeErrorWebhook } = await import('./error-webhook.js');

      initErrorWebhook('https://discord.com/api/webhooks/123/abc');
      closeErrorWebhook();

      expect(mockDestroy).toHaveBeenCalled();
    });

    it('should handle null client gracefully', async () => {
      vi.resetModules();
      const { closeErrorWebhook } = await import('./error-webhook.js');

      // Should not throw
      expect(() => closeErrorWebhook()).not.toThrow();
    });
  });
});
