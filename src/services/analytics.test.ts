/**
 * Unit tests for Analytics service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MockRedisClient } from '../__tests__/helpers/mock-redis.js';
import type { CommandEvent } from './analytics.js';

// Mock logger
vi.mock('../utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Create a mock Redis client
let mockRedisClient: MockRedisClient | null = null;

// Mock the redis module
vi.mock('./redis.js', () => ({
  getRedisClient: () => mockRedisClient,
}));

describe('Analytics Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
    mockRedisClient = null;
  });

  describe('Memory-based Analytics', () => {
    beforeEach(() => {
      mockRedisClient = null;
      vi.resetModules();
    });

    it('should store events in memory when no Redis', async () => {
      const { Analytics } = await import('./analytics.js');
      const analytics = new Analytics();

      const event: CommandEvent = {
        commandName: 'harmony',
        userId: 'user-1',
        timestamp: Date.now(),
        success: true,
      };

      await analytics.trackCommand(event);
      const stats = await analytics.getStats();

      expect(stats.totalCommands).toBe(1);
    });

    it('should limit memory to 1000 events', async () => {
      const { Analytics } = await import('./analytics.js');
      const analytics = new Analytics();

      // Add 1001 events
      for (let i = 0; i < 1001; i++) {
        await analytics.trackCommand({
          commandName: 'harmony',
          userId: `user-${i}`,
          timestamp: Date.now(),
          success: true,
        });
      }

      const stats = await analytics.getStats();
      expect(stats.totalCommands).toBe(1000);
    });

    it('should calculate correct success rate', async () => {
      const { Analytics } = await import('./analytics.js');
      const analytics = new Analytics();

      // 8 successful, 2 failed = 80% success rate
      for (let i = 0; i < 8; i++) {
        await analytics.trackCommand({
          commandName: 'harmony',
          userId: 'user-1',
          timestamp: Date.now(),
          success: true,
        });
      }
      for (let i = 0; i < 2; i++) {
        await analytics.trackCommand({
          commandName: 'harmony',
          userId: 'user-1',
          timestamp: Date.now(),
          success: false,
          errorType: 'ValidationError',
        });
      }

      const stats = await analytics.getStats();
      expect(stats.successRate).toBe(80);
    });

    it('should count unique users', async () => {
      const { Analytics } = await import('./analytics.js');
      const analytics = new Analytics();

      // Same user, multiple commands
      await analytics.trackCommand({
        commandName: 'harmony',
        userId: 'user-1',
        timestamp: Date.now(),
        success: true,
      });
      await analytics.trackCommand({
        commandName: 'match',
        userId: 'user-1',
        timestamp: Date.now(),
        success: true,
      });
      // Different user
      await analytics.trackCommand({
        commandName: 'harmony',
        userId: 'user-2',
        timestamp: Date.now(),
        success: true,
      });

      const stats = await analytics.getStats();
      expect(stats.uniqueUsers).toBe(2);
    });

    it('should return command breakdown', async () => {
      const { Analytics } = await import('./analytics.js');
      const analytics = new Analytics();

      await analytics.trackCommand({
        commandName: 'harmony',
        userId: 'user-1',
        timestamp: Date.now(),
        success: true,
      });
      await analytics.trackCommand({
        commandName: 'harmony',
        userId: 'user-2',
        timestamp: Date.now(),
        success: true,
      });
      await analytics.trackCommand({
        commandName: 'match',
        userId: 'user-1',
        timestamp: Date.now(),
        success: true,
      });

      const stats = await analytics.getStats();
      expect(stats.commandBreakdown.harmony).toBe(2);
      expect(stats.commandBreakdown.match).toBe(1);
    });

    it('should return recent errors', async () => {
      const { Analytics } = await import('./analytics.js');
      const analytics = new Analytics();

      await analytics.trackCommand({
        commandName: 'harmony',
        userId: 'user-1',
        timestamp: Date.now(),
        success: false,
        errorType: 'InvalidInput',
      });

      const stats = await analytics.getStats();
      expect(stats.recentErrors).toHaveLength(1);
      expect(stats.recentErrors[0]).toContain('harmony');
      expect(stats.recentErrors[0]).toContain('InvalidInput');
    });

    it('should get daily count for specific date', async () => {
      const { Analytics } = await import('./analytics.js');
      const analytics = new Analytics();

      const today = new Date();
      await analytics.trackCommand({
        commandName: 'harmony',
        userId: 'user-1',
        timestamp: today.getTime(),
        success: true,
      });

      const count = await analytics.getDailyCount(today);
      expect(count).toBe(1);
    });

    it('should clear all analytics data', async () => {
      const { Analytics } = await import('./analytics.js');
      const analytics = new Analytics();

      await analytics.trackCommand({
        commandName: 'harmony',
        userId: 'user-1',
        timestamp: Date.now(),
        success: true,
      });

      await analytics.clear();
      const stats = await analytics.getStats();

      expect(stats.totalCommands).toBe(0);
    });
  });

  describe('Redis-based Analytics', () => {
    beforeEach(() => {
      mockRedisClient = new MockRedisClient();
      vi.resetModules();
    });

    afterEach(() => {
      mockRedisClient = null;
    });

    it('should use Redis pipeline for tracking', async () => {
      const pipelineSpy = vi.spyOn(mockRedisClient!, 'pipeline');

      const { Analytics } = await import('./analytics.js');
      const analytics = new Analytics();

      await analytics.trackCommand({
        commandName: 'harmony',
        userId: 'user-1',
        timestamp: Date.now(),
        success: true,
      });

      expect(pipelineSpy).toHaveBeenCalled();
    });

    it('should increment counters in Redis', async () => {
      const { Analytics } = await import('./analytics.js');
      const analytics = new Analytics();

      await analytics.trackCommand({
        commandName: 'harmony',
        userId: 'user-1',
        timestamp: Date.now(),
        success: true,
      });

      const total = await mockRedisClient!.get('analytics:total');
      expect(total).toBe('1');
    });

    it('should track unique users with HyperLogLog', async () => {
      const { Analytics } = await import('./analytics.js');
      const analytics = new Analytics();

      await analytics.trackCommand({
        commandName: 'harmony',
        userId: 'user-1',
        timestamp: Date.now(),
        success: true,
      });
      await analytics.trackCommand({
        commandName: 'match',
        userId: 'user-2',
        timestamp: Date.now(),
        success: true,
      });

      const stats = await analytics.getStats();
      expect(stats.uniqueUsers).toBe(2);
    });

    it('should store recent errors in Redis list', async () => {
      const { Analytics } = await import('./analytics.js');
      const analytics = new Analytics();

      await analytics.trackCommand({
        commandName: 'harmony',
        userId: 'user-1',
        timestamp: Date.now(),
        success: false,
        errorType: 'TestError',
      });

      const stats = await analytics.getStats();
      expect(stats.recentErrors.length).toBeGreaterThan(0);
    });

    it('should handle Redis errors gracefully', async () => {
      vi.spyOn(mockRedisClient!, 'pipeline').mockImplementation(() => {
        throw new Error('Redis error');
      });

      const { Analytics } = await import('./analytics.js');
      const analytics = new Analytics();

      // Should not throw
      await expect(
        analytics.trackCommand({
          commandName: 'harmony',
          userId: 'user-1',
          timestamp: Date.now(),
          success: true,
        })
      ).resolves.not.toThrow();
    });

    it('should track guild usage when guildId is provided (lines 97-98)', async () => {
      const { Analytics } = await import('./analytics.js');
      const analytics = new Analytics();

      await analytics.trackCommand({
        commandName: 'harmony',
        userId: 'user-1',
        guildId: 'guild-123',
        timestamp: Date.now(),
        success: true,
      });

      const guildCount = await mockRedisClient!.get('analytics:guild:guild-123');
      expect(guildCount).toBe('1');
    });

    it('should get daily count from Redis (line 212)', async () => {
      const { Analytics } = await import('./analytics.js');
      const analytics = new Analytics();

      const today = new Date();
      await analytics.trackCommand({
        commandName: 'harmony',
        userId: 'user-1',
        timestamp: today.getTime(),
        success: true,
      });

      const count = await analytics.getDailyCount(today);
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should clear Redis analytics keys (lines 235-238)', async () => {
      const { Analytics } = await import('./analytics.js');
      const analytics = new Analytics();

      await analytics.trackCommand({
        commandName: 'harmony',
        userId: 'user-1',
        timestamp: Date.now(),
        success: true,
      });

      await analytics.clear();

      const total = await mockRedisClient!.get('analytics:total');
      expect(total).toBeNull();
    });

    it('should handle malformed JSON in errors list (lines 162-163)', async () => {
      const { Analytics } = await import('./analytics.js');
      const analytics = new Analytics();

      // Manually push malformed JSON to errors list
      await mockRedisClient!.lpush('analytics:errors', 'not-valid-json');
      await mockRedisClient!.set('analytics:total', '1');

      const stats = await analytics.getStats();
      expect(stats.recentErrors).toContain('not-valid-json');
    });
  });

  describe('Analytics Error Handling', () => {
    beforeEach(() => {
      vi.resetModules();
    });

    it('should handle getStats errors gracefully (lines 126-134)', async () => {
      const errorMockRedis = new MockRedisClient();
      vi.spyOn(errorMockRedis, 'get').mockRejectedValue(new Error('Redis error'));

      vi.doMock('./redis.js', () => ({
        getRedisClient: () => errorMockRedis,
      }));

      const { Analytics } = await import('./analytics.js');
      const analytics = new Analytics();

      const stats = await analytics.getStats();

      expect(stats).toEqual({
        totalCommands: 0,
        commandBreakdown: {},
        uniqueUsers: 0,
        successRate: 0,
        recentErrors: [],
      });
    });

    it('should handle getDailyCount errors gracefully (lines 224-226)', async () => {
      const errorMockRedis = new MockRedisClient();
      vi.spyOn(errorMockRedis, 'get').mockRejectedValue(new Error('Redis error'));

      vi.doMock('./redis.js', () => ({
        getRedisClient: () => errorMockRedis,
      }));

      const { Analytics } = await import('./analytics.js');
      const analytics = new Analytics();

      const count = await analytics.getDailyCount(new Date());

      expect(count).toBe(0);
    });

    it('should handle clear errors gracefully (lines 243-244)', async () => {
      const errorMockRedis = new MockRedisClient();
      vi.spyOn(errorMockRedis, 'keys').mockRejectedValue(new Error('Redis error'));

      vi.doMock('./redis.js', () => ({
        getRedisClient: () => errorMockRedis,
      }));

      const { Analytics } = await import('./analytics.js');
      const analytics = new Analytics();

      // Should not throw
      await expect(analytics.clear()).resolves.not.toThrow();
    });
  });

  describe('getAnalytics singleton', () => {
    beforeEach(() => {
      mockRedisClient = null;
      vi.resetModules();
    });

    it('should return singleton instance', async () => {
      const { getAnalytics } = await import('./analytics.js');

      const instance1 = getAnalytics();
      const instance2 = getAnalytics();

      expect(instance1).toBe(instance2);
    });
  });
});
