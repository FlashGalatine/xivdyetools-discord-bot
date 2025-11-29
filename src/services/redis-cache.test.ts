/**
 * Unit tests for Redis cache service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MockRedisClient } from '../__tests__/helpers/mock-redis.js';
import type { CachedData } from 'xivdyetools-core';

// Helper to create valid CachedData for tests
function createTestData<T>(data: T, ttl: number = 300): CachedData<T> {
  return { data, timestamp: Date.now(), ttl };
}

// Mock logger
vi.mock('../utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Create a mock Redis client that will be shared
let mockRedisClient: MockRedisClient | null = null;

// Mock the redis module
vi.mock('./redis.js', () => ({
  getRedisClient: () => mockRedisClient,
}));

describe('Redis Cache Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('CACHE_TTL_BY_COMMAND', () => {
    it('should have correct TTL for harmony command (3600s)', async () => {
      const { CACHE_TTL_BY_COMMAND } = await import('./redis-cache.js');
      expect(CACHE_TTL_BY_COMMAND.harmony).toBe(3600);
    });

    it('should have correct TTL for match command (1800s)', async () => {
      const { CACHE_TTL_BY_COMMAND } = await import('./redis-cache.js');
      expect(CACHE_TTL_BY_COMMAND.match).toBe(1800);
    });

    it('should have correct TTL for mixer command (300s)', async () => {
      const { CACHE_TTL_BY_COMMAND } = await import('./redis-cache.js');
      expect(CACHE_TTL_BY_COMMAND.mixer).toBe(300);
    });

    it('should have correct TTL for stats command (86400s)', async () => {
      const { CACHE_TTL_BY_COMMAND } = await import('./redis-cache.js');
      expect(CACHE_TTL_BY_COMMAND.stats).toBe(86400);
    });

    it('should have correct default TTL (300s)', async () => {
      const { CACHE_TTL_BY_COMMAND } = await import('./redis-cache.js');
      expect(CACHE_TTL_BY_COMMAND.default).toBe(300);
    });
  });

  describe('RedisCacheBackend with Redis', () => {
    beforeEach(() => {
      // Enable Redis mock
      mockRedisClient = new MockRedisClient();
      // Add setex method to mock
      (mockRedisClient as any).setex = vi.fn(async (key: string, ttl: number, value: string) => {
        await mockRedisClient!.set(key, value, 'EX', ttl);
        return 'OK';
      });
      vi.resetModules();
    });

    afterEach(() => {
      mockRedisClient = null;
    });

    it('should return null for non-existent key', async () => {
      const { RedisCacheBackend } = await import('./redis-cache.js');
      const cache = new RedisCacheBackend();

      const result = await cache.get('non-existent-key');
      expect(result).toBeNull();
    });

    it('should return cached data when key exists', async () => {
      const { RedisCacheBackend } = await import('./redis-cache.js');
      const cache = new RedisCacheBackend();

      const testData = { data: 'test-value', timestamp: Date.now() };
      await mockRedisClient!.set('test-key', JSON.stringify(testData));

      const result = await cache.get('test-key');
      expect(result).toEqual(testData);
    });

    it('should set value with command-specific TTL for harmony', async () => {
      const { RedisCacheBackend } = await import('./redis-cache.js');
      const cache = new RedisCacheBackend();

      const testData = createTestData('harmony-result', 3600);
      await cache.set('harmony-key', testData, 'harmony');

      expect((mockRedisClient as any).setex).toHaveBeenCalledWith(
        'harmony-key',
        3600,
        JSON.stringify(testData)
      );
    });

    it('should set value with command-specific TTL for match', async () => {
      const { RedisCacheBackend } = await import('./redis-cache.js');
      const cache = new RedisCacheBackend();

      const testData = createTestData('match-result', 1800);
      await cache.set('match-key', testData, 'match');

      expect((mockRedisClient as any).setex).toHaveBeenCalledWith(
        'match-key',
        1800,
        JSON.stringify(testData)
      );
    });

    it('should set value with default TTL when no command specified', async () => {
      const { RedisCacheBackend } = await import('./redis-cache.js');
      const cache = new RedisCacheBackend();

      const testData = createTestData('default-result');
      await cache.set('default-key', testData);

      expect((mockRedisClient as any).setex).toHaveBeenCalledWith(
        'default-key',
        300,
        JSON.stringify(testData)
      );
    });

    it('should delete key from Redis', async () => {
      const { RedisCacheBackend } = await import('./redis-cache.js');
      const cache = new RedisCacheBackend();

      await mockRedisClient!.set('delete-key', 'value');
      await cache.delete('delete-key');

      const result = await mockRedisClient!.get('delete-key');
      expect(result).toBeNull();
    });

    it('should return true when key exists', async () => {
      const { RedisCacheBackend } = await import('./redis-cache.js');
      const cache = new RedisCacheBackend();

      await mockRedisClient!.set('exists-key', 'value');
      const exists = await cache.has('exists-key');

      expect(exists).toBe(true);
    });

    it('should return false when key does not exist', async () => {
      const { RedisCacheBackend } = await import('./redis-cache.js');
      const cache = new RedisCacheBackend();

      const exists = await cache.has('non-existent-key');
      expect(exists).toBe(false);
    });

    it('should clear only xivdye:* keys', async () => {
      const { RedisCacheBackend } = await import('./redis-cache.js');
      const cache = new RedisCacheBackend();

      await mockRedisClient!.set('xivdye:cache1', 'value1');
      await mockRedisClient!.set('xivdye:cache2', 'value2');
      await mockRedisClient!.set('other:key', 'value3');

      await cache.clear();

      const xivdyeKey1 = await mockRedisClient!.get('xivdye:cache1');
      const xivdyeKey2 = await mockRedisClient!.get('xivdye:cache2');
      const otherKey = await mockRedisClient!.get('other:key');

      expect(xivdyeKey1).toBeNull();
      expect(xivdyeKey2).toBeNull();
      expect(otherKey).toBe('value3');
    });
  });

  describe('RedisCacheBackend with Memory Fallback', () => {
    beforeEach(() => {
      // Disable Redis mock (fallback to memory)
      mockRedisClient = null;
      vi.resetModules();
    });

    it('should return undefined for missing keys in memory cache', async () => {
      const { RedisCacheBackend } = await import('./redis-cache.js');
      const cache = new RedisCacheBackend();

      const result = await cache.get('non-existent');
      expect(result).toBeNull();
    });

    it('should store and retrieve data from memory cache', async () => {
      const { RedisCacheBackend } = await import('./redis-cache.js');
      const cache = new RedisCacheBackend();

      const testData = createTestData('memory-value');
      await cache.set('memory-key', testData);

      const result = await cache.get('memory-key');
      expect(result).toBeDefined();
      expect(result?.data).toBe('memory-value');
    });

    it('should delete data from memory cache', async () => {
      const { RedisCacheBackend } = await import('./redis-cache.js');
      const cache = new RedisCacheBackend();

      await cache.set('delete-key', createTestData('value'));
      await cache.delete('delete-key');

      const result = await cache.get('delete-key');
      expect(result).toBeNull();
    });

    it('should clear all data from memory cache', async () => {
      const { RedisCacheBackend } = await import('./redis-cache.js');
      const cache = new RedisCacheBackend();

      await cache.set('key1', createTestData('value1'));
      await cache.set('key2', createTestData('value2'));
      await cache.clear();

      const result1 = await cache.get('key1');
      const result2 = await cache.get('key2');
      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });

    it('should check if key exists in memory cache', async () => {
      const { RedisCacheBackend } = await import('./redis-cache.js');
      const cache = new RedisCacheBackend();

      await cache.set('exists-key', createTestData('value'));

      const exists = await cache.has('exists-key');
      const notExists = await cache.has('not-exists');

      expect(exists).toBe(true);
      expect(notExists).toBe(false);
    });

    it('should evict oldest entry when at max capacity (500)', async () => {
      const { RedisCacheBackend } = await import('./redis-cache.js');
      const cache = new RedisCacheBackend();

      // Fill cache to capacity
      for (let i = 0; i < 500; i++) {
        await cache.set(`key-${i}`, createTestData(`value-${i}`));
      }

      // Add one more - should evict key-0
      await cache.set('key-500', createTestData('value-500'));

      const evicted = await cache.get('key-0');
      const newest = await cache.get('key-500');

      expect(evicted).toBeNull();
      expect(newest).toBeDefined();
    });

    it('should return data for non-expired entries on get', async () => {
      const { RedisCacheBackend } = await import('./redis-cache.js');
      const cache = new RedisCacheBackend();

      // Set data with default TTL (will have future expiry)
      await cache.set('valid-key', createTestData('value'));

      const result = await cache.get('valid-key');
      expect(result).toBeDefined();
      expect(result?.data).toBe('value');
    });

    it('should return true for non-expired entries on has check', async () => {
      const { RedisCacheBackend } = await import('./redis-cache.js');
      const cache = new RedisCacheBackend();

      // Set data with default TTL (will have future expiry)
      await cache.set('valid-key', createTestData('value'));

      const exists = await cache.has('valid-key');
      expect(exists).toBe(true);
    });
  });

  describe('keys() method', () => {
    describe('with Redis', () => {
      beforeEach(() => {
        mockRedisClient = new MockRedisClient();
        (mockRedisClient as any).setex = vi.fn(async (key: string, ttl: number, value: string) => {
          await mockRedisClient!.set(key, value, 'EX', ttl);
          return 'OK';
        });
        vi.resetModules();
      });

      afterEach(() => {
        mockRedisClient = null;
      });

      it('should return all keys from Redis', async () => {
        const { RedisCacheBackend } = await import('./redis-cache.js');
        const cache = new RedisCacheBackend();

        await mockRedisClient!.set('key1', 'value1');
        await mockRedisClient!.set('key2', 'value2');

        const keys = await cache.keys();
        expect(keys).toContain('key1');
        expect(keys).toContain('key2');
      });
    });

    describe('with memory fallback', () => {
      beforeEach(() => {
        mockRedisClient = null;
        vi.resetModules();
      });

      it('should return empty array for memory cache (documented limitation)', async () => {
        const { RedisCacheBackend } = await import('./redis-cache.js');
        const cache = new RedisCacheBackend();

        // Add some data to memory cache
        await cache.set('key1', createTestData('value1'));
        await cache.set('key2', createTestData('value2'));

        // keys() returns [] for memory cache (limitation documented in source)
        const keys = await cache.keys();
        expect(keys).toEqual([]);
      });
    });

    describe('error handling', () => {
      it('should return empty array on Redis keys() error', async () => {
        mockRedisClient = new MockRedisClient();
        vi.spyOn(mockRedisClient, 'keys').mockRejectedValue(new Error('Redis error'));
        vi.resetModules();

        const { RedisCacheBackend } = await import('./redis-cache.js');
        const cache = new RedisCacheBackend();

        const keys = await cache.keys();
        expect(keys).toEqual([]);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle Redis get errors gracefully', async () => {
      mockRedisClient = new MockRedisClient();
      vi.spyOn(mockRedisClient, 'get').mockRejectedValue(new Error('Redis error'));
      vi.resetModules();

      const { RedisCacheBackend } = await import('./redis-cache.js');
      const cache = new RedisCacheBackend();

      const result = await cache.get('error-key');
      expect(result).toBeNull();
    });

    it('should handle Redis set errors gracefully', async () => {
      mockRedisClient = new MockRedisClient();
      (mockRedisClient as any).setex = vi.fn().mockRejectedValue(new Error('Redis error'));
      vi.resetModules();

      const { RedisCacheBackend } = await import('./redis-cache.js');
      const cache = new RedisCacheBackend();

      // Should not throw
      await expect(cache.set('error-key', createTestData('value'))).resolves.not.toThrow();
    });
  });
});
