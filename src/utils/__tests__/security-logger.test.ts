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
});
