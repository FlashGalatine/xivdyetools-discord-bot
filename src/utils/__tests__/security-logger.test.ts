/**
 * Tests for security logger
 * Per S-7: Security event logging tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { securityLogger, SecurityEventType } from '../security-logger.js';

// Mock Redis client
vi.mock('../../services/redis.js', () => ({
  getRedisClient: vi.fn(() => null), // Use in-memory fallback
}));

describe('Security Logger', () => {
  beforeEach(() => {
    // Clear any stored events between tests
    // Note: In a real implementation, we'd need a way to clear the memory store
  });

  it('should log rate limit exceeded events', async () => {
    await securityLogger.rateLimitExceeded('user123', 'match', 'per_minute', 'guild456');

    const stats = await securityLogger.getStats(1);
    expect(stats.byType[SecurityEventType.RATE_LIMIT_EXCEEDED]).toBeGreaterThan(0);
  });

  it('should log validation failure events', async () => {
    await securityLogger.validationFailure('user123', 'match', 'Invalid hex color', 'guild456');

    const stats = await securityLogger.getStats(1);
    expect(stats.byType[SecurityEventType.VALIDATION_FAILURE]).toBeGreaterThan(0);
  });

  it('should log suspicious activity events', async () => {
    await securityLogger.suspiciousActivity('user123', 'Repeated validation failures', {
      failureCount: 10,
    });

    const stats = await securityLogger.getStats(1);
    expect(stats.byType[SecurityEventType.SUSPICIOUS_ACTIVITY]).toBeGreaterThan(0);
    expect(stats.bySeverity.high).toBeGreaterThan(0);
  });

  it('should log abuse detected events', async () => {
    await securityLogger.abuseDetected('user123', 'rate_limit_abuse', {
      violations: 50,
    });

    const stats = await securityLogger.getStats(1);
    expect(stats.byType[SecurityEventType.ABUSE_DETECTED]).toBeGreaterThan(0);
    expect(stats.bySeverity.critical).toBeGreaterThan(0);
  });

  it('should retrieve user events', async () => {
    await securityLogger.rateLimitExceeded('user123', 'match', 'per_minute');
    await securityLogger.validationFailure('user123', 'match', 'Invalid input');

    const userEvents = await securityLogger.getUserEvents('user123', 10);
    expect(userEvents.length).toBeGreaterThan(0);
    expect(userEvents.some((e) => e.type === SecurityEventType.RATE_LIMIT_EXCEEDED)).toBe(true);
    expect(userEvents.some((e) => e.type === SecurityEventType.VALIDATION_FAILURE)).toBe(true);
  });

  it('should provide security statistics', async () => {
    await securityLogger.rateLimitExceeded('user1', 'match', 'per_minute');
    await securityLogger.validationFailure('user2', 'harmony', 'Invalid input');
    await securityLogger.suspiciousActivity('user3', 'Pattern detected');

    const stats = await securityLogger.getStats(1);
    expect(stats.total).toBeGreaterThan(0);
    expect(Object.keys(stats.bySeverity).length).toBeGreaterThan(0);
    expect(Object.keys(stats.byType).length).toBeGreaterThan(0);
  });

  it('should handle data access logging', async () => {
    await securityLogger.dataAccess('user123', 'dye_database', 'read', {
      dyeId: 42,
    });

    const stats = await securityLogger.getStats(1);
    expect(stats.byType[SecurityEventType.DATA_ACCESS]).toBeGreaterThan(0);
  });

  it('should log auth failure events', async () => {
    await securityLogger.authFailure('user123', 'Invalid token', {
      attemptCount: 3,
    }, 'guild456');

    const stats = await securityLogger.getStats(1);
    expect(stats.byType[SecurityEventType.AUTH_FAILURE]).toBeGreaterThan(0);
    expect(stats.bySeverity.high).toBeGreaterThan(0);
  });

  it('should track events by severity', async () => {
    await securityLogger.validationFailure('user1', 'match', 'Error');
    await securityLogger.rateLimitExceeded('user1', 'match', 'per_minute');
    await securityLogger.suspiciousActivity('user1', 'Suspicious');
    await securityLogger.abuseDetected('user1', 'abuse');

    const stats = await securityLogger.getStats(1);
    expect(stats.bySeverity.low).toBeGreaterThan(0);
    expect(stats.bySeverity.medium).toBeGreaterThan(0);
    expect(stats.bySeverity.high).toBeGreaterThan(0);
    expect(stats.bySeverity.critical).toBeGreaterThan(0);
  });

  it('should track events by type', async () => {
    await securityLogger.validationFailure('user1', 'cmd', 'Error');
    await securityLogger.rateLimitExceeded('user1', 'cmd', 'per_minute');
    await securityLogger.authFailure('user1', 'Invalid');

    const stats = await securityLogger.getStats(1);
    expect(Object.keys(stats.byType).length).toBeGreaterThanOrEqual(3);
  });

  it('should return empty stats when no events exist for timeframe', async () => {
    const stats = await securityLogger.getStats(0);
    expect(stats.total).toBe(0);
    expect(Object.keys(stats.bySeverity).length).toBe(0);
    expect(Object.keys(stats.byType).length).toBe(0);
  });

  it('should handle getUserEvents for non-existent user', async () => {
    const userEvents = await securityLogger.getUserEvents('nonexistent-user-xyz', 10);
    expect(userEvents).toEqual([]);
  });

  it('should limit getUserEvents results', async () => {
    // Log multiple events for a user
    for (let i = 0; i < 10; i++) {
      await securityLogger.validationFailure('user-limit-test', 'cmd', `Error ${i}`);
    }

    const userEvents = await securityLogger.getUserEvents('user-limit-test', 5);
    expect(userEvents.length).toBeLessThanOrEqual(5);
  });

  it('should log data access with write action', async () => {
    await securityLogger.dataAccess('user123', 'user_preferences', 'write', {
      field: 'language',
    });

    const stats = await securityLogger.getStats(1);
    expect(stats.byType[SecurityEventType.DATA_ACCESS]).toBeGreaterThan(0);
  });

  it('should log data access with delete action', async () => {
    await securityLogger.dataAccess('user123', 'user_preferences', 'delete', {
      field: 'all',
    });

    const stats = await securityLogger.getStats(1);
    expect(stats.byType[SecurityEventType.DATA_ACCESS]).toBeGreaterThan(0);
  });
});
