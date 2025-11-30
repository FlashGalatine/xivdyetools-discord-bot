/**
 * Analytics service
 * Tracks command usage and provides statistics
 */

import type Redis from 'ioredis';
import { getRedisClient } from './redis.js';
import { logger } from '../utils/logger.js';

export interface CommandEvent {
  commandName: string;
  userId: string;
  guildId?: string;
  timestamp: number;
  success: boolean;
  errorType?: string;
}

export interface CommandStats {
  totalCommands: number;
  commandBreakdown: Record<string, number>;
  uniqueUsers: number;
  successRate: number;
  recentErrors: string[];
}

/**
 * Circular buffer for O(1) insertions (replaces O(n) shift())
 * When buffer is full, overwrites oldest entries without array reindexing
 */
class CircularBuffer<T> {
  private buffer: (T | undefined)[];
  private writeIndex: number = 0;
  private count: number = 0;

  constructor(private readonly maxSize: number) {
    this.buffer = new Array<T | undefined>(maxSize);
  }

  push(item: T): void {
    this.buffer[this.writeIndex] = item;
    this.writeIndex = (this.writeIndex + 1) % this.maxSize;
    if (this.count < this.maxSize) {
      this.count++;
    }
  }

  /**
   * Returns items in insertion order (oldest first)
   */
  toArray(): T[] {
    if (this.count === 0) return [];

    const result: T[] = [];
    // Start from oldest item
    const startIndex = this.count < this.maxSize ? 0 : this.writeIndex;

    for (let i = 0; i < this.count; i++) {
      const index = (startIndex + i) % this.maxSize;
      const item = this.buffer[index];
      if (item !== undefined) {
        result.push(item);
      }
    }
    return result;
  }

  get length(): number {
    return this.count;
  }

  clear(): void {
    this.buffer = new Array<T | undefined>(this.maxSize);
    this.writeIndex = 0;
    this.count = 0;
  }
}

/**
 * Analytics service for tracking command usage
 * Uses circular buffer for O(1) memory operations
 */
export class Analytics {
  private redis: Redis | null;
  private memoryEvents: CircularBuffer<CommandEvent>;
  private readonly maxMemoryEvents: number = 1000;

  constructor() {
    this.redis = getRedisClient();
    this.memoryEvents = new CircularBuffer<CommandEvent>(this.maxMemoryEvents);

    if (!this.redis) {
      logger.debug('Analytics using in-memory storage (circular buffer)');
    }
  }

  /**
   * Track command execution
   */
  async trackCommand(event: CommandEvent): Promise<void> {
    try {
      if (this.redis) {
        await this.trackCommandRedis(event);
      } else {
        this.trackCommandMemory(event);
      }
    } catch (error) {
      logger.error('Analytics tracking error:', error);
    }
  }

  /**
   * Track command in Redis
   */
  private async trackCommandRedis(event: CommandEvent): Promise<void> {
    const dateKey = new Date(event.timestamp).toISOString().split('T')[0]; // YYYY-MM-DD
    const pipeline = this.redis!.pipeline();

    // Increment total commands counter
    pipeline.incr('analytics:total');

    // Increment daily counter
    pipeline.incr(`analytics:daily:${dateKey}`);
    pipeline.expire(`analytics:daily:${dateKey}`, 30 * 24 * 60 * 60); // 30 days

    // Increment per-command counter
    pipeline.incr(`analytics:command:${event.commandName}`);

    // Track unique users (HyperLogLog for memory efficiency)
    pipeline.pfadd('analytics:users', event.userId);

    // Track success/failure
    if (event.success) {
      pipeline.incr('analytics:success');
    } else {
      pipeline.incr('analytics:failure');
      // Store recent error
      if (event.errorType) {
        pipeline.lpush(
          'analytics:errors',
          JSON.stringify({
            command: event.commandName,
            error: event.errorType,
            timestamp: event.timestamp,
          })
        );
        pipeline.ltrim('analytics:errors', 0, 99); // Keep last 100 errors
      }
    }

    // Track guild usage if available
    if (event.guildId) {
      pipeline.incr(`analytics:guild:${event.guildId}`);
    }

    await pipeline.exec();
  }

  /**
   * Track command in memory using circular buffer
   * O(1) operation - no need for shift() which was O(n)
   */
  private trackCommandMemory(event: CommandEvent): void {
    // Circular buffer automatically handles overflow in O(1)
    this.memoryEvents.push(event);
  }

  /**
   * Get command statistics
   */
  async getStats(): Promise<CommandStats> {
    try {
      if (this.redis) {
        return await this.getStatsRedis();
      } else {
        return this.getStatsMemory();
      }
    } catch (error) {
      logger.error('Error getting analytics stats:', error);
      return {
        totalCommands: 0,
        commandBreakdown: {},
        uniqueUsers: 0,
        successRate: 0,
        recentErrors: [],
      };
    }
  }

  /**
   * Get stats from Redis
   * Uses MGET to batch command breakdown queries (fixes N+1 query pattern)
   */
  private async getStatsRedis(): Promise<CommandStats> {
    // Batch the initial stats queries using pipeline
    const statsPipeline = this.redis!.pipeline();
    statsPipeline.get('analytics:total');
    statsPipeline.get('analytics:success');
    statsPipeline.pfcount('analytics:users');
    statsPipeline.keys('analytics:command:*');
    statsPipeline.lrange('analytics:errors', 0, 9);

    const statsResults = await statsPipeline.exec();

    if (!statsResults) {
      throw new Error('Failed to fetch analytics stats');
    }

    const total = parseInt((statsResults[0][1] as string) || '0', 10);
    const successes = parseInt((statsResults[1][1] as string) || '0', 10);
    const uniqueUsers = (statsResults[2][1] as number) || 0;
    const commandKeys = (statsResults[3][1] as string[]) || [];
    const errorStrings = (statsResults[4][1] as string[]) || [];

    // Get command breakdown using MGET (single round-trip instead of N)
    const commandBreakdown: Record<string, number> = {};
    if (commandKeys.length > 0) {
      const counts = await this.redis!.mget(...commandKeys);
      for (let i = 0; i < commandKeys.length; i++) {
        const commandName = commandKeys[i].replace('analytics:command:', '');
        commandBreakdown[commandName] = parseInt(counts[i] || '0', 10);
      }
    }

    // Parse recent errors
    const recentErrors = errorStrings.map((str) => {
      try {
        const err = JSON.parse(str) as { command?: string; error?: string };
        return `${err.command ?? 'unknown'}: ${err.error ?? 'unknown'}`;
      } catch {
        return str;
      }
    });

    return {
      totalCommands: total,
      commandBreakdown,
      uniqueUsers,
      successRate: total > 0 ? (successes / total) * 100 : 0,
      recentErrors,
    };
  }

  /**
   * Get stats from memory (circular buffer)
   */
  private getStatsMemory(): CommandStats {
    const events = this.memoryEvents.toArray();
    const total = events.length;
    const successes = events.filter((e) => e.success).length;
    const uniqueUsers = new Set(events.map((e) => e.userId)).size;

    // Command breakdown
    const commandBreakdown: Record<string, number> = {};
    for (const event of events) {
      commandBreakdown[event.commandName] = (commandBreakdown[event.commandName] || 0) + 1;
    }

    // Recent errors (last 10)
    const recentErrors = events
      .filter((e) => !e.success && e.errorType)
      .slice(-10)
      .map((e) => `${e.commandName}: ${e.errorType}`);

    return {
      totalCommands: total,
      commandBreakdown,
      uniqueUsers,
      successRate: total > 0 ? (successes / total) * 100 : 0,
      recentErrors,
    };
  }

  /**
   * Get daily command count for a specific date
   */
  async getDailyCount(date: Date): Promise<number> {
    try {
      const dateKey = date.toISOString().split('T')[0];

      if (this.redis) {
        return parseInt((await this.redis.get(`analytics:daily:${dateKey}`)) || '0', 10);
      } else {
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);

        return this.memoryEvents
          .toArray()
          .filter((e) => e.timestamp >= dayStart.getTime() && e.timestamp <= dayEnd.getTime())
          .length;
      }
    } catch (error) {
      logger.error('Error getting daily count:', error);
      return 0;
    }
  }

  /**
   * Clear all analytics data (for testing)
   */
  async clear(): Promise<void> {
    try {
      if (this.redis) {
        const keys = await this.redis.keys('analytics:*');
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } else {
        this.memoryEvents.clear();
      }
    } catch (error) {
      logger.error('Error clearing analytics:', error);
    }
  }
}

// Singleton instance
let analyticsInstance: Analytics | null = null;

/**
 * Get analytics instance (singleton)
 */
export function getAnalytics(): Analytics {
  if (!analyticsInstance) {
    analyticsInstance = new Analytics();
  }

  return analyticsInstance;
}
