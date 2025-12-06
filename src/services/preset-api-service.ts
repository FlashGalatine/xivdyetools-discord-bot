/**
 * Preset API Service
 * Communicates with the xivdyetools-worker API for community presets
 */

import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import type { PresetCategory } from 'xivdyetools-core';

// ============================================
// LOCAL TYPE DEFINITIONS
// These mirror the types from xivdyetools-core.
// Once core v1.3.6+ is published, these can be imported directly.
// ============================================

export type PresetStatus = 'pending' | 'approved' | 'rejected' | 'flagged';

export interface CommunityPreset {
  id: string;
  name: string;
  description: string;
  category_id: PresetCategory;
  dyes: number[];
  tags: string[];
  author_discord_id: string | null;
  author_name: string | null;
  vote_count: number;
  status: PresetStatus;
  is_curated: boolean;
  created_at: string;
  updated_at: string;
}

export interface PresetSubmission {
  name: string;
  description: string;
  category_id: PresetCategory;
  dyes: number[];
  tags: string[];
  author_discord_id: string;
  author_name: string;
}

export interface PresetListResponse {
  presets: CommunityPreset[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

export interface PresetSubmitResponse {
  success: boolean;
  preset?: CommunityPreset;
  duplicate?: CommunityPreset;
  vote_added?: boolean;
  moderation_status?: 'approved' | 'pending';
}

export interface VoteResponse {
  success: boolean;
  new_vote_count: number;
  already_voted?: boolean;
}

export interface PresetFilters {
  category?: PresetCategory;
  search?: string;
  status?: PresetStatus;
  sort?: 'popular' | 'recent' | 'name';
  page?: number;
  limit?: number;
  is_curated?: boolean;
}

/**
 * API error with status code and message
 */
export class PresetAPIError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'PresetAPIError';
  }
}

/**
 * Preset API Service
 * Handles all communication with the community presets Worker API
 */
class PresetAPIService {
  private readonly baseUrl: string;
  private readonly apiSecret: string;
  private readonly enabled: boolean;

  constructor() {
    this.baseUrl = config.communityPresets.apiUrl;
    this.apiSecret = config.communityPresets.apiSecret;
    this.enabled = config.communityPresets.enabled;
  }

  /**
   * Check if the service is enabled and configured
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Make an authenticated request to the API
   */
  private async request<T>(
    method: string,
    path: string,
    options: {
      body?: unknown;
      userDiscordId?: string;
      userName?: string;
    } = {}
  ): Promise<T> {
    if (!this.enabled) {
      throw new PresetAPIError(503, 'Community presets API is not configured');
    }

    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiSecret}`,
    };

    if (options.userDiscordId) {
      headers['X-User-Discord-ID'] = options.userDiscordId;
    }
    if (options.userName) {
      headers['X-User-Discord-Name'] = options.userName;
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      const data = (await response.json()) as T & { message?: string; error?: string };

      if (!response.ok) {
        throw new PresetAPIError(
          response.status,
          data.message || data.error || 'API request failed',
          data
        );
      }

      return data;
    } catch (error) {
      if (error instanceof PresetAPIError) {
        throw error;
      }
      logger.error('Preset API request failed:', error);
      throw new PresetAPIError(500, 'Failed to communicate with preset API');
    }
  }

  // ============================================
  // PUBLIC ENDPOINTS
  // ============================================

  /**
   * Get presets with filtering and pagination
   */
  async getPresets(filters: PresetFilters = {}): Promise<PresetListResponse> {
    const params = new URLSearchParams();
    if (filters.category) params.set('category', filters.category);
    if (filters.search) params.set('search', filters.search);
    if (filters.status) params.set('status', filters.status);
    if (filters.sort) params.set('sort', filters.sort);
    if (filters.page) params.set('page', String(filters.page));
    if (filters.limit) params.set('limit', String(filters.limit));
    if (filters.is_curated !== undefined) {
      params.set('is_curated', String(filters.is_curated));
    }

    const query = params.toString();
    const path = `/api/v1/presets${query ? `?${query}` : ''}`;

    return this.request<PresetListResponse>('GET', path);
  }

  /**
   * Get featured presets (top 10 by votes)
   */
  async getFeaturedPresets(): Promise<CommunityPreset[]> {
    const response = await this.request<{ presets: CommunityPreset[] }>(
      'GET',
      '/api/v1/presets/featured'
    );
    return response.presets;
  }

  /**
   * Get a single preset by ID
   */
  async getPreset(id: string): Promise<CommunityPreset | null> {
    try {
      return await this.request<CommunityPreset>('GET', `/api/v1/presets/${id}`);
    } catch (error) {
      if (error instanceof PresetAPIError && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get all categories with preset counts
   */
  async getCategories(): Promise<
    Array<{
      id: string;
      name: string;
      description: string;
      icon: string | null;
      is_curated: boolean;
      preset_count: number;
    }>
  > {
    const response = await this.request<{
      categories: Array<{
        id: string;
        name: string;
        description: string;
        icon: string | null;
        is_curated: boolean;
        preset_count: number;
      }>;
    }>('GET', '/api/v1/categories');
    return response.categories;
  }

  // ============================================
  // AUTHENTICATED ENDPOINTS
  // ============================================

  /**
   * Submit a new preset
   */
  async submitPreset(
    submission: Omit<PresetSubmission, 'author_discord_id' | 'author_name'>,
    userDiscordId: string,
    userName: string
  ): Promise<PresetSubmitResponse> {
    return this.request<PresetSubmitResponse>('POST', '/api/v1/presets', {
      body: submission,
      userDiscordId,
      userName,
    });
  }

  /**
   * Vote for a preset
   */
  async voteForPreset(presetId: string, userDiscordId: string): Promise<VoteResponse> {
    return this.request<VoteResponse>('POST', `/api/v1/votes/${presetId}`, {
      userDiscordId,
    });
  }

  /**
   * Remove vote from a preset
   */
  async removeVote(presetId: string, userDiscordId: string): Promise<VoteResponse> {
    return this.request<VoteResponse>('DELETE', `/api/v1/votes/${presetId}`, {
      userDiscordId,
    });
  }

  /**
   * Check if user has voted for a preset
   */
  async hasVoted(presetId: string, userDiscordId: string): Promise<boolean> {
    const response = await this.request<{ has_voted: boolean }>(
      'GET',
      `/api/v1/votes/${presetId}/check`,
      { userDiscordId }
    );
    return response.has_voted;
  }

  // ============================================
  // MODERATOR ENDPOINTS
  // ============================================

  /**
   * Get presets pending moderation
   */
  async getPendingPresets(moderatorDiscordId: string): Promise<CommunityPreset[]> {
    const response = await this.request<{ presets: CommunityPreset[] }>(
      'GET',
      '/api/v1/moderation/pending',
      { userDiscordId: moderatorDiscordId }
    );
    return response.presets;
  }

  /**
   * Approve a preset
   */
  async approvePreset(
    presetId: string,
    moderatorDiscordId: string,
    reason?: string
  ): Promise<CommunityPreset> {
    const response = await this.request<{ preset: CommunityPreset }>(
      'PATCH',
      `/api/v1/moderation/${presetId}/status`,
      {
        body: { status: 'approved', reason },
        userDiscordId: moderatorDiscordId,
      }
    );
    return response.preset;
  }

  /**
   * Reject a preset
   */
  async rejectPreset(
    presetId: string,
    moderatorDiscordId: string,
    reason: string
  ): Promise<CommunityPreset> {
    const response = await this.request<{ preset: CommunityPreset }>(
      'PATCH',
      `/api/v1/moderation/${presetId}/status`,
      {
        body: { status: 'rejected', reason },
        userDiscordId: moderatorDiscordId,
      }
    );
    return response.preset;
  }

  /**
   * Flag a preset for review
   */
  async flagPreset(
    presetId: string,
    moderatorDiscordId: string,
    reason: string
  ): Promise<CommunityPreset> {
    const response = await this.request<{ preset: CommunityPreset }>(
      'PATCH',
      `/api/v1/moderation/${presetId}/status`,
      {
        body: { status: 'flagged', reason },
        userDiscordId: moderatorDiscordId,
      }
    );
    return response.preset;
  }

  /**
   * Get moderation history for a preset
   */
  async getModerationHistory(
    presetId: string,
    moderatorDiscordId: string
  ): Promise<
    Array<{
      id: string;
      preset_id: string;
      moderator_discord_id: string;
      action: string;
      reason: string | null;
      created_at: string;
    }>
  > {
    const response = await this.request<{
      history: Array<{
        id: string;
        preset_id: string;
        moderator_discord_id: string;
        action: string;
        reason: string | null;
        created_at: string;
      }>;
    }>('GET', `/api/v1/moderation/${presetId}/history`, {
      userDiscordId: moderatorDiscordId,
    });
    return response.history;
  }

  /**
   * Get moderation statistics
   */
  async getModerationStats(moderatorDiscordId: string): Promise<{
    pending: number;
    approved: number;
    rejected: number;
    flagged: number;
    actions_last_week: number;
  }> {
    const response = await this.request<{
      stats: {
        pending: number;
        approved: number;
        rejected: number;
        flagged: number;
        actions_last_week: number;
      };
    }>('GET', '/api/v1/moderation/stats', {
      userDiscordId: moderatorDiscordId,
    });
    return response.stats;
  }
}

// Export singleton instance
export const presetAPIService = new PresetAPIService();
