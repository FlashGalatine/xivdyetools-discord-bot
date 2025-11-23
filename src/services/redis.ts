/**
 * Redis client service
 * Provides singleton Redis connection for caching and rate limiting
 */

import Redis from 'ioredis';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

let redisClient: Redis | null = null;

/**
 * Get Redis client instance (singleton)
 * Returns null if Redis URL is not configured
 */
export function getRedisClient(): Redis | null {
    // If Redis URL is not configured, return null (use in-memory fallback)
    if (!config.redisUrl) {
        logger.debug('Redis URL not configured, using in-memory cache');
        return null;
    }

    // Return existing client if already connected
    if (redisClient) {
        return redisClient;
    }

    try {
        // Create new Redis client
        redisClient = new Redis(config.redisUrl, {
            maxRetriesPerRequest: 3,
            retryStrategy(times) {
                const delay = Math.min(times * 50, 2000);
                logger.warn(`Redis connection retry attempt ${times}, delay: ${delay}ms`);
                return delay;
            },
            reconnectOnError(err) {
                const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
                if (targetErrors.some((targetError) => err.message.includes(targetError))) {
                    logger.warn(`Redis reconnecting due to: ${err.message}`);
                    return true;
                }
                return false;
            },
        });

        // Event handlers
        redisClient.on('connect', () => {
            logger.info('Redis client connected');
        });

        redisClient.on('ready', () => {
            logger.info('Redis client ready');
        });

        redisClient.on('error', (err) => {
            logger.error('Redis client error:', err);
        });

        redisClient.on('close', () => {
            logger.warn('Redis connection closed');
        });

        redisClient.on('reconnecting', () => {
            logger.info('Redis client reconnecting...');
        });

        return redisClient;
    } catch (error) {
        logger.error('Failed to create Redis client:', error);
        return null;
    }
}

/**
 * Close Redis connection gracefully
 */
export async function closeRedis(): Promise<void> {
    if (redisClient) {
        logger.info('Closing Redis connection...');
        await redisClient.quit();
        redisClient = null;
        logger.info('Redis connection closed');
    }
}

/**
 * Check if Redis is available and connected
 */
export async function isRedisAvailable(): Promise<boolean> {
    const client = getRedisClient();
    if (!client) {
        return false;
    }

    try {
        await client.ping();
        return true;
    } catch (error) {
        logger.error('Redis ping failed:', error);
        return false;
    }
}
