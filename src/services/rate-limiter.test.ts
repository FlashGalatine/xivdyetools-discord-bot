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
  getRedisClient: () => mockRedisClient,
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
});
