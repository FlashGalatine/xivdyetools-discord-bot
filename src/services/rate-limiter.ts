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
     * Uses sliding window of 1 minute
     */
    async checkUserLimit(userId: string): Promise<RateLimitResult> {
        const limit = config.rateLimit.commandsPerMinute;
        const windowSeconds = 60; // 1 minute
        const key = `ratelimit:user:${userId}:minute`;

        return this.checkLimit(key, limit, windowSeconds);
    }

    /**
     * Check if user is rate limited (hourly limit)
     * Uses sliding window of 1 hour
     */
    async checkUserHourlyLimit(userId: string): Promise<RateLimitResult> {
        const limit = config.rateLimit.commandsPerHour;
        const windowSeconds = 3600; // 1 hour
        const key = `ratelimit:user:${userId}:hour`;

        return this.checkLimit(key, limit, windowSeconds);
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
            // On error, allow the request (fail open)
            return {
                allowed: true,
                limit,
                remaining: limit,
                resetAt: new Date(Date.now() + windowSeconds * 1000),
            };
        }
    }

    /**
     * Redis-based rate limiting using INCR and EXPIRE
     */
    private async checkLimitRedis(
        key: string,
        limit: number,
        windowSeconds: number
    ): Promise<RateLimitResult> {
        const now = Date.now();
        const resetAt = new Date(now + windowSeconds * 1000);

        // Increment counter
        const count = await this.redis!.incr(key);

        // Set expiration on first request
        if (count === 1) {
            await this.redis!.expire(key, windowSeconds);
        }

        const remaining = Math.max(0, limit - count);
        const allowed = count <= limit;

        const result: RateLimitResult = {
            allowed,
            limit,
            remaining,
            resetAt,
        };

        if (!allowed) {
            // Get TTL to calculate retry-after
            const ttl = await this.redis!.ttl(key);
            result.retryAfter = ttl > 0 ? ttl : windowSeconds;
        }

        return result;
    }

    /**
     * In-memory rate limiting fallback
     */
    private checkLimitMemory(
        key: string,
        limit: number,
        windowSeconds: number
    ): RateLimitResult {
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
     */
    cleanupMemoryStore(): void {
        if (this.redis) return; // Only needed for memory store

        const now = Date.now();
        for (const [key, entry] of this.memoryStore.entries()) {
            if (entry.resetAt < now) {
                this.memoryStore.delete(key);
            }
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

        // Clean up memory store every 5 minutes
        if (!getRedisClient()) {
            setInterval(() => {
                rateLimiterInstance?.cleanupMemoryStore();
            }, 5 * 60 * 1000);
        }
    }

    return rateLimiterInstance;
}
