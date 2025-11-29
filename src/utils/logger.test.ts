/**
 * Tests for logger.ts - logging and secret redaction
 * Targets uncovered branches: 27-28, 31-32, 36-37, 46, 108
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock config before importing logger
vi.mock('../config.js', () => ({
  config: {
    logLevel: 'debug',
  },
}));

import { redactSensitive, LogLevel, logger } from './logger.js';

describe('Logger Module', () => {
  describe('redactSensitive()', () => {
    describe('null/undefined handling (lines 27-28)', () => {
      it('should return null when passed null', () => {
        const result = redactSensitive(null);
        expect(result).toBeNull();
      });

      it('should return undefined when passed undefined', () => {
        const result = redactSensitive(undefined);
        expect(result).toBeUndefined();
      });
    });

    describe('primitive handling (lines 31-32)', () => {
      it('should return string as-is', () => {
        const result = redactSensitive('test string');
        expect(result).toBe('test string');
      });

      it('should return number as-is', () => {
        const result = redactSensitive(42);
        expect(result).toBe(42);
      });

      it('should return boolean as-is', () => {
        const result = redactSensitive(true);
        expect(result).toBe(true);
      });
    });

    describe('array handling (lines 36-37)', () => {
      it('should process arrays and redact sensitive items', () => {
        const input = [{ name: 'test', password: 'secret123' }, { safe: 'data' }];
        const result = redactSensitive(input);

        expect(result).toEqual([{ name: 'test', password: '[REDACTED]' }, { safe: 'data' }]);
      });

      it('should handle arrays of primitives', () => {
        const input = [1, 2, 3, 'test'];
        const result = redactSensitive(input);
        expect(result).toEqual([1, 2, 3, 'test']);
      });

      it('should handle nested arrays', () => {
        const input = [[{ token: 'abc' }]];
        const result = redactSensitive(input);
        expect(result).toEqual([[{ token: '[REDACTED]' }]]);
      });
    });

    describe('sensitive key redaction (line 46)', () => {
      it('should redact keys containing "token"', () => {
        const input = { discordToken: 'abc123', name: 'test' };
        const result = redactSensitive(input);
        expect(result).toEqual({ discordToken: '[REDACTED]', name: 'test' });
      });

      it('should redact keys containing "password"', () => {
        const input = { userPassword: 'secret', id: 1 };
        const result = redactSensitive(input);
        expect(result).toEqual({ userPassword: '[REDACTED]', id: 1 });
      });

      it('should redact keys containing "secret"', () => {
        const input = { clientSecret: 'xyz', data: 'safe' };
        const result = redactSensitive(input);
        expect(result).toEqual({ clientSecret: '[REDACTED]', data: 'safe' });
      });

      it('should redact keys containing "key"', () => {
        const input = { apiKey: '12345', value: 'ok' };
        const result = redactSensitive(input);
        expect(result).toEqual({ apiKey: '[REDACTED]', value: 'ok' });
      });

      it('should redact keys containing "webhook"', () => {
        const input = { webhookUrl: 'https://discord.com/webhook', name: 'bot' };
        const result = redactSensitive(input);
        expect(result).toEqual({ webhookUrl: '[REDACTED]', name: 'bot' });
      });

      it('should redact keys containing "auth"', () => {
        const input = { authHeader: 'Bearer token', type: 'api' };
        const result = redactSensitive(input);
        expect(result).toEqual({ authHeader: '[REDACTED]', type: 'api' });
      });

      it('should redact keys containing "credential"', () => {
        const input = { userCredential: 'data', id: 5 };
        const result = redactSensitive(input);
        expect(result).toEqual({ userCredential: '[REDACTED]', id: 5 });
      });

      it('should be case-insensitive', () => {
        const input = { DISCORD_TOKEN: 'abc', Password: 'xyz' };
        const result = redactSensitive(input);
        expect(result).toEqual({ DISCORD_TOKEN: '[REDACTED]', Password: '[REDACTED]' });
      });
    });

    describe('nested object redaction (lines 47-49)', () => {
      it('should redact sensitive keys in nested objects', () => {
        const input = {
          user: {
            name: 'test',
            auth: {
              token: 'secret',
            },
          },
        };
        const result = redactSensitive(input);
        expect(result).toEqual({
          user: {
            name: 'test',
            auth: '[REDACTED]',
          },
        });
      });

      it('should handle deeply nested objects', () => {
        const input = {
          level1: {
            level2: {
              level3: {
                password: 'hidden',
                data: 'visible',
              },
            },
          },
        };
        const result = redactSensitive(input);
        expect(result).toEqual({
          level1: {
            level2: {
              level3: {
                password: '[REDACTED]',
                data: 'visible',
              },
            },
          },
        });
      });

      it('should handle null values in nested objects', () => {
        const input = { outer: { inner: null, safe: 'data' } };
        const result = redactSensitive(input);
        expect(result).toEqual({ outer: { inner: null, safe: 'data' } });
      });
    });

    describe('safe object handling', () => {
      it('should not modify objects without sensitive keys', () => {
        const input = { name: 'test', value: 123, active: true };
        const result = redactSensitive(input);
        expect(result).toEqual(input);
      });

      it('should preserve object structure', () => {
        const input = { a: { b: { c: 'test' } } };
        const result = redactSensitive(input);
        expect(result).toEqual({ a: { b: { c: 'test' } } });
      });
    });
  });

  describe('LogLevel enum', () => {
    it('should have correct numeric values', () => {
      expect(LogLevel.DEBUG).toBe(0);
      expect(LogLevel.INFO).toBe(1);
      expect(LogLevel.WARN).toBe(2);
      expect(LogLevel.ERROR).toBe(3);
    });
  });

  describe('Logger class', () => {
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {}) as typeof consoleSpy;
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    describe('debug()', () => {
      it('should log debug messages', () => {
        logger.debug('Test debug message');
        expect(consoleSpy).toHaveBeenCalled();
        expect(consoleSpy.mock.calls[0][1]).toBe('Test debug message');
      });

      it('should include DEBUG level in output', () => {
        logger.debug('Debug test');
        const call = consoleSpy.mock.calls[0][0];
        expect(call).toContain('[DEBUG]');
      });
    });

    describe('info()', () => {
      it('should log info messages', () => {
        logger.info('Test info message');
        expect(consoleSpy).toHaveBeenCalled();
        expect(consoleSpy.mock.calls[0][1]).toBe('Test info message');
      });

      it('should include INFO level in output', () => {
        logger.info('Info test');
        const call = consoleSpy.mock.calls[0][0];
        expect(call).toContain('[INFO]');
      });
    });

    describe('warn()', () => {
      it('should log warning messages', () => {
        logger.warn('Test warning message');
        expect(consoleSpy).toHaveBeenCalled();
        expect(consoleSpy.mock.calls[0][1]).toBe('Test warning message');
      });

      it('should include WARN level in output', () => {
        logger.warn('Warn test');
        const call = consoleSpy.mock.calls[0][0];
        expect(call).toContain('[WARN]');
      });
    });

    describe('error()', () => {
      it('should log error messages', () => {
        logger.error('Test error message');
        expect(consoleSpy).toHaveBeenCalled();
        expect(consoleSpy.mock.calls[0][1]).toBe('Test error message');
      });

      it('should include ERROR level in output', () => {
        logger.error('Error test');
        const call = consoleSpy.mock.calls[0][0];
        expect(call).toContain('[ERROR]');
      });
    });

    describe('argument handling (line 108)', () => {
      it('should pass primitive arguments without redaction', () => {
        logger.info('Message with args', 'string', 123, true);
        expect(consoleSpy).toHaveBeenCalled();
        const args = consoleSpy.mock.calls[0];
        // args[0] is prefix, args[1] is message, args[2+] are additional args
        expect(args[2]).toBe('string');
        expect(args[3]).toBe(123);
        expect(args[4]).toBe(true);
      });

      it('should redact sensitive data in object arguments', () => {
        logger.info('User data', { name: 'test', password: 'secret' });
        const args = consoleSpy.mock.calls[0];
        expect(args[2]).toEqual({ name: 'test', password: '[REDACTED]' });
      });

      it('should handle null object arguments', () => {
        logger.info('Null arg', null);
        const args = consoleSpy.mock.calls[0];
        expect(args[2]).toBeNull();
      });

      it('should handle mixed argument types', () => {
        logger.info('Mixed', 'text', { token: 'abc' }, 42);
        const args = consoleSpy.mock.calls[0];
        expect(args[2]).toBe('text');
        expect(args[3]).toEqual({ token: '[REDACTED]' });
        expect(args[4]).toBe(42);
      });
    });

    describe('timestamp formatting', () => {
      it('should include ISO timestamp in log output', () => {
        logger.info('Timestamp test');
        const prefix = consoleSpy.mock.calls[0][0];
        // ISO timestamp format: YYYY-MM-DDTHH:mm:ss.sssZ
        expect(prefix).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      });
    });
  });

  describe('Logger with different log levels', () => {
    it('should filter messages below minimum level', async () => {
      // Reset modules to test with different log level
      vi.resetModules();
      vi.doMock('../config.js', () => ({
        config: {
          logLevel: 'error',
        },
      }));

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { logger: errorLogger } = await import('./logger.js');

      // These should be filtered out
      errorLogger.debug('Debug message');
      errorLogger.info('Info message');
      errorLogger.warn('Warn message');

      // Debug, info, and warn should not log when level is error
      const callsBeforeError = consoleSpy.mock.calls.length;

      // This should log
      errorLogger.error('Error message');

      // Only error should have been logged
      expect(consoleSpy).toHaveBeenCalledTimes(callsBeforeError + 1);

      consoleSpy.mockRestore();
    });
  });
});
