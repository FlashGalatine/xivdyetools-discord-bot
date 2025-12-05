/**
 * Collection Storage Service
 * Redis-backed storage for user favorites and dye collections
 * Falls back to in-memory storage if Redis is unavailable
 */

import type Redis from 'ioredis';
import { getRedisClient } from './redis.js';
import { logger } from '../utils/logger.js';

// Types matching web app structure for cross-platform compatibility
export interface Collection {
  id: string;
  name: string;
  description?: string;
  dyes: number[]; // Dye IDs
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

// Limits matching web app
const MAX_FAVORITES = 20;
const MAX_COLLECTIONS = 50;
const MAX_DYES_PER_COLLECTION = 20;
const MAX_COLLECTION_NAME_LENGTH = 50;
const MAX_DESCRIPTION_LENGTH = 200;

// Redis key prefixes
const FAVORITES_PREFIX = 'xivdye:favorites:';
const COLLECTIONS_PREFIX = 'xivdye:collections:';

// In-memory fallback storage
const memoryFavorites = new Map<string, number[]>();
const memoryCollections = new Map<string, Collection[]>();

/**
 * Collection Storage Service
 * Provides CRUD operations for user favorites and collections
 */
export class CollectionStorage {
  private redis: Redis | null;

  constructor() {
    this.redis = getRedisClient();
    if (!this.redis) {
      logger.warn('CollectionStorage: Redis not available, using in-memory storage');
    }
  }

  // ============================================================
  // FAVORITES
  // ============================================================

  /**
   * Get user's favorite dyes
   */
  async getFavorites(userId: string): Promise<number[]> {
    try {
      if (this.redis) {
        const data = await this.redis.get(`${FAVORITES_PREFIX}${userId}`);
        if (data) {
          return JSON.parse(data) as number[];
        }
        return [];
      } else {
        return memoryFavorites.get(userId) || [];
      }
    } catch (error) {
      logger.error(`Failed to get favorites for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Set user's favorites (overwrites existing)
   */
  async setFavorites(userId: string, favorites: number[]): Promise<void> {
    try {
      // Enforce limit
      const limitedFavorites = favorites.slice(0, MAX_FAVORITES);

      if (this.redis) {
        await this.redis.set(`${FAVORITES_PREFIX}${userId}`, JSON.stringify(limitedFavorites));
      } else {
        memoryFavorites.set(userId, limitedFavorites);
      }
    } catch (error) {
      logger.error(`Failed to set favorites for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Add a dye to favorites
   * Returns true if added, false if already exists or limit reached
   */
  async addFavorite(userId: string, dyeId: number): Promise<{ success: boolean; reason?: string }> {
    const favorites = await this.getFavorites(userId);

    if (favorites.includes(dyeId)) {
      return { success: false, reason: 'alreadyFavorite' };
    }

    if (favorites.length >= MAX_FAVORITES) {
      return { success: false, reason: 'limitReached' };
    }

    favorites.push(dyeId);
    await this.setFavorites(userId, favorites);
    return { success: true };
  }

  /**
   * Remove a dye from favorites
   * Returns true if removed, false if not found
   */
  async removeFavorite(userId: string, dyeId: number): Promise<boolean> {
    const favorites = await this.getFavorites(userId);
    const index = favorites.indexOf(dyeId);

    if (index === -1) {
      return false;
    }

    favorites.splice(index, 1);
    await this.setFavorites(userId, favorites);
    return true;
  }

  /**
   * Check if a dye is favorited
   */
  async isFavorite(userId: string, dyeId: number): Promise<boolean> {
    const favorites = await this.getFavorites(userId);
    return favorites.includes(dyeId);
  }

  /**
   * Clear all favorites
   */
  async clearFavorites(userId: string): Promise<void> {
    try {
      if (this.redis) {
        await this.redis.del(`${FAVORITES_PREFIX}${userId}`);
      } else {
        memoryFavorites.delete(userId);
      }
    } catch (error) {
      logger.error(`Failed to clear favorites for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Check if user can add more favorites
   */
  async canAddFavorite(userId: string): Promise<boolean> {
    const favorites = await this.getFavorites(userId);
    return favorites.length < MAX_FAVORITES;
  }

  // ============================================================
  // COLLECTIONS
  // ============================================================

  /**
   * Get all collections for a user
   */
  async getCollections(userId: string): Promise<Collection[]> {
    try {
      if (this.redis) {
        const data = await this.redis.get(`${COLLECTIONS_PREFIX}${userId}`);
        if (data) {
          return JSON.parse(data) as Collection[];
        }
        return [];
      } else {
        return memoryCollections.get(userId) || [];
      }
    } catch (error) {
      logger.error(`Failed to get collections for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Save all collections for a user (overwrites existing)
   */
  private async setCollections(userId: string, collections: Collection[]): Promise<void> {
    try {
      if (this.redis) {
        await this.redis.set(`${COLLECTIONS_PREFIX}${userId}`, JSON.stringify(collections));
      } else {
        memoryCollections.set(userId, collections);
      }
    } catch (error) {
      logger.error(`Failed to set collections for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get a specific collection by name (case-insensitive)
   */
  async getCollection(userId: string, name: string): Promise<Collection | null> {
    const collections = await this.getCollections(userId);
    return collections.find((c) => c.name.toLowerCase() === name.toLowerCase()) || null;
  }

  /**
   * Create a new collection
   */
  async createCollection(
    userId: string,
    name: string,
    description?: string
  ): Promise<{ success: boolean; collection?: Collection; reason?: string }> {
    // Validate name
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length > MAX_COLLECTION_NAME_LENGTH) {
      return { success: false, reason: 'invalidName' };
    }

    // Validate description
    if (description && description.length > MAX_DESCRIPTION_LENGTH) {
      return { success: false, reason: 'descriptionTooLong' };
    }

    const collections = await this.getCollections(userId);

    // Check limit
    if (collections.length >= MAX_COLLECTIONS) {
      return { success: false, reason: 'limitReached' };
    }

    // Check for duplicate name
    if (collections.some((c) => c.name.toLowerCase() === trimmedName.toLowerCase())) {
      return { success: false, reason: 'nameExists' };
    }

    const now = new Date().toISOString();
    const collection: Collection = {
      id: crypto.randomUUID(),
      name: trimmedName,
      description: description?.trim(),
      dyes: [],
      createdAt: now,
      updatedAt: now,
    };

    collections.push(collection);
    await this.setCollections(userId, collections);

    return { success: true, collection };
  }

  /**
   * Delete a collection by name
   */
  async deleteCollection(userId: string, name: string): Promise<boolean> {
    const collections = await this.getCollections(userId);
    const index = collections.findIndex((c) => c.name.toLowerCase() === name.toLowerCase());

    if (index === -1) {
      return false;
    }

    collections.splice(index, 1);
    await this.setCollections(userId, collections);
    return true;
  }

  /**
   * Rename a collection
   */
  async renameCollection(
    userId: string,
    oldName: string,
    newName: string
  ): Promise<{ success: boolean; reason?: string }> {
    const trimmedNewName = newName.trim();
    if (!trimmedNewName || trimmedNewName.length > MAX_COLLECTION_NAME_LENGTH) {
      return { success: false, reason: 'invalidName' };
    }

    const collections = await this.getCollections(userId);
    const collection = collections.find((c) => c.name.toLowerCase() === oldName.toLowerCase());

    if (!collection) {
      return { success: false, reason: 'notFound' };
    }

    // Check if new name already exists (excluding current collection)
    if (
      collections.some(
        (c) => c.id !== collection.id && c.name.toLowerCase() === trimmedNewName.toLowerCase()
      )
    ) {
      return { success: false, reason: 'nameExists' };
    }

    collection.name = trimmedNewName;
    collection.updatedAt = new Date().toISOString();
    await this.setCollections(userId, collections);

    return { success: true };
  }

  /**
   * Add a dye to a collection
   */
  async addDyeToCollection(
    userId: string,
    collectionName: string,
    dyeId: number
  ): Promise<{ success: boolean; reason?: string }> {
    const collections = await this.getCollections(userId);
    const collection = collections.find(
      (c) => c.name.toLowerCase() === collectionName.toLowerCase()
    );

    if (!collection) {
      return { success: false, reason: 'notFound' };
    }

    if (collection.dyes.includes(dyeId)) {
      return { success: false, reason: 'alreadyInCollection' };
    }

    if (collection.dyes.length >= MAX_DYES_PER_COLLECTION) {
      return { success: false, reason: 'collectionFull' };
    }

    collection.dyes.push(dyeId);
    collection.updatedAt = new Date().toISOString();
    await this.setCollections(userId, collections);

    return { success: true };
  }

  /**
   * Remove a dye from a collection
   */
  async removeDyeFromCollection(
    userId: string,
    collectionName: string,
    dyeId: number
  ): Promise<{ success: boolean; reason?: string }> {
    const collections = await this.getCollections(userId);
    const collection = collections.find(
      (c) => c.name.toLowerCase() === collectionName.toLowerCase()
    );

    if (!collection) {
      return { success: false, reason: 'notFound' };
    }

    const index = collection.dyes.indexOf(dyeId);
    if (index === -1) {
      return { success: false, reason: 'dyeNotInCollection' };
    }

    collection.dyes.splice(index, 1);
    collection.updatedAt = new Date().toISOString();
    await this.setCollections(userId, collections);

    return { success: true };
  }

  /**
   * Check if user can create more collections
   */
  async canCreateCollection(userId: string): Promise<boolean> {
    const collections = await this.getCollections(userId);
    return collections.length < MAX_COLLECTIONS;
  }
}

// Singleton instance
export const collectionStorage = new CollectionStorage();

// Export limits for validation messages
export const COLLECTION_LIMITS = {
  MAX_FAVORITES,
  MAX_COLLECTIONS,
  MAX_DYES_PER_COLLECTION,
  MAX_COLLECTION_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
};
