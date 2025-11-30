/**
 * Rate limiter service
 * Implements per-user and global rate limiting using Redis or in-memory fallback
 */

import type Redis from 'ioredis';
import { getRedisClient } from './redis.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfter?: number; // seconds
}

interface MemoryRateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * Configuration for memory store limits
 * Prevents unbounded memory growth
 */
const MEMORY_STORE_CONFIG = {
  maxEntries: 500, // Maximum entries before forced cleanup
  cleanupIntervalMs: 2 * 60 * 1000, // 2 minutes (vs previous 5 minutes)
  conservativeFallbackMultiplier: 0.5, // Use 50% of normal limits when Redis fails
};

/**
 * Rate limiter using Redis or in-memory fallback
 */
export class RateLimiter {
  private redis: Redis | null;
  private memoryStore: Map<string, MemoryRateLimitEntry>;

  constructor() {
    this.redis = getRedisClient();
    this.memoryStore = new Map();

    if (!this.redis) {
      logger.debug('Rate limiter using in-memory store');
    }
  }

  /**
   * Check if user is rate limited (per-user limit)
   * Per S-6: Command-specific limits
   * Uses sliding window of 1 minute
   */
  async checkUserLimit(userId: string, commandName?: string): Promise<RateLimitResult> {
    // Per S-6: Get command-specific limit or use default
    const limit = this.getCommandLimit(commandName, 'perMinute');
    const windowSeconds = 60; // 1 minute
    const key = commandName
      ? `ratelimit:user:${userId}:${commandName}:minute`
      : `ratelimit:user:${userId}:minute`;

    return this.checkLimit(key, limit, windowSeconds);
  }

  /**
   * Check if user is rate limited (hourly limit)
   * Per S-6: Command-specific limits
   * Uses sliding window of 1 hour
   */
  async checkUserHourlyLimit(userId: string, commandName?: string): Promise<RateLimitResult> {
    // Per S-6: Get command-specific limit or use default
    const limit = this.getCommandLimit(commandName, 'perHour');
    const windowSeconds = 3600; // 1 hour
    const key = commandName
      ? `ratelimit:user:${userId}:${commandName}:hour`
      : `ratelimit:user:${userId}:hour`;

    return this.checkLimit(key, limit, windowSeconds);
  }

  /**
   * Get command-specific rate limit
   * Per S-6: Returns command-specific limit or default
   */
  private getCommandLimit(commandName: string | undefined, type: 'perMinute' | 'perHour'): number {
    if (!commandName) {
      return type === 'perMinute'
        ? config.rateLimit.commandsPerMinute
        : config.rateLimit.commandsPerHour;
    }

    const commandLimit = config.rateLimit.commandLimits[commandName];
    if (commandLimit) {
      return commandLimit[type];
    }

    // Use default limits
    return type === 'perMinute'
      ? config.rateLimit.commandsPerMinute
      : config.rateLimit.commandsPerHour;
  }

  /**
   * Check global rate limit
   * Uses sliding window of 1 minute
   */
  async checkGlobalLimit(): Promise<RateLimitResult> {
    const limit = config.rateLimit.commandsPerMinute * 10; // 10x user limit
    const windowSeconds = 60;
    const key = 'ratelimit:global:minute';

    return this.checkLimit(key, limit, windowSeconds);
  }

  /**
   * Generic rate limit check with sliding window
   * Uses conservative fallback when Redis fails (fail-safe, not fail-open)
   */
  private async checkLimit(
    key: string,
    limit: number,
    windowSeconds: number
  ): Promise<RateLimitResult> {
    try {
      if (this.redis) {
        return await this.checkLimitRedis(key, limit, windowSeconds);
      } else {
        return this.checkLimitMemory(key, limit, windowSeconds);
      }
    } catch (error) {
      logger.error(`Rate limit check error for key ${key}:`, error);

      // Conservative fallback: Use in-memory store with stricter limits
      // This prevents spam attacks when Redis is down
      const conservativeLimit = Math.max(
        1,
        Math.floor(limit * MEMORY_STORE_CONFIG.conservativeFallbackMultiplier)
      );

      logger.warn(
        `Redis error, using conservative fallback for ${key} (limit: ${conservativeLimit} vs normal: ${limit})`
      );

      return this.checkLimitMemory(key, conservativeLimit, windowSeconds);
    }
  }

  /**
   * Redis-based rate limiting using pipeline for atomic operations
   * Per P-5: Combines INCR + EXPIRE + TTL in single pipeline (reduces 3 round-trips to 1)
   */
  private async checkLimitRedis(
    key: string,
    limit: number,
    windowSeconds: number
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const resetAt = new Date(now + windowSeconds * 1000);

    // Per P-5: Use pipeline to combine INCR, EXPIRE, and TTL in single round-trip
    const pipeline = this.redis!.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, windowSeconds, 'NX'); // Only set if key doesn't exist
    pipeline.ttl(key);

    const results = await pipeline.exec();

    if (!results || results.length < 3) {
      throw new Error('Pipeline execution failed');
    }

    // Extract results from pipeline
    const count = results[0][1] as number;
    const ttl = results[2][1] as number;

    const remaining = Math.max(0, limit - count);
    const allowed = count <= limit;

    const result: RateLimitResult = {
      allowed,
      limit,
      remaining,
      resetAt,
    };

    if (!allowed) {
      result.retryAfter = ttl > 0 ? ttl : windowSeconds;
    }

    return result;
  }

  /**
   * In-memory rate limiting fallback
   */
  private checkLimitMemory(key: string, limit: number, windowSeconds: number): RateLimitResult {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;

    // Get or create entry
    let entry = this.memoryStore.get(key);

    // Reset if window expired
    if (!entry || entry.resetAt < now) {
      entry = {
        count: 1,
        resetAt: now + windowMs,
      };
      this.memoryStore.set(key, entry);

      return {
        allowed: true,
        limit,
        remaining: limit - 1,
        resetAt: new Date(entry.resetAt),
      };
    }

    // Increment counter
    entry.count++;

    const remaining = Math.max(0, limit - entry.count);
    const allowed = entry.count <= limit;

    const result: RateLimitResult = {
      allowed,
      limit,
      remaining,
      resetAt: new Date(entry.resetAt),
    };

    if (!allowed) {
      result.retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    }

    return result;
  }

  /**
   * Reset rate limit for a user (for testing or admin purposes)
   */
  async resetUserLimit(userId: string): Promise<void> {
    try {
      if (this.redis) {
        await this.redis.del(`ratelimit:user:${userId}:minute`);
        await this.redis.del(`ratelimit:user:${userId}:hour`);
      } else {
        this.memoryStore.delete(`ratelimit:user:${userId}:minute`);
        this.memoryStore.delete(`ratelimit:user:${userId}:hour`);
      }
    } catch (error) {
      logger.error(`Error resetting rate limit for user ${userId}:`, error);
    }
  }

  /**
   * Clean up expired entries from memory store
   * Also enforces maximum entry limit to prevent unbounded memory growth
   */
  cleanupMemoryStore(): void {
    if (this.redis) return; // Only needed for memory store

    const now = Date.now();
    let expiredCount = 0;

    // First pass: remove expired entries
    for (const [key, entry] of this.memoryStore.entries()) {
      if (entry.resetAt < now) {
        this.memoryStore.delete(key);
        expiredCount++;
      }
    }

    // Second pass: enforce max entries limit (remove oldest entries if over limit)
    if (this.memoryStore.size > MEMORY_STORE_CONFIG.maxEntries) {
      // Convert to array, sort by resetAt, and keep only newest entries
      const entries = Array.from(this.memoryStore.entries());
      entries.sort((a, b) => b[1].resetAt - a[1].resetAt); // Newest first

      this.memoryStore.clear();
      const entriesToKeep = entries.slice(0, MEMORY_STORE_CONFIG.maxEntries);
      for (const [key, value] of entriesToKeep) {
        this.memoryStore.set(key, value);
      }

      const removedCount = entries.length - entriesToKeep.length;
      logger.debug(
        `Rate limiter cleanup: removed ${expiredCount} expired, ${removedCount} overflow entries. Size: ${this.memoryStore.size}`
      );
    } else if (expiredCount > 0) {
      logger.debug(
        `Rate limiter cleanup: removed ${expiredCount} expired entries. Size: ${this.memoryStore.size}`
      );
    }
  }
}

// Singleton instance
let rateLimiterInstance: RateLimiter | null = null;

/**
 * Get rate limiter instance (singleton)
 */
export function getRateLimiter(): RateLimiter {
  if (!rateLimiterInstance) {
    rateLimiterInstance = new RateLimiter();

    // Clean up memory store at configured interval (2 minutes by default)
    // This prevents memory leaks from expired entries accumulating
    if (!getRedisClient()) {
      setInterval(() => {
        rateLimiterInstance?.cleanupMemoryStore();
      }, MEMORY_STORE_CONFIG.cleanupIntervalMs);
    }
  }

  return rateLimiterInstance;
}
