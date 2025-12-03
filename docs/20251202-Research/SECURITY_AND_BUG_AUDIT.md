# XIV Dye Tools Discord Bot - Security & Bug Audit Report

**Date:** December 2, 2025  
**Auditor:** AI Code Review  
**Scope:** Full source code review of xivdyetools-discord-bot

---

## Executive Summary

The Discord bot demonstrates a **strong security posture** overall with several proactive security measures already in place. However, this audit has identified several potential vulnerabilities, bugs, and areas for improvement that range from low to medium severity.

### Security Features Already Implemented (Positive Findings)

1. **Rate Limiting (S-6)** - Per-user and global rate limiting with command-specific limits
2. **Input Validation (S-1)** - Comprehensive validation with sanitization
3. **SSRF Protection** - URL validation restricts to Discord CDN domains only
4. **Image Security (S-2)** - Multi-layer validation including size, dimensions, pixel count, and format whitelisting
5. **Secret Redaction (S-5)** - Logger automatically redacts sensitive keys
6. **Security Event Logging (S-7)** - Centralized security incident tracking
7. **TLS Support (S-9)** - Redis connections support TLS encryption
8. **Error Handling** - Typed error classes prevent information leakage

---

## Critical Issues (Severity: High)

### 1. Health Endpoint Information Disclosure

**File:** `src/index.ts` (lines 37-45)

**Issue:** The health check endpoint exposes potentially sensitive operational metrics including guild count and user cache size without authentication.

```typescript
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: uptimeSeconds,
    guilds: client.guilds?.cache.size || 0,
    users: client.users?.cache.size || 0,
    commands: client.commands?.size || 0,
  });
});
```

**Risk:** Attackers can enumerate bot deployment status and scale to determine attack timing or identify high-value targets.

**Recommendation:**
- Add authentication token for health endpoint
- Or reduce exposed information to just `status` and `uptime`
- Consider IP whitelisting for health checks

---

### 2. Stats Command Hardcoded User ID

**File:** `src/commands/stats.ts` (line 18)

**Issue:** The stats command is restricted by hardcoding a specific Discord user ID:

```typescript
if (interaction.user.id !== '110457699291906048') {
  await interaction.reply({
    content: `⛔ ${t('errors.noPermission')}`,
    ephemeral: true,
  });
  return;
}
```

**Risk:** 
- Hardcoded credentials are poor practice
- If the account is compromised or changes, the code must be modified
- No audit trail for who can access stats

**Recommendation:**
- Move authorized user IDs to environment variables
- Support multiple authorized users via comma-separated list
- Consider implementing a role-based access control system

---

## Medium Severity Issues

### 3. Race Condition in Worker Pool Worker Selection

**File:** `src/utils/worker-pool.ts` (lines 80-95)

**Issue:** The `getAvailableWorker()` method checks worker availability without proper synchronization:

```typescript
private getAvailableWorker(): Worker | null {
  for (const worker of this.workers) {
    if (worker.threadId !== 0) {
      return worker;  // Worker could become unavailable between check and use
    }
  }
  // ...
}
```

**Risk:** Under high load, multiple tasks could be assigned to the same worker, or workers could be selected that are about to exit.

**Recommendation:**
- Track worker busy state explicitly with a Set or Map
- Mark workers as busy before returning from `getAvailableWorker()`

---

### 4. Incomplete SSRF Protection for IPv6

**File:** `src/utils/url-validator.ts` (lines 27-35)

**Issue:** The BLOCKED_IP_PATTERNS only includes limited IPv6 patterns:

```typescript
const BLOCKED_IP_PATTERNS = [
  // ...
  /^::1$/,
  /^0:0:0:0:0:0:0:1$/,
  // Missing: ::ffff:127.0.0.1, fe80::, fc00::, fd00::, etc.
];
```

**Risk:** IPv6 loopback addresses in alternative formats and other internal IPv6 ranges could bypass SSRF protection.

**Recommendation:** Add comprehensive IPv6 patterns:
```typescript
/^::ffff:127\./,
/^::ffff:10\./,
/^::ffff:172\.(1[6-9]|2[0-9]|3[0-1])\./,
/^::ffff:192\.168\./,
/^fe80:/i,  // Link-local
/^fc00:/i,  // Unique local
/^fd[0-9a-f]{2}:/i,  // Unique local
```

---

### 5. Memory Store Cleanup Interval Not Cleared on Shutdown

**File:** `src/services/rate-limiter.ts` (lines 193-200)

**Issue:** The cleanup interval is set but never cleared during graceful shutdown:

```typescript
setInterval(() => {
  rateLimiterInstance?.cleanupMemoryStore();
}, MEMORY_STORE_CONFIG.cleanupIntervalMs);
```

**Risk:** Can prevent clean process exit during graceful shutdown.

**Recommendation:** Store interval ID and clear it in a shutdown handler:
```typescript
let cleanupInterval: NodeJS.Timeout | null = null;
// ... in getRateLimiter() ...
cleanupInterval = setInterval(...);
// ... add cleanup function ...
export function stopRateLimiter(): void {
  if (cleanupInterval) clearInterval(cleanupInterval);
}
```

---

### 6. Potential Type Confusion in validateDyeId

**File:** `src/utils/validators.ts` (lines 52-74)

**Issue:** The bounds check uses `> 200` which is arbitrary and may become outdated:

```typescript
if (id > 200) {
  return {
    success: false,
    error: t('errors.dyeIdOutOfRange'),
  };
}
```

**Risk:** Future dye additions could exceed this limit, causing false negatives. The current limit is not based on actual data.

**Recommendation:**
- Derive max ID from actual database: `Math.max(...validDyeIds) + headroom`
- Or use strict validation by default

---

## Low Severity Issues

### 7. Emoji Service Missing Null Check

**File:** `src/services/emoji-service.ts` (lines 25-27)

**Issue:** Empty conditional block when `client.application` is null:

```typescript
if (!client.application) {
  // Wait for application to be ready if needed, though usually ready by now
}
```

**Risk:** If `client.application` is null, no emojis are loaded but no error is thrown.

**Recommendation:** Either add retry logic or log a warning before returning.

---

### 8. Translation Key Fallback May Expose Internal Structure

**File:** `src/services/i18n-service.ts` (lines 184-191)

**Issue:** When a translation key is not found, the key itself is converted to readable format:

```typescript
if (value === undefined || typeof value !== 'string') {
  return key
    .split('.')
    .pop()!
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}
```

**Risk:** Internal key structure could be exposed to users, providing insight into application structure.

**Recommendation:** Return a generic "Translation missing" message in production, with key details only in development.

---

### 9. Logger ANSI Escape Sequences Could Cause Issues

**File:** `src/utils/logger.ts` (lines 40-52)

**Issue:** ANSI color codes are always used, which may cause issues in non-TTY outputs or log aggregation systems.

**Recommendation:** Check `process.stdout.isTTY` before using colors.

---

### 10. Inconsistent Error Response Visibility

**File:** `src/utils/response-helper.ts`

**Issue:** When `interaction.deferred` is true, `sendEphemeralError` uses `followUp()` which creates a new message (potentially public), rather than editing the existing deferred reply.

```typescript
if (interaction.deferred) {
  await interaction.followUp({
    ...response,
    flags: MessageFlags.Ephemeral,
  } as InteractionReplyOptions);
}
```

**Risk:** The original deferred message remains visible (often as "thinking..."), potentially confusing users.

**Recommendation:** Delete or edit the original deferred message before following up, or use `editReply` with appropriate handling.

---

### 11. Missing Input Length Limit on Data Center Validation

**File:** `src/utils/validators.ts` (lines 120-148)

**Issue:** `validateDataCenter` accepts any string and compares against a list without length limiting first.

**Risk:** Very long strings could cause performance issues in the array comparison.

**Recommendation:** Add early length check:
```typescript
if (dc.length > 20) {
  return { valid: false, error: 'Invalid data center name' };
}
```

---

### 12. Redis Clear Uses KEYS Command

**File:** `src/services/redis-cache.ts` (lines 110-118)

**Issue:** The `clear()` method uses the `KEYS` command which is blocking and O(N):

```typescript
const keys = await this.redis.keys('xivdye:*');
if (keys.length > 0) {
  await this.redis.del(...keys);
}
```

**Risk:** In production with many keys, this can block Redis and affect other clients.

**Recommendation:** Use `SCAN` command for non-blocking iteration, or avoid clearing in production.

---

### 13. Potential Memory Leak in In-Memory i18n Cache

**File:** `src/services/i18n-service.ts` (line 53)

**Issue:** The `memoryCache` for user preferences has no size limit or expiration:

```typescript
const memoryCache = new Map<string, LocaleCode>();
```

**Risk:** Over time, this could grow unbounded if many unique users interact with the bot.

**Recommendation:** Use an LRU cache with a maximum size, similar to the rate limiter.

---

## Informational Notes

### 14. BMP Format Intentionally Excluded

**File:** `src/constants/image.ts` (lines 25-33)

**Note:** BMP is intentionally excluded to prevent zip-bomb style attacks. This is good security practice.

### 15. Worker Pool Maximum Limit

**File:** `src/utils/worker-pool.ts` (line 46)

**Note:** Worker pool is capped at 4 workers maximum regardless of CPU count. This is good practice to prevent resource exhaustion.

### 16. Graceful Shutdown Implemented

**File:** `src/index.ts` (lines 231-257)

**Note:** Both SIGINT and SIGTERM handlers properly clean up resources. Good practice.

---

## Recommendations Summary

| Priority | Issue | Action |
|----------|-------|--------|
| High | Health endpoint exposure | Add authentication or reduce info |
| High | Hardcoded user ID | Move to environment variables |
| Medium | Worker pool race condition | Add busy state tracking |
| Medium | Incomplete IPv6 SSRF protection | Add comprehensive patterns |
| Medium | Cleanup interval not cleared | Add shutdown cleanup |
| Medium | Arbitrary dye ID limit | Derive from data |
| Low | Emoji service null check | Add retry/warning |
| Low | Translation key exposure | Use generic fallback |
| Low | ANSI colors in non-TTY | Check isTTY |
| Low | Inconsistent error visibility | Handle deferred state better |
| Low | Data center validation length | Add early length check |
| Low | Redis KEYS blocking | Use SCAN |
| Low | i18n memory cache unbounded | Use LRU cache |

---

## Test Coverage Observations

The codebase includes comprehensive test files for most components:
- Commands have corresponding `.test.ts` files
- Services have test coverage
- Renderers have test coverage
- Validators have test coverage

**Recommendation:** Add integration tests specifically for security-critical paths:
- Rate limiting bypass attempts
- Invalid/malicious image uploads
- SSRF attempts with various URL patterns

---

## Conclusion

The XIV Dye Tools Discord Bot demonstrates mature security practices with several proactive defenses. The issues identified are primarily in the low-to-medium severity range. The high-priority items (health endpoint exposure and hardcoded user ID) should be addressed promptly as they represent potential attack vectors or maintenance issues.

The codebase follows good separation of concerns, uses TypeScript's type system effectively for safety, and implements multiple layers of defense for user input handling.
