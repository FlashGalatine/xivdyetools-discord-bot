/**
 * Price Service for XIV Dye Tools Discord Bot
 *
 * Provides market price data from Universalis API with caching
 * Uses xivdyetools-core APIService with RedisCacheBackend
 *
 * @module services/price-service
 */

import { APIService, type Dye, type PriceData } from 'xivdyetools-core';
import { RedisCacheBackend, CACHE_TTL_BY_COMMAND } from './redis-cache.js';
import { logger } from '../utils/logger.js';

// Add price TTL to cache configuration (10 minutes for price data)
CACHE_TTL_BY_COMMAND['price'] = 600;

/**
 * Formatted price result
 */
export interface FormattedPrice {
  /** Raw price in Gil (null if unavailable) */
  gil: number | null;
  /** Formatted string (e.g., "1,234 Gil" or "Price unavailable") */
  formatted: string;
  /** Whether price data was successfully fetched */
  available: boolean;
}

/**
 * Price Service singleton
 * Manages Universalis API access with caching
 */
class PriceServiceClass {
  private apiService: APIService;
  private initialized: boolean = false;
  private apiAvailable: boolean = true;
  private lastApiCheck: number = 0;
  private readonly API_CHECK_INTERVAL = 60000; // Check API availability every minute

  constructor() {
    // Initialize APIService with Redis cache backend
    const cacheBackend = new RedisCacheBackend(600); // 10 minute default TTL for prices
    this.apiService = new APIService(cacheBackend);
  }

  /**
   * Initialize the service and check API availability
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const status = await this.apiService.getAPIStatus();
      this.apiAvailable = status.available;
      this.lastApiCheck = Date.now();

      if (this.apiAvailable) {
        logger.info(
          `PriceService initialized - Universalis API available (latency: ${status.latency}ms)`
        );
      } else {
        logger.warn('PriceService initialized - Universalis API unavailable');
      }
    } catch (error) {
      logger.warn('PriceService initialization: Could not check API status', error);
      this.apiAvailable = false;
    }

    this.initialized = true;
  }

  /**
   * Check if API is available (with caching)
   */
  private async checkApiAvailability(): Promise<boolean> {
    const now = Date.now();
    if (now - this.lastApiCheck < this.API_CHECK_INTERVAL) {
      return this.apiAvailable;
    }

    try {
      this.apiAvailable = await this.apiService.isAPIAvailable();
      this.lastApiCheck = now;
    } catch {
      this.apiAvailable = false;
    }

    return this.apiAvailable;
  }

  /**
   * Get price data for a dye
   * @param dye - The dye to get price for
   * @param dataCenterId - Optional data center (e.g., "Crystal", "Aether")
   * @returns Price data or null if unavailable
   */
  async getPriceData(dye: Dye, dataCenterId?: string): Promise<PriceData | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Quick check if API is known to be unavailable
    if (!(await this.checkApiAvailability())) {
      return null;
    }

    try {
      const priceData = await this.apiService.getPriceData(dye.itemID, undefined, dataCenterId);

      return priceData;
    } catch (error) {
      logger.debug(`Failed to fetch price for ${dye.name} (itemID: ${dye.itemID})`, error);
      return null;
    }
  }

  /**
   * Get formatted price for a dye
   * @param dye - The dye to get price for
   * @param dataCenterId - Optional data center
   * @returns Formatted price object
   */
  async getFormattedPrice(dye: Dye, dataCenterId?: string): Promise<FormattedPrice> {
    const priceData = await this.getPriceData(dye, dataCenterId);

    if (!priceData || priceData.currentMinPrice === 0) {
      return {
        gil: null,
        formatted: 'Price unavailable',
        available: false,
      };
    }

    return {
      gil: priceData.currentMinPrice,
      formatted: `${priceData.currentMinPrice.toLocaleString()} Gil`,
      available: true,
    };
  }

  /**
   * Get prices for multiple dyes (batched)
   * @param dyes - Array of dyes to get prices for
   * @param dataCenterId - Optional data center
   * @returns Map of dye ID to formatted price
   */
  async getPricesForDyes(dyes: Dye[], dataCenterId?: string): Promise<Map<number, FormattedPrice>> {
    const results = new Map<number, FormattedPrice>();

    // Fetch prices in parallel (APIService handles rate limiting internally)
    const promises = dyes.map(async (dye) => {
      const price = await this.getFormattedPrice(dye, dataCenterId);
      results.set(dye.id, price);
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Check if Universalis API is currently available
   */
  async isAvailable(): Promise<boolean> {
    return this.checkApiAvailability();
  }

  /**
   * Format a price number as Gil string
   * Static utility method
   */
  static formatGil(gil: number): string {
    return `${gil.toLocaleString()} Gil`;
  }
}

// Export singleton instance
export const priceService = new PriceServiceClass();

// Export class for testing
export { PriceServiceClass };
