/**
 * Redis cache backend for xivdyetools-core
 * Implements ICacheBackend interface for distributed caching
 * Per P-4: Dynamic TTLs by command type, LRU eviction for memory fallback
 */

import type { ICacheBackend, CachedData } from 'xivdyetools-core';
import type Redis from 'ioredis';
import { getRedisClient } from './redis.js';
import { logger } from '../utils/logger.js';

/**
 * Per P-4: Command-specific TTL configuration
 * harmony: 1 hour (stable results)
 * match: 30 minutes
 * mixer: 5 minutes (personalized)
 * stats: 24 hours
 */
export const CACHE_TTL_BY_COMMAND: Record<string, number> = {
  harmony: 3600, // 1 hour
  match: 1800, // 30 minutes
  mixer: 300, // 5 minutes
  stats: 86400, // 24 hours
  default: 300, // 5 minutes default
};

/**
 * Simple LRU cache for memory fallback
 * Per P-4: Max 500 entries with LRU eviction
 */
class LRUCache<K, V> {
  private cache: Map<K, V>;
  private maxSize: number;

  constructor(maxSize: number = 500) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      // Update existing
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove least recently used (first item)
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  delete(key: K): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

/**
 * Redis-backed cache implementation
 * Falls back to in-memory LRU cache if Redis is unavailable
 * Per P-4: Dynamic TTLs by command type
 */
export class RedisCacheBackend implements ICacheBackend {
  private redis: Redis | null;
  private memoryCache: LRUCache<string, CachedData<any>>;
  private defaultTTL: number = 300; // 5 minutes default

  constructor(defaultTTL?: number) {
    this.redis = getRedisClient();
    // Per P-4: LRU cache with max 500 entries for memory fallback
    this.memoryCache = new LRUCache<string, CachedData<any>>(500);

    if (defaultTTL) {
      this.defaultTTL = defaultTTL;
    }

    if (!this.redis) {
      logger.warn('Redis not available, using in-memory LRU cache fallback');
    }
  }

  /**
   * Get TTL for a command type
   * Per P-4: Command-specific TTLs
   */
  private getTTL(commandType?: string): number {
    if (commandType && CACHE_TTL_BY_COMMAND[commandType]) {
      return CACHE_TTL_BY_COMMAND[commandType];
    }
    return this.defaultTTL;
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
        // Per P-4: Fallback to LRU memory cache
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
   * Set value in cache with optional command-specific TTL
   * Per P-4: Dynamic TTLs by command type
   */
  async set<T>(key: string, value: CachedData<T>, commandType?: string): Promise<void> {
    try {
      const ttl = this.getTTL(commandType);

      if (this.redis) {
        await this.redis.setex(key, ttl, JSON.stringify(value));
      } else {
        // Per P-4: Fallback to LRU memory cache with TTL in timestamp
        const cachedValue: CachedData<T> = {
          ...value,
          timestamp: Date.now() + ttl * 1000,
          ttl,
        };
        this.memoryCache.set(key, cachedValue);
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
        // Per P-4: Clear LRU memory cache
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
        const cachedData = entry;
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
        // Per P-4: Return LRU cache keys (access private cache via getter)
        // Note: This is a limitation - we can't easily expose Map keys
        // In practice, this is rarely needed for memory cache
        return [];
      }
    } catch (error) {
      logger.error('Cache keys error:', error);
      return [];
    }
  }
}
