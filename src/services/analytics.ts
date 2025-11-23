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
 * Analytics service for tracking command usage
 */
export class Analytics {
    private redis: Redis | null;
    private memoryEvents: CommandEvent[];
    private maxMemoryEvents: number = 1000;

    constructor() {
        this.redis = getRedisClient();
        this.memoryEvents = [];

        if (!this.redis) {
            logger.debug('Analytics using in-memory storage');
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
                pipeline.lpush('analytics:errors', JSON.stringify({
                    command: event.commandName,
                    error: event.errorType,
                    timestamp: event.timestamp,
                }));
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
     * Track command in memory
     */
    private trackCommandMemory(event: CommandEvent): void {
        this.memoryEvents.push(event);

        // Limit memory usage
        if (this.memoryEvents.length > this.maxMemoryEvents) {
            this.memoryEvents.shift();
        }
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
     */
    private async getStatsRedis(): Promise<CommandStats> {
        const total = parseInt(await this.redis!.get('analytics:total') || '0', 10);
        const successes = parseInt(await this.redis!.get('analytics:success') || '0', 10);
        const uniqueUsers = await this.redis!.pfcount('analytics:users');

        // Get command breakdown
        const commandKeys = await this.redis!.keys('analytics:command:*');
        const commandBreakdown: Record<string, number> = {};

        for (const key of commandKeys) {
            const commandName = key.replace('analytics:command:', '');
            const count = parseInt(await this.redis!.get(key) || '0', 10);
            commandBreakdown[commandName] = count;
        }

        // Get recent errors
        const errorStrings = await this.redis!.lrange('analytics:errors', 0, 9); // Last 10
        const recentErrors = errorStrings.map(str => {
            try {
                const err = JSON.parse(str);
                return `${err.command}: ${err.error}`;
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
     * Get stats from memory
     */
    private getStatsMemory(): CommandStats {
        const total = this.memoryEvents.length;
        const successes = this.memoryEvents.filter(e => e.success).length;
        const uniqueUsers = new Set(this.memoryEvents.map(e => e.userId)).size;

        // Command breakdown
        const commandBreakdown: Record<string, number> = {};
        for (const event of this.memoryEvents) {
            commandBreakdown[event.commandName] = (commandBreakdown[event.commandName] || 0) + 1;
        }

        // Recent errors
        const recentErrors = this.memoryEvents
            .filter(e => !e.success && e.errorType)
            .slice(-10)
            .map(e => `${e.commandName}: ${e.errorType}`);

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
                return parseInt(await this.redis.get(`analytics:daily:${dateKey}`) || '0', 10);
            } else {
                const dayStart = new Date(date);
                dayStart.setHours(0, 0, 0, 0);
                const dayEnd = new Date(date);
                dayEnd.setHours(23, 59, 59, 999);

                return this.memoryEvents.filter(
                    e => e.timestamp >= dayStart.getTime() && e.timestamp <= dayEnd.getTime()
                ).length;
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
                this.memoryEvents = [];
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
