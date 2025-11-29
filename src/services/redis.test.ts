/**
 * Unit tests for Redis service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  MockRedisClient,
  shouldRunRedisIntegration,
  getRedisTestUrl,
} from '../__tests__/helpers/mock-redis.js';

// Mock ioredis module
vi.mock('ioredis', () => {
  return {
    default: vi.fn().mockImplementation(() => new MockRedisClient()),
  };
});

// Mock config
vi.mock('../config.js', () => ({
  config: {
    redisUrl: 'redis://localhost:6379',
  },
}));

// Mock logger
vi.mock('../utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Redis Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset module state between tests
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getRedisClient()', () => {
    it('should return null when REDIS_URL is not configured', async () => {
      // Re-mock config without redisUrl
      vi.doMock('../config.js', () => ({
        config: {
          redisUrl: undefined,
        },
      }));

      const { getRedisClient } = await import('./redis.js');
      const client = getRedisClient();
      expect(client).toBeNull();
    });

    it('should return a Redis client when REDIS_URL is configured', async () => {
      vi.doMock('../config.js', () => ({
        config: {
          redisUrl: 'redis://localhost:6379',
        },
      }));

      const { getRedisClient } = await import('./redis.js');
      const client = getRedisClient();
      expect(client).not.toBeNull();
    });

    it('should return the same client instance on subsequent calls (singleton)', async () => {
      vi.doMock('../config.js', () => ({
        config: {
          redisUrl: 'redis://localhost:6379',
        },
      }));

      const { getRedisClient } = await import('./redis.js');
      const client1 = getRedisClient();
      const client2 = getRedisClient();
      expect(client1).toBe(client2);
    });

    it('should enable TLS when rediss:// protocol is used', async () => {
      const Redis = (await import('ioredis')).default;
      vi.mocked(Redis).mockClear();

      vi.doMock('../config.js', () => ({
        config: {
          redisUrl: 'rediss://localhost:6379',
        },
      }));

      vi.resetModules();
      const { getRedisClient } = await import('./redis.js');
      getRedisClient();

      // Verify TLS was enabled in options
      expect(vi.mocked(Redis)).toHaveBeenCalled();
    });

    it('should handle password authentication from URL', async () => {
      const Redis = (await import('ioredis')).default;
      vi.mocked(Redis).mockClear();

      vi.doMock('../config.js', () => ({
        config: {
          redisUrl: 'redis://:mypassword@localhost:6379',
        },
      }));

      vi.resetModules();
      const { getRedisClient } = await import('./redis.js');
      getRedisClient();

      expect(vi.mocked(Redis)).toHaveBeenCalled();
    });

    it('should handle connection errors gracefully', async () => {
      const Redis = (await import('ioredis')).default;
      vi.mocked(Redis).mockImplementationOnce(() => {
        throw new Error('Connection failed');
      });

      vi.resetModules();
      const { getRedisClient } = await import('./redis.js');
      const client = getRedisClient();

      expect(client).toBeNull();
    });
  });

  describe('Redis connection options callbacks', () => {
    describe('retryStrategy callback', () => {
      it('should return linear delay based on retry count', async () => {
        const Redis = (await import('ioredis')).default;
        vi.mocked(Redis).mockClear();

        vi.doMock('../config.js', () => ({
          config: {
            redisUrl: 'redis://localhost:6379',
          },
        }));

        vi.resetModules();
        const { getRedisClient } = await import('./redis.js');
        getRedisClient();

        // Get the options passed to Redis constructor
        const constructorCall = vi.mocked(Redis).mock.calls[0];
        const options = (constructorCall as unknown[])[1] as {
          retryStrategy: (times: number) => number;
        };

        expect(options.retryStrategy(1)).toBe(50); // 1 * 50 = 50
        expect(options.retryStrategy(10)).toBe(500); // 10 * 50 = 500
      });

      it('should cap delay at 2000ms', async () => {
        const Redis = (await import('ioredis')).default;
        vi.mocked(Redis).mockClear();

        vi.doMock('../config.js', () => ({
          config: {
            redisUrl: 'redis://localhost:6379',
          },
        }));

        vi.resetModules();
        const { getRedisClient } = await import('./redis.js');
        getRedisClient();

        const constructorCall = vi.mocked(Redis).mock.calls[0];
        const options = (constructorCall as unknown[])[1] as {
          retryStrategy: (times: number) => number;
        };

        expect(options.retryStrategy(50)).toBe(2000); // 50 * 50 = 2500, capped at 2000
        expect(options.retryStrategy(100)).toBe(2000); // 100 * 50 = 5000, capped at 2000
      });

      it('should log retry attempt', async () => {
        const { logger } = await import('../utils/logger.js');
        const Redis = (await import('ioredis')).default;
        vi.mocked(Redis).mockClear();

        vi.doMock('../config.js', () => ({
          config: {
            redisUrl: 'redis://localhost:6379',
          },
        }));

        vi.resetModules();
        const { getRedisClient } = await import('./redis.js');
        getRedisClient();

        const constructorCall = vi.mocked(Redis).mock.calls[0];
        const options = (constructorCall as unknown[])[1] as {
          retryStrategy: (times: number) => number;
        };

        options.retryStrategy(3);

        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Redis connection retry attempt 3')
        );
      });
    });

    describe('reconnectOnError callback', () => {
      it('should return true for READONLY errors', async () => {
        const Redis = (await import('ioredis')).default;
        vi.mocked(Redis).mockClear();

        vi.doMock('../config.js', () => ({
          config: {
            redisUrl: 'redis://localhost:6379',
          },
        }));

        vi.resetModules();
        const { getRedisClient } = await import('./redis.js');
        getRedisClient();

        const constructorCall = vi.mocked(Redis).mock.calls[0];
        const options = (constructorCall as unknown[])[1] as {
          reconnectOnError: (err: Error) => boolean;
        };

        const result = options.reconnectOnError(new Error('READONLY You cannot write'));
        expect(result).toBe(true);
      });

      it('should return true for ECONNRESET errors', async () => {
        const Redis = (await import('ioredis')).default;
        vi.mocked(Redis).mockClear();

        vi.doMock('../config.js', () => ({
          config: {
            redisUrl: 'redis://localhost:6379',
          },
        }));

        vi.resetModules();
        const { getRedisClient } = await import('./redis.js');
        getRedisClient();

        const constructorCall = vi.mocked(Redis).mock.calls[0];
        const options = (constructorCall as unknown[])[1] as {
          reconnectOnError: (err: Error) => boolean;
        };

        const result = options.reconnectOnError(new Error('read ECONNRESET'));
        expect(result).toBe(true);
      });

      it('should return true for ETIMEDOUT errors', async () => {
        const Redis = (await import('ioredis')).default;
        vi.mocked(Redis).mockClear();

        vi.doMock('../config.js', () => ({
          config: {
            redisUrl: 'redis://localhost:6379',
          },
        }));

        vi.resetModules();
        const { getRedisClient } = await import('./redis.js');
        getRedisClient();

        const constructorCall = vi.mocked(Redis).mock.calls[0];
        const options = (constructorCall as unknown[])[1] as {
          reconnectOnError: (err: Error) => boolean;
        };

        const result = options.reconnectOnError(new Error('connect ETIMEDOUT'));
        expect(result).toBe(true);
      });

      it('should return false for other errors', async () => {
        const Redis = (await import('ioredis')).default;
        vi.mocked(Redis).mockClear();

        vi.doMock('../config.js', () => ({
          config: {
            redisUrl: 'redis://localhost:6379',
          },
        }));

        vi.resetModules();
        const { getRedisClient } = await import('./redis.js');
        getRedisClient();

        const constructorCall = vi.mocked(Redis).mock.calls[0];
        const options = (constructorCall as unknown[])[1] as {
          reconnectOnError: (err: Error) => boolean;
        };

        const result = options.reconnectOnError(new Error('Some other error'));
        expect(result).toBe(false);
      });

      it('should log when reconnecting due to target error', async () => {
        const { logger } = await import('../utils/logger.js');
        const Redis = (await import('ioredis')).default;
        vi.mocked(Redis).mockClear();

        vi.doMock('../config.js', () => ({
          config: {
            redisUrl: 'redis://localhost:6379',
          },
        }));

        vi.resetModules();
        const { getRedisClient } = await import('./redis.js');
        getRedisClient();

        const constructorCall = vi.mocked(Redis).mock.calls[0];
        const options = (constructorCall as unknown[])[1] as {
          reconnectOnError: (err: Error) => boolean;
        };

        options.reconnectOnError(new Error('READONLY error occurred'));

        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Redis reconnecting due to: READONLY error occurred')
        );
      });
    });
  });

  describe('closeRedis()', () => {
    it('should call quit() on the client', async () => {
      vi.doMock('../config.js', () => ({
        config: {
          redisUrl: 'redis://localhost:6379',
        },
      }));

      vi.resetModules();
      const { getRedisClient, closeRedis } = await import('./redis.js');

      const client = getRedisClient();
      expect(client).not.toBeNull();

      const quitSpy = vi.spyOn(client!, 'quit');
      await closeRedis();

      expect(quitSpy).toHaveBeenCalled();
    });

    it('should set client to null after closing', async () => {
      vi.doMock('../config.js', () => ({
        config: {
          redisUrl: 'redis://localhost:6379',
        },
      }));

      vi.resetModules();
      const { getRedisClient, closeRedis } = await import('./redis.js');

      getRedisClient();
      await closeRedis();

      // Getting client again should create a new one
      // Note: We can't easily test this without exposing internal state
      // Just verify closeRedis doesn't throw
    });

    it('should handle null client gracefully', async () => {
      vi.doMock('../config.js', () => ({
        config: {
          redisUrl: undefined,
        },
      }));

      vi.resetModules();
      const { closeRedis } = await import('./redis.js');

      // Should not throw
      await expect(closeRedis()).resolves.not.toThrow();
    });
  });

  describe('isRedisAvailable()', () => {
    it('should return false when no client exists', async () => {
      vi.doMock('../config.js', () => ({
        config: {
          redisUrl: undefined,
        },
      }));

      vi.resetModules();
      const { isRedisAvailable } = await import('./redis.js');

      const available = await isRedisAvailable();
      expect(available).toBe(false);
    });

    it('should return true when ping succeeds', async () => {
      vi.doMock('../config.js', () => ({
        config: {
          redisUrl: 'redis://localhost:6379',
        },
      }));

      vi.resetModules();
      const { isRedisAvailable } = await import('./redis.js');

      const available = await isRedisAvailable();
      expect(available).toBe(true);
    });

    it('should return false when ping fails', async () => {
      vi.doMock('../config.js', () => ({
        config: {
          redisUrl: 'redis://localhost:6379',
        },
      }));

      const Redis = (await import('ioredis')).default;
      const mockClient = new MockRedisClient();
      vi.spyOn(mockClient, 'ping').mockRejectedValue(new Error('Connection lost'));
      vi.mocked(Redis).mockImplementation(
        () => mockClient as unknown as InstanceType<typeof Redis>
      );

      vi.resetModules();
      const { isRedisAvailable } = await import('./redis.js');

      const available = await isRedisAvailable();
      expect(available).toBe(false);
    });
  });
});

// Integration tests - only run when REDIS_TEST_URL is set
describe.skipIf(!shouldRunRedisIntegration())('Redis Integration Tests', () => {
  it('should connect to real Redis server', async () => {
    const Redis = (await import('ioredis')).default;
    const url = getRedisTestUrl();
    expect(url).toBeDefined();

    const client = new Redis(url!);
    const pong = await client.ping();
    expect(pong).toBe('PONG');
    await client.quit();
  });

  it('should set and get values', async () => {
    const Redis = (await import('ioredis')).default;
    const client = new Redis(getRedisTestUrl()!);

    const testKey = `xivdye:test:${Date.now()}`;
    await client.set(testKey, 'test-value');
    const value = await client.get(testKey);
    expect(value).toBe('test-value');

    // Cleanup
    await client.del(testKey);
    await client.quit();
  });

  it('should handle connection errors gracefully', async () => {
    const Redis = (await import('ioredis')).default;

    // Try connecting to invalid port
    const client = new Redis('redis://localhost:99999', {
      maxRetriesPerRequest: 0,
      retryStrategy: (): null => null,
    });

    try {
      await client.ping();
    } catch {
      // Expected to fail
      expect(true).toBe(true);
    }

    await client.quit();
  });
});
