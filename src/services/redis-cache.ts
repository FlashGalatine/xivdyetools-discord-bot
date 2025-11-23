/**
 * Redis cache backend for xivdyetools-core
 * Implements ICacheBackend interface for distributed caching
 */

import type { ICacheBackend, CachedData } from 'xivdyetools-core';
import type Redis from 'ioredis';
import { getRedisClient } from './redis.js';
import { logger } from '../utils/logger.js';

/**
 * Redis-backed cache implementation
 * Falls back to in-memory cache if Redis is unavailable
 */
export class RedisCacheBackend implements ICacheBackend {
    private redis: Redis | null;
    private memoryCache: Map<string, any>;
    private defaultTTL: number = 300; // 5 minutes default

    constructor(defaultTTL?: number) {
        this.redis = getRedisClient();
        this.memoryCache = new Map();

        if (defaultTTL) {
            this.defaultTTL = defaultTTL;
        }

        if (!this.redis) {
            logger.warn('Redis not available, using in-memory cache fallback');
        }
    }

    /**
     * Get value from cache
     */
    async get<T>(key: string): Promise<CachedData<T> | null> {
        try {
            if (this.redis) {
                const value = await this.redis.get(key);
                if (value) {
                    return JSON.parse(value) as CachedData<T>;
                }
                return null;
            } else {
                // Fallback to memory cache
                const entry = this.memoryCache.get(key);
                if (!entry) return null;

                // Check expiration (CachedData has timestamp property)
                const cachedData = entry as CachedData<T>;
                if (cachedData.timestamp && cachedData.timestamp < Date.now()) {
                    this.memoryCache.delete(key);
                    return null;
                }

                return cachedData;
            }
        } catch (error) {
            logger.error(`Cache get error for key ${key}:`, error);
            return null;
        }
    }

    /**
     * Set value in cache
     */
    async set<T>(key: string, value: CachedData<T>): Promise<void> {
        try {
            if (this.redis) {
                await this.redis.setex(key, this.defaultTTL, JSON.stringify(value));
            } else {
                // Fallback to memory cache
                this.memoryCache.set(key, value);
            }
        } catch (error) {
            logger.error(`Cache set error for key ${key}:`, error);
        }
    }

    /**
     * Delete value from cache
     */
    async delete(key: string): Promise<void> {
        try {
            if (this.redis) {
                await this.redis.del(key);
            } else {
                this.memoryCache.delete(key);
            }
        } catch (error) {
            logger.error(`Cache delete error for key ${key}:`, error);
        }
    }

    /**
     * Clear all cache entries
     */
    async clear(): Promise<void> {
        try {
            if (this.redis) {
                // Only clear keys with our prefix to avoid affecting other data
                const keys = await this.redis.keys('xivdye:*');
                if (keys.length > 0) {
                    await this.redis.del(...keys);
                }
            } else {
                this.memoryCache.clear();
            }
        } catch (error) {
            logger.error('Cache clear error:', error);
        }
    }

    /**
     * Check if cache has key
     */
    async has(key: string): Promise<boolean> {
        try {
            if (this.redis) {
                const exists = await this.redis.exists(key);
                return exists === 1;
            } else {
                const entry = this.memoryCache.get(key);
                if (!entry) return false;

                // Check expiration
                const cachedData = entry as CachedData<any>;
                if (cachedData.timestamp && cachedData.timestamp < Date.now()) {
                    this.memoryCache.delete(key);
                    return false;
                }

                return true;
            }
        } catch (error) {
            logger.error(`Cache has error for key ${key}:`, error);
            return false;
        }
    }

    /**
     * Get all cache keys
     */
    async keys(): Promise<string[]> {
        try {
            if (this.redis) {
                return await this.redis.keys('*');
            } else {
                return Array.from(this.memoryCache.keys());
            }
        } catch (error) {
            logger.error('Cache keys error:', error);
            return [];
        }
    }
}
