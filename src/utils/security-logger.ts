/**
 * Security event logging
 * Per S-7: Centralized security incident tracking
 */

import type Redis from 'ioredis';
import { getRedisClient } from '../services/redis.js';
import { logger } from './logger.js';

/**
 * Security event types
 */
export enum SecurityEventType {
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  VALIDATION_FAILURE = 'validation_failure',
  AUTH_FAILURE = 'auth_failure',
  DATA_ACCESS = 'data_access',
  ABUSE_DETECTED = 'abuse_detected',
}

/**
 * Security event data
 */
export interface SecurityEvent {
  type: SecurityEventType;
  userId: string;
  guildId?: string;
  commandName?: string;
  timestamp: number;
  details?: Record<string, unknown>;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Security logger for tracking security incidents
 * Per S-7: Centralized security event logging
 */
class SecurityLogger {
  private redis: Redis | null;
  private memoryEvents: SecurityEvent[];
  private maxMemoryEvents: number = 500;

  constructor() {
    this.redis = getRedisClient();
    this.memoryEvents = [];

    if (!this.redis) {
      logger.debug('Security logger using in-memory storage');
    }
  }

  /**
   * Log a security event
   * Per S-7: Stores events in Redis or memory
   */
  private async logEvent(event: SecurityEvent): Promise<void> {
    try {
      // Always log to console with appropriate level
      const logMessage = `[SECURITY] ${event.type} - User: ${event.userId}, Command: ${event.commandName || 'N/A'}`;
      const logDetails = {
        type: event.type,
        userId: event.userId,
        guildId: event.guildId,
        commandName: event.commandName,
        severity: event.severity,
        details: event.details,
      };

      switch (event.severity) {
        case 'critical':
        case 'high':
          logger.error(logMessage, logDetails);
          break;
        case 'medium':
          logger.warn(logMessage, logDetails);
          break;
        case 'low':
          logger.info(logMessage, logDetails);
          break;
      }

      // Store in Redis or memory
      if (this.redis) {
        await this.storeEventRedis(event);
      } else {
        this.storeEventMemory(event);
      }
    } catch (error) {
      logger.error('Security event logging error:', error);
    }
  }

  /**
   * Store security event in Redis
   */
  private async storeEventRedis(event: SecurityEvent): Promise<void> {
    const dateKey = new Date(event.timestamp).toISOString().split('T')[0]; // YYYY-MM-DD
    const pipeline = this.redis!.pipeline();

    // Store event in list (last 1000 events)
    const eventKey = `security:events:${dateKey}`;
    pipeline.lpush(eventKey, JSON.stringify(event));
    pipeline.ltrim(eventKey, 0, 999); // Keep last 1000 events per day
    pipeline.expire(eventKey, 30 * 24 * 60 * 60); // 30 days

    // Increment counters by severity
    pipeline.incr(`security:count:${event.severity}:${dateKey}`);
    pipeline.expire(`security:count:${event.severity}:${dateKey}`, 30 * 24 * 60 * 60);

    // Track per-user security events (last 100 per user)
    const userKey = `security:user:${event.userId}`;
    pipeline.lpush(userKey, JSON.stringify(event));
    pipeline.ltrim(userKey, 0, 99);
    pipeline.expire(userKey, 7 * 24 * 60 * 60); // 7 days

    // Track event type counts
    pipeline.incr(`security:type:${event.type}:${dateKey}`);
    pipeline.expire(`security:type:${event.type}:${dateKey}`, 30 * 24 * 60 * 60);

    await pipeline.exec();
  }

  /**
   * Store security event in memory
   */
  private storeEventMemory(event: SecurityEvent): void {
    this.memoryEvents.push(event);
    if (this.memoryEvents.length > this.maxMemoryEvents) {
      // Remove oldest events
      this.memoryEvents.shift();
    }
  }

  /**
   * Log rate limit violation
   * Per S-7: Tracks rate limit exceedances
   */
  async rateLimitExceeded(
    userId: string,
    commandName: string,
    limitType: 'per_minute' | 'per_hour' | 'global',
    guildId?: string
  ): Promise<void> {
    await this.logEvent({
      type: SecurityEventType.RATE_LIMIT_EXCEEDED,
      userId,
      guildId,
      commandName,
      timestamp: Date.now(),
      details: {
        limitType,
      },
      severity: 'medium',
    });
  }

  /**
   * Log suspicious activity
   * Per S-7: Tracks patterns that may indicate abuse
   */
  async suspiciousActivity(
    userId: string,
    reason: string,
    details?: Record<string, unknown>,
    guildId?: string
  ): Promise<void> {
    await this.logEvent({
      type: SecurityEventType.SUSPICIOUS_ACTIVITY,
      userId,
      guildId,
      timestamp: Date.now(),
      details: {
        reason,
        ...details,
      },
      severity: 'high',
    });
  }

  /**
   * Log validation failure
   * Per S-7: Tracks input validation failures
   */
  async validationFailure(
    userId: string,
    commandName: string,
    validationError: string,
    guildId?: string
  ): Promise<void> {
    await this.logEvent({
      type: SecurityEventType.VALIDATION_FAILURE,
      userId,
      guildId,
      commandName,
      timestamp: Date.now(),
      details: {
        validationError,
      },
      severity: 'low',
    });
  }

  /**
   * Log authentication failure
   * Per S-7: Tracks auth-related issues (though Discord handles auth)
   */
  async authFailure(
    userId: string,
    reason: string,
    details?: Record<string, unknown>,
    guildId?: string
  ): Promise<void> {
    await this.logEvent({
      type: SecurityEventType.AUTH_FAILURE,
      userId,
      guildId,
      timestamp: Date.now(),
      details: {
        reason,
        ...details,
      },
      severity: 'high',
    });
  }

  /**
   * Log data access (if needed for audit trail)
   * Per S-7: Optional data access logging
   */
  async dataAccess(
    userId: string,
    dataType: string,
    action: 'read' | 'write' | 'delete',
    details?: Record<string, unknown>,
    guildId?: string
  ): Promise<void> {
    await this.logEvent({
      type: SecurityEventType.DATA_ACCESS,
      userId,
      guildId,
      timestamp: Date.now(),
      details: {
        dataType,
        action,
        ...details,
      },
      severity: 'low',
    });
  }

  /**
   * Log abuse detection
   * Per S-7: Tracks detected abuse patterns
   */
  async abuseDetected(
    userId: string,
    abuseType: string,
    details?: Record<string, unknown>,
    guildId?: string
  ): Promise<void> {
    await this.logEvent({
      type: SecurityEventType.ABUSE_DETECTED,
      userId,
      guildId,
      timestamp: Date.now(),
      details: {
        abuseType,
        ...details,
      },
      severity: 'critical',
    });
  }

  /**
   * Get recent security events for a user
   */
  async getUserEvents(userId: string, limit: number = 50): Promise<SecurityEvent[]> {
    try {
      if (this.redis) {
        const userKey = `security:user:${userId}`;
        const events = await this.redis.lrange(userKey, 0, limit - 1);
        return events.map((event) => JSON.parse(event) as SecurityEvent);
      } else {
        return this.memoryEvents
          .filter((event) => event.userId === userId)
          .slice(-limit)
          .reverse();
      }
    } catch (error) {
      logger.error('Error retrieving user security events:', error);
      return [];
    }
  }

  /**
   * Get security event statistics
   */
  async getStats(days: number = 7): Promise<{
    total: number;
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
  }> {
    try {
      if (this.redis) {
        const stats = {
          total: 0,
          bySeverity: {} as Record<string, number>,
          byType: {} as Record<string, number>,
        };

        const today = new Date();
        for (let i = 0; i < days; i++) {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          const dateKey = date.toISOString().split('T')[0];

          // Count by severity
          for (const severity of ['low', 'medium', 'high', 'critical']) {
            const count = await this.redis.get(`security:count:${severity}:${dateKey}`);
            if (count) {
              stats.bySeverity[severity] = (stats.bySeverity[severity] || 0) + parseInt(count, 10);
              stats.total += parseInt(count, 10);
            }
          }

          // Count by type
          for (const type of Object.values(SecurityEventType)) {
            const count = await this.redis.get(`security:type:${type}:${dateKey}`);
            if (count) {
              stats.byType[type] = (stats.byType[type] || 0) + parseInt(count, 10);
            }
          }
        }

        return stats;
      } else {
        // Memory fallback
        const recentEvents = this.memoryEvents.filter(
          (event) => event.timestamp > Date.now() - days * 24 * 60 * 60 * 1000
        );

        const stats = {
          total: recentEvents.length,
          bySeverity: {} as Record<string, number>,
          byType: {} as Record<string, number>,
        };

        for (const event of recentEvents) {
          stats.bySeverity[event.severity] = (stats.bySeverity[event.severity] || 0) + 1;
          stats.byType[event.type] = (stats.byType[event.type] || 0) + 1;
        }

        return stats;
      }
    } catch (error) {
      logger.error('Error retrieving security stats:', error);
      return { total: 0, bySeverity: {}, byType: {} };
    }
  }
}

// Export singleton instance
export const securityLogger = new SecurityLogger();
