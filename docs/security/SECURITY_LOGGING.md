# Security Event Logging

**Per S-7: Security Event Logging**

## Overview

The security logger provides centralized tracking of security-related events across the bot. All security events are logged with appropriate severity levels and stored for analysis.

## Event Types

### Rate Limit Exceeded
- **Type:** `RATE_LIMIT_EXCEEDED`
- **Severity:** Medium
- **When:** User exceeds per-minute, per-hour, or global rate limits
- **Details:** Command name, limit type

### Validation Failure
- **Type:** `VALIDATION_FAILURE`
- **Severity:** Low
- **When:** Input validation fails (malformed hex colors, invalid dye IDs, etc.)
- **Details:** Command name, validation error message

### Suspicious Activity
- **Type:** `SUSPICIOUS_ACTIVITY`
- **Severity:** High
- **When:** Patterns that may indicate abuse are detected
- **Details:** Reason, additional context

### Authentication Failure
- **Type:** `AUTH_FAILURE`
- **Severity:** High
- **When:** Authentication-related issues (though Discord handles auth)
- **Details:** Reason, additional context

### Data Access
- **Type:** `DATA_ACCESS`
- **Severity:** Low
- **When:** Data access events (optional audit trail)
- **Details:** Data type, action (read/write/delete)

### Abuse Detected
- **Type:** `ABUSE_DETECTED`
- **Severity:** Critical
- **When:** Confirmed abuse patterns are detected
- **Details:** Abuse type, additional context

## Usage

```typescript
import { securityLogger } from '../utils/security-logger.js';

// Log rate limit violation
await securityLogger.rateLimitExceeded(userId, commandName, 'per_minute', guildId);

// Log validation failure
await securityLogger.validationFailure(userId, commandName, errorMessage, guildId);

// Log suspicious activity
await securityLogger.suspiciousActivity(userId, reason, { additionalDetails }, guildId);

// Log abuse
await securityLogger.abuseDetected(userId, abuseType, { details }, guildId);
```

## Storage

### Redis (Production)
- Events stored in Redis with 30-day retention
- Per-user event history (last 100 events, 7-day retention)
- Daily aggregated statistics
- Efficient storage using Redis lists and counters

### Memory (Fallback)
- In-memory storage when Redis is unavailable
- Limited to last 500 events
- Suitable for development/testing

## Statistics

Retrieve security statistics:

```typescript
const stats = await securityLogger.getStats(7); // Last 7 days
// Returns: { total, bySeverity, byType }
```

## User Event History

Retrieve events for a specific user:

```typescript
const events = await securityLogger.getUserEvents(userId, 50); // Last 50 events
```

## Integration Points

Security logging is integrated into:

1. **Input Validation** (`src/index.ts`)
   - Logs validation failures

2. **Rate Limiting** (`src/index.ts`)
   - Logs rate limit violations (per-minute, per-hour, global)

3. **Command Execution** (via CommandBase)
   - Can be extended to log command-specific security events

## Best Practices

1. **Severity Levels**
   - Use `critical` for confirmed abuse
   - Use `high` for suspicious patterns
   - Use `medium` for rate limit violations
   - Use `low` for routine validation failures

2. **Details**
   - Include relevant context (command name, error messages)
   - Avoid logging sensitive data (tokens, passwords)
   - Use structured data for easier analysis

3. **Performance**
   - Security logging is async and non-blocking
   - Failures in logging don't affect command execution
   - Events are batched in Redis pipelines

## Monitoring

Security events can be monitored by:

1. **Console Logs**
   - All security events are logged to console with appropriate levels
   - Color-coded by severity

2. **Redis Queries**
   - Query `security:events:YYYY-MM-DD` for daily events
   - Query `security:user:USER_ID` for user-specific events
   - Query `security:count:SEVERITY:YYYY-MM-DD` for severity counts

3. **Statistics API**
   - Use `getStats()` for aggregated statistics
   - Use `getUserEvents()` for user-specific history

## Future Enhancements

- Alert webhooks for critical events
- Automated abuse detection patterns
- Integration with external security monitoring tools
- Dashboard for security event visualization











