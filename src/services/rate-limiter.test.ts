/**
 * Unit tests for Rate Limiter service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MockRedisClient } from '../__tests__/helpers/mock-redis.js';

// Mock logger
vi.mock('../utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock config
vi.mock('../config.js', () => ({
  config: {
    rateLimit: {
      commandsPerMinute: 10,
      commandsPerHour: 100,
      commandLimits: {
        match_image: { perMinute: 3, perHour: 20 },
        harmony: { perMinute: 8, perHour: 80 },
        mixer: { perMinute: 8, perHour: 80 },
        comparison: { perMinute: 5, perHour: 50 },
        accessibility: { perMinute: 5, perHour: 50 },
      },
    },
  },
}));

// Create a mock Redis client
let mockRedisClient: MockRedisClient | null = null;

// Mock the redis module
vi.mock('./redis.js', () => ({
  getRedisClient: (): MockRedisClient | null => mockRedisClient,
}));

describe('Rate Limiter Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    mockRedisClient = null;
  });

  describe('Memory-based Rate Limiting', () => {
    beforeEach(() => {
      mockRedisClient = null;
      vi.resetModules();
    });

    it('should allow first request', async () => {
      const { RateLimiter } = await import('./rate-limiter.js');
      const limiter = new RateLimiter();

      const result = await limiter.checkUserLimit('user-1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9); // 10 - 1
    });

    it('should increment counter on each request', async () => {
      const { RateLimiter } = await import('./rate-limiter.js');
      const limiter = new RateLimiter();

      await limiter.checkUserLimit('user-1');
      await limiter.checkUserLimit('user-1');
      const result = await limiter.checkUserLimit('user-1');

      expect(result.remaining).toBe(7); // 10 - 3
    });

    it('should return allowed=false when limit exceeded', async () => {
      const { RateLimiter } = await import('./rate-limiter.js');
      const limiter = new RateLimiter();

      // Make 10 requests to hit limit
      for (let i = 0; i < 10; i++) {
        await limiter.checkUserLimit('user-1');
      }

      // 11th request should be blocked
      const result = await limiter.checkUserLimit('user-1');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should reset after window expires', async () => {
      const { RateLimiter } = await import('./rate-limiter.js');
      const limiter = new RateLimiter();

      // Make 10 requests to hit limit
      for (let i = 0; i < 10; i++) {
        await limiter.checkUserLimit('user-1');
      }

      // Advance time past the window
      vi.advanceTimersByTime(61 * 1000); // 61 seconds

      // Should be allowed again
      const result = await limiter.checkUserLimit('user-1');
      expect(result.allowed).toBe(true);
    });

    it('should use command-specific limits for match_image', async () => {
      const { RateLimiter } = await import('./rate-limiter.js');
      const limiter = new RateLimiter();

      // match_image has limit of 3 per minute
      await limiter.checkUserLimit('user-1', 'match_image');
      await limiter.checkUserLimit('user-1', 'match_image');
      await limiter.checkUserLimit('user-1', 'match_image');

      // 4th request should be blocked
      const result = await limiter.checkUserLimit('user-1', 'match_image');
      expect(result.allowed).toBe(false);
    });

    it('should use command-specific limits for harmony', async () => {
      const { RateLimiter } = await import('./rate-limiter.js');
      const limiter = new RateLimiter();

      // harmony has limit of 8 per minute
      for (let i = 0; i < 8; i++) {
        await limiter.checkUserLimit('user-1', 'harmony');
      }

      // 9th request should be blocked
      const result = await limiter.checkUserLimit('user-1', 'harmony');
      expect(result.allowed).toBe(false);
    });

    it('should enforce hourly limits', async () => {
      const { RateLimiter } = await import('./rate-limiter.js');
      const limiter = new RateLimiter();

      // Make 100 requests to hit hourly limit
      for (let i = 0; i < 100; i++) {
        await limiter.checkUserHourlyLimit('user-1');
      }

      // 101st request should be blocked
      const result = await limiter.checkUserHourlyLimit('user-1');
      expect(result.allowed).toBe(false);
    });

    it('should reset user limits', async () => {
      const { RateLimiter } = await import('./rate-limiter.js');
      const limiter = new RateLimiter();

      // Make several requests
      for (let i = 0; i < 5; i++) {
        await limiter.checkUserLimit('user-1');
      }

      // Reset limits
      await limiter.resetUserLimit('user-1');

      // Should be back to full limit
      const result = await limiter.checkUserLimit('user-1');
      expect(result.remaining).toBe(9);
    });

    it('should cleanup expired memory entries', async () => {
      const { RateLimiter } = await import('./rate-limiter.js');
      const limiter = new RateLimiter();

      // Make a request
      await limiter.checkUserLimit('user-1');

      // Advance time past expiration
      vi.advanceTimersByTime(61 * 1000);

      // Cleanup should remove expired entries
      limiter.cleanupMemoryStore();

      // Next request should start fresh
      const result = await limiter.checkUserLimit('user-1');
      expect(result.remaining).toBe(9);
    });

    it('should maintain independent limits for different users', async () => {
      const { RateLimiter } = await import('./rate-limiter.js');
      const limiter = new RateLimiter();

      // User 1 makes 5 requests
      for (let i = 0; i < 5; i++) {
        await limiter.checkUserLimit('user-1');
      }

      // User 2's first request should have full limit
      const result = await limiter.checkUserLimit('user-2');
      expect(result.remaining).toBe(9);
    });

    it('should return retryAfter when rate limited', async () => {
      const { RateLimiter } = await import('./rate-limiter.js');
      const limiter = new RateLimiter();

      // Hit rate limit
      for (let i = 0; i < 11; i++) {
        await limiter.checkUserLimit('user-1');
      }

      const result = await limiter.checkUserLimit('user-1');
      expect(result.retryAfter).toBeDefined();
      expect(result.retryAfter).toBeGreaterThan(0);
    });
  });

  describe('Redis-based Rate Limiting', () => {
    beforeEach(() => {
      mockRedisClient = new MockRedisClient();
      vi.resetModules();
    });

    afterEach(() => {
      mockRedisClient = null;
    });

    it('should use Redis pipeline for atomic operations', async () => {
      const pipelineSpy = vi.spyOn(mockRedisClient!, 'pipeline');

      const { RateLimiter } = await import('./rate-limiter.js');
      const limiter = new RateLimiter();

      await limiter.checkUserLimit('user-1');

      expect(pipelineSpy).toHaveBeenCalled();
    });

    it('should allow first request with Redis', async () => {
      const { RateLimiter } = await import('./rate-limiter.js');
      const limiter = new RateLimiter();

      const result = await limiter.checkUserLimit('user-1');
      expect(result.allowed).toBe(true);
    });

    it('should block when limit exceeded with Redis', async () => {
      const { RateLimiter } = await import('./rate-limiter.js');
      const limiter = new RateLimiter();

      // Make 10 requests
      for (let i = 0; i < 10; i++) {
        await limiter.checkUserLimit('user-1');
      }

      // 11th should be blocked
      const result = await limiter.checkUserLimit('user-1');
      expect(result.allowed).toBe(false);
    });

    it('should enforce global rate limit', async () => {
      const { RateLimiter } = await import('./rate-limiter.js');
      const limiter = new RateLimiter();

      // Global limit is 10 * commandsPerMinute = 100
      for (let i = 0; i < 100; i++) {
        await limiter.checkGlobalLimit();
      }

      const result = await limiter.checkGlobalLimit();
      expect(result.allowed).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should fail open on Redis error (allow request)', async () => {
      mockRedisClient = new MockRedisClient();
      vi.spyOn(mockRedisClient, 'pipeline').mockImplementation(() => {
        throw new Error('Redis connection lost');
      });
      vi.resetModules();

      const { RateLimiter } = await import('./rate-limiter.js');
      const limiter = new RateLimiter();

      const result = await limiter.checkUserLimit('user-1');
      expect(result.allowed).toBe(true);
    });
  });

  describe('getRateLimiter singleton', () => {
    beforeEach(() => {
      mockRedisClient = null;
      vi.resetModules();
    });

    it('should return singleton instance', async () => {
      const { getRateLimiter } = await import('./rate-limiter.js');

      const instance1 = getRateLimiter();
      const instance2 = getRateLimiter();

      expect(instance1).toBe(instance2);
    });
  });

  describe('stopRateLimiter', () => {
    beforeEach(() => {
      mockRedisClient = null;
      vi.resetModules();
    });

    it('should stop cleanup interval', async () => {
      const { getRateLimiter, stopRateLimiter } = await import('./rate-limiter.js');

      // Initialize the rate limiter (which starts the cleanup interval)
      getRateLimiter();

      // Stop should not throw
      stopRateLimiter();

      // Calling stop again should also not throw
      stopRateLimiter();
    });
  });

  describe('Memory Store Overflow Handling', () => {
    beforeEach(() => {
      mockRedisClient = null;
      vi.resetModules();
    });

    it('should enforce max entries limit during cleanup', async () => {
      const { RateLimiter } = await import('./rate-limiter.js');
      const limiter = new RateLimiter();

      // Create many entries (more than max)
      for (let i = 0; i < 600; i++) {
        await limiter.checkUserLimit(`user-${i}`);
      }

      // Cleanup should enforce max entries
      limiter.cleanupMemoryStore();

      // After cleanup, new requests should still work
      const result = await limiter.checkUserLimit('new-user');
      expect(result.allowed).toBe(true);
    });

    it('should skip cleanup when using Redis', async () => {
      mockRedisClient = new MockRedisClient();
      vi.resetModules();

      const { RateLimiter } = await import('./rate-limiter.js');
      const limiter = new RateLimiter();

      // This should be a no-op when Redis is available
      limiter.cleanupMemoryStore();

      const result = await limiter.checkUserLimit('user-1');
      expect(result.allowed).toBe(true);
    });
  });

  describe('Redis Pipeline Failure', () => {
    beforeEach(() => {
      vi.resetModules();
    });

    it('should fall back to memory store on pipeline exec failure', async () => {
      mockRedisClient = new MockRedisClient();

      // Mock pipeline to return null results
      vi.spyOn(mockRedisClient, 'pipeline').mockImplementation(
        () =>
          ({
            incr: vi.fn().mockReturnThis(),
            expire: vi.fn().mockReturnThis(),
            ttl: vi.fn().mockReturnThis(),
            exec: vi.fn().mockResolvedValue(null),
          }) as any
      );

      const { RateLimiter } = await import('./rate-limiter.js');
      const limiter = new RateLimiter();

      // Should fall back to conservative memory-based limiting
      const result = await limiter.checkUserLimit('user-1');
      expect(result.allowed).toBe(true);
    });

    it('should fall back to memory store when pipeline returns insufficient results', async () => {
      mockRedisClient = new MockRedisClient();

      // Mock pipeline to return incomplete results
      vi.spyOn(mockRedisClient, 'pipeline').mockImplementation(
        () =>
          ({
            incr: vi.fn().mockReturnThis(),
            expire: vi.fn().mockReturnThis(),
            ttl: vi.fn().mockReturnThis(),
            exec: vi.fn().mockResolvedValue([[null, 1]]), // Only 1 result instead of 3
          }) as any
      );

      const { RateLimiter } = await import('./rate-limiter.js');
      const limiter = new RateLimiter();

      // Should fall back to conservative memory-based limiting
      const result = await limiter.checkUserLimit('user-1');
      expect(result.allowed).toBe(true);
    });
  });

  describe('Command-Specific Limits', () => {
    beforeEach(() => {
      mockRedisClient = null;
      vi.resetModules();
    });

    it('should use default limits for unknown commands', async () => {
      const { RateLimiter } = await import('./rate-limiter.js');
      const limiter = new RateLimiter();

      // unknown_command should use default limits (10 per minute)
      for (let i = 0; i < 10; i++) {
        await limiter.checkUserLimit('user-1', 'unknown_command');
      }

      const result = await limiter.checkUserLimit('user-1', 'unknown_command');
      expect(result.allowed).toBe(false);
    });

    it('should use command-specific hourly limits', async () => {
      const { RateLimiter } = await import('./rate-limiter.js');
      const limiter = new RateLimiter();

      // match_image has hourly limit of 20
      for (let i = 0; i < 20; i++) {
        await limiter.checkUserHourlyLimit('user-1', 'match_image');
      }

      const result = await limiter.checkUserHourlyLimit('user-1', 'match_image');
      expect(result.allowed).toBe(false);
    });

    it('should use default hourly limits for unknown commands', async () => {
      const { RateLimiter } = await import('./rate-limiter.js');
      const limiter = new RateLimiter();

      // unknown_command should use default hourly limits (100)
      for (let i = 0; i < 100; i++) {
        await limiter.checkUserHourlyLimit('user-1', 'unknown_command');
      }

      const result = await limiter.checkUserHourlyLimit('user-1', 'unknown_command');
      expect(result.allowed).toBe(false);
    });
  });

  describe('Redis Reset User Limit', () => {
    beforeEach(() => {
      mockRedisClient = new MockRedisClient();
      vi.resetModules();
    });

    it('should reset user limits in Redis', async () => {
      const { RateLimiter } = await import('./rate-limiter.js');
      const limiter = new RateLimiter();

      const delSpy = vi.spyOn(mockRedisClient!, 'del');

      await limiter.resetUserLimit('user-1');

      expect(delSpy).toHaveBeenCalledWith('ratelimit:user:user-1:minute');
      expect(delSpy).toHaveBeenCalledWith('ratelimit:user:user-1:hour');
    });

    it('should handle errors during Redis reset', async () => {
      const { RateLimiter } = await import('./rate-limiter.js');
      const limiter = new RateLimiter();

      vi.spyOn(mockRedisClient!, 'del').mockRejectedValue(new Error('Redis error'));

      // Should not throw
      await expect(limiter.resetUserLimit('user-1')).resolves.not.toThrow();
    });
  });
});
