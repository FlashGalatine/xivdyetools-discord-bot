# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.11] - 2025-12-02

### Added
- **`/accessibility` Multi-Dye Contrast Comparison**: Enhanced command to support up to 4 dyes
  - **Single dye mode**: Now displays WCAG contrast scores vs white (#FFFFFF) and black (#000000) in addition to colorblind simulation
  - **Multi-dye mode (2-4 dyes)**: New graphical contrast matrix showing pairwise WCAG contrast ratios with AAA/AA/Fail compliance badges
  - New options: `dye2`, `dye3`, `dye4` for comparing multiple dyes
  - New renderer: `accessibility-matrix.ts` generates visual contrast comparison grid

### Changed
- **`/manual` Command**: Updated accessibility command documentation to reflect new multi-dye contrast comparison feature
- **Localization**: Added new translation keys for contrast features across all 6 languages (en, ja, de, fr, ko, zh):
  - `contrastScores`, `vsWhite`, `vsBlack`, `contrastMatrix`, `contrastComparison`
  - `contrastMatrixDescription`, `wcagLegend`, `wcagAAA`, `wcagAA`, `wcagFail`, `fail`

## [1.0.10] - 2025-12-02

### Security (Based on SECURITY_AND_BUG_AUDIT.md)

#### High Priority Fixes
- **Health Endpoint Information Disclosure**: Reduced exposed information in `/health` endpoint to only `status` and `uptime`, removing guild/user/command counts that could enable enumeration attacks.
- **Stats Command Authorization**: Moved hardcoded user ID to environment variable `STATS_AUTHORIZED_USERS` supporting comma-separated list of authorized Discord user IDs.

#### Medium Priority Fixes
- **Worker Pool Race Condition**: Added `busyWorkers` Set to track which workers are processing tasks, preventing multiple tasks from being assigned to the same worker under high load.
- **Incomplete IPv6 SSRF Protection**: Added comprehensive IPv6 patterns including `::ffff:` mapped addresses, `fe80::` link-local, and `fc00::`/`fd00::` unique local address ranges.
- **Rate Limiter Cleanup Interval**: Store cleanup interval ID and export `stopRateLimiter()` function, called during graceful shutdown in SIGINT/SIGTERM handlers.
- **Arbitrary Dye ID Limit**: Derive max dye ID from actual database with 20% headroom instead of hardcoded value of 200.

#### Low Priority Fixes
- **Emoji Service Null Check**: Added warning log when `client.application` is null during emoji service initialization, with early return to prevent silent failures.
- **Translation Key Exposure**: In production, return generic "Translation missing" message instead of exposing internal key structure (dev mode still shows formatted key for debugging).
- **Logger ANSI Colors in Non-TTY**: Check `process.stdout.isTTY` before using ANSI color codes to prevent issues in log aggregation systems.
- **Inconsistent Error Visibility**: Delete the original deferred reply ("thinking..." message) before sending ephemeral error to avoid leaving confusing public messages.
- **Data Center Validation Length**: Added early length check (max 20 characters) to prevent performance issues with very long strings.
- **Redis KEYS Blocking**: Replaced O(N) blocking `KEYS` command with incremental non-blocking `SCAN` command in `clear()` method.
- **i18n Memory Cache Unbounded**: Replaced unbounded `Map` with LRU cache (max 1000 entries) for user locale preferences to prevent memory leaks with many unique users.

### Changed
- Environment variable `STATS_AUTHORIZED_USERS` now controls access to `/stats` command

## [1.0.9] - 2025-12-02

### Changed
- **Core Dependency**: Updated `xivdyetools-core` to `^1.3.1` for latest fixes and improvements.
  - Security: Prototype pollution protections in `DyeDatabase.initialize()`.
  - Data Integrity: `price` field mapping to `cost`, null-safe defaults.
  - Reliability: Timeout retry improvements with `AbortError` handling.
  - Consistency: Color conversion rounding alignment, negative hue normalization.
  - Testing: Singleton reset utilities and enhanced documentation.

### Verified
- Ran full bot test suite: 757 tests passed, 3 skipped.
- No breaking changes detected in commands (`match`, `harmony`, `comparison`, `mixer`, `dye`).

## [1.0.8] - 2025-11-30

### Fixed
- **Localization**:
  - French: Corrected "Cosmic Fortunes" translation to "Roue de la fortune cosmique" (was "Fortunes cosmiques") to match official FFXIV terminology.

## [1.0.7] - 2025-11-30

### Added
- **Typed Error Classes**: New error class hierarchy for better error handling
  - `BotError` base class with `ValidationError`, `NotFoundError`, `RateLimitError`, `PermissionError`, `ExternalServiceError`, `TimeoutError`, `ProcessingError`, `ImageProcessingError`
  - `getUserFriendlyMessage()` and `getErrorTitle()` utilities for consistent error messaging
- **SSRF Protection**: URL validation for image downloads (`src/utils/url-validator.ts`)
  - Allowlist restricted to Discord CDN domains only
  - Blocks private IP ranges and localhost
- **Service Singletons Module**: Centralized service instances (`src/services/index.ts`)
- **Shared Color Input Utilities**: DRY color/dye parsing (`src/utils/color-input.ts`)
- **Worker Message Types**: Type-safe worker thread communication (`src/types/worker-messages.ts`)
- **Unified Image Constants**: Single source of truth for image limits (`src/constants/image.ts`)

### Changed
- **Command Architecture**: Migrated remaining commands to `CommandBase` pattern
  - `harmony.ts`, `comparison.ts`, `accessibility.ts`, `mixer.ts` now extend `CommandBase`
  - Standardized error handling and logging across all commands
- **Rate Limiter**: Conservative in-memory fallback when Redis is unavailable
  - Prevents fail-open behavior with stricter limits (5/min, 20/hour)
  - Memory leak fix in fallback tracking
- **Analytics**: O(1) time-series operations using CircularBuffer
  - Replaced O(n) `shift()` operations with circular buffer pattern
- **Configuration Validation**: Enhanced startup validation
  - URL format validation for `REDIS_URL` and `ERROR_WEBHOOK_URL`
  - Numeric bounds validation for all config values
- **Dye ID Validation**: Optional strict mode with database verification

### Fixed
- **Memory Leak**: Rate limiter in-memory fallback now properly cleans up old entries
- **ESLint Errors**: Fixed async methods without await in mock Redis client
- **Test Compatibility**: Updated test mocks for `CommandBase` compatibility

### Security
- Image downloads now restricted to Discord CDN domains (SSRF protection)
- Configuration URLs validated at startup
- Rate limiter fails closed instead of open when Redis unavailable

## [1.0.6] - 2025-11-28

### Fixed
- **German Localization (Major)**:
  - Replaced ~100+ occurrences of "Färbemittel" with official FFXIV term "Farbstoff"
  - Fixed grammatical gender throughout (masculine "Farbstoff" vs neuter "Färbemittel")
  - Corrected Pure White/Jet Black dye names from "Reinweiß/Tiefschwarz" to official names "Wolkenweißer Farbstoff/Rabenschwarzer Farbstoff"

- **French Localization**:
  - Corrected Pure White dye name from "Blanc pur" to official FFXIV term "blanc immaculé"

### Verified
- **Korean Localization**: Confirmed 순백색 (Pure White) and 칠흑색 (Jet Black) match official Korean FFXIV terminology
- **Chinese Localization**: Confirmed 无瑕白 (Pure White) and 煤玉黑 (Jet Black) match official Chinese FFXIV terminology

## [1.0.5] - 2025-11-27

### Added
- **New Language Support**: Added full support for Korean (ko) and Chinese (zh) languages
  - Complete translation of all commands, embeds, and help text
  - Localized dye names and terminology via `xivdyetools-core` update
  - Updated `/language` command to include Korean and Chinese options
  - Updated `/manual` and `/match_image_help` with localized content

### Changed
- **Core Dependency**: Updated `xivdyetools-core` to `^1.2.0` to support new languages

## [1.0.4] - 2025-11-27

### Added
- **Comprehensive Test Coverage**: Achieved 92.73% code coverage (exceeding 90% target)
  - Added 624 tests total (from previous ~580)
  - Added tests for `validateCommandInputs` function with 17 test cases
  - Added tests for `validateHexColorLegacy` and non-integer validation
  - Added tests for `sanitizeImage` and `validateAndSanitizeImage` functions
  - Added tests for security logger (`authFailure`, severity tracking, stats)
  - Added emoji-service.test.ts with 10 tests for EmojiService singleton

### Fixed
- **TypeScript Compilation Errors**: Fixed type errors in test helper files
  - Fixed mock-interaction.ts: Updated mock creation functions to use proper type casting
  - Fixed mock-redis.ts: Corrected spies return type signature
  - Fixed swatch-grid.test.ts: Added required `acquisition` and `cost` properties to mock Dye
  - Fixed redis-cache.test.ts: Added `ttl` and `timestamp` to CachedData test objects

### Changed
- **Coverage Improvements by Module**:
  - `validators.ts`: 68.72% → 98.37% (+29.65%)
  - `image-validator.ts`: 63.31% → 96.48% (+33.17%)
  - `security-logger.ts`: 75.82% → 80.49% (+4.67%)
  - `src/utils` overall: 87.69% → 93.02% (+5.33%)

## [1.0.3] - 2025-11-27

### Fixed
- **Localization Fixes**:
  - German: Fixed "Cosmic Exploration" and "Cosmic Fortunes" translations to use correct game terminology ("Kosmo-Erkundung" and "Kosmo-Glück")
  - Japanese: Fixed cosmic terms to use katakana versions (「コスモエクスプローラー」and「コスモフォーチュン」)
  - French: Fixed "Dark" dye term from "Sombre" to "foncé" to match in-game terminology
  - French: Replaced 👌 emoji (culturally offensive) with ⚠️ for "fair" match quality

- **i18n Implementation**:
  - `/about` command now uses i18n translation keys instead of hardcoded English
  - `/manual` command now uses i18n translation keys instead of hardcoded English
  - `/match_image_help` command now uses i18n translation keys instead of hardcoded English
  - `/accessibility` command: Added localized percentage text for vision type affects ("~1% of males", "<0.01% of people")

- **Acquisition Data Localization**:
  - All commands now display localized acquisition methods using `LocalizationService.getAcquisition()`
  - Fixed in: `/match`, `/match_image`, `/dye random`, `/harmony`, and embed builder utilities

### Added
- New translation keys for accessibility percentages:
  - `embeds.protanopiaAffects`
  - `embeds.deuteranopiaAffects`
  - `embeds.tritanopiaAffects`
  - Added translations for all 4 supported languages (en, de, fr, ja)

## [1.0.2] - 2025-11-24

### Fixed
- **Mixer Test**: Fixed test expectation to match default 6 steps (was incorrectly expecting 5)
- **ESLint Fixes**: 
  - Renamed unused `required` parameter to `_required` in test mocks
  - Removed unnecessary `async` from mock implementations

## [1.0.1] - 2025-11-24

### Added
- **Emoji Support for `/match_image`**: Added emoji display in the closest dye field and thumbnail, matching the behavior of other commands.

### Fixed
- **Discord.js Deprecation Warnings**: 
  - Replaced deprecated `emoji.url` with `emoji.imageURL()` across all commands
  - Replaced deprecated `ephemeral: true` with `MessageFlags.Ephemeral` in all interaction responses
- **Test Mocks**: Updated test mocks to include `imageURL()` method for emoji objects
- **Performance Benchmark Test**: Made caching test more robust to handle test environment variability

### Changed
- All commands now use the modern Discord.js API methods, eliminating deprecation warnings in production logs

## [1.0.0] - 2025-11-23

### 🎉 Major Release - Optimization Initiative Complete

This release represents the completion of a comprehensive 3-phase optimization initiative, bringing significant performance improvements, security enhancements, and code quality upgrades.

### Added
- **Performance Optimizations**
  - **Worker Threads for Image Processing**: Non-blocking image processing
    - CPU-aware worker pool (cores - 1, max 4)
    - Graceful fallback to sync processing
    - Prevents blocking main event loop
  - **Redis Pipeline Rate Limiter**: Reduced Redis round-trips from 3 to 1
  - **Dynamic Cache TTLs**: Command-specific cache TTLs with LRU eviction
  - **Image Processing Optimization**: Downsampling to 256x256, early validation

- **Security Enhancements**
  - **Input Validation**: Comprehensive validation for all command inputs
    - Hex color, dye ID, and search query validation
    - Sanitization and error handling
  - **Image Upload Security**: Multi-layer image validation
    - Decompression bomb protection
    - EXIF stripping and format whitelisting
    - Size and dimension limits
  - **Automated Dependency Scanning**: npm audit and Dependabot in CI/CD
  - **Secret Redaction**: Log redaction for sensitive data
  - **Docker Security Hardening**: Non-root user, vulnerability scanning
  - **Command-Specific Rate Limits**: Different limits per command type
  - **Security Event Logging**: Dedicated security logger with comprehensive tracking
  - **Privacy Documentation**: Complete privacy policy
  - **Redis Security**: TLS support and password authentication

- **Code Quality**
  - **Command Base Class**: Standardized command structure with error handling
  - **ESLint + Prettier**: Code quality enforcement with pre-commit hooks
  - **Integration Tests**: Comprehensive test suite with performance benchmarks
  - **API Documentation**: TypeDoc generation configured

### Changed
- **Performance Improvements**
  - `/match` response time: 2000ms → <1200ms (40% improvement)
  - `/harmony` response time: 1800ms → <800ms (55% improvement)
  - Memory usage: 180MB → ~130MB (28% reduction)
  - Image processing: 5000ms → <2500ms (50% improvement)

- **Security**
  - All command inputs now validated
  - Image uploads have multi-layer security
  - Docker runs as non-root user
  - Redis connections support TLS and authentication

- **Code Organization**
  - Commands can extend `CommandBase` for standardized structure
  - Improved error handling and logging
  - Better separation of concerns

### Fixed
- **Event Loop Blocking**: Image processing no longer blocks main event loop
- **Rate Limiter Efficiency**: Reduced Redis latency by 66%
- **Security Vulnerabilities**: 0 high/critical vulnerabilities in production

### Performance Metrics
- `/match` P95 latency: <1200ms (target: <1500ms) ✅
- `/harmony` P95 latency: <800ms (target: <1000ms) ✅
- Cache hit rate: >60% ✅
- Memory usage: ~130MB (target: <140MB) ✅

### Security Metrics
- High/Critical CVEs: 0 ✅
- Input validation coverage: 100% ✅
- Docker security score: A ✅

### Documentation
- Privacy policy (`docs/PRIVACY.md`)
- Security documentation (`docs/security/`)
- Testing strategy (`docs/TESTING_STRATEGY.md`)
- API documentation (TypeDoc)

### Dependencies
- Updated `xivdyetools-core` to `^1.1.0` (includes k-d tree, service splitting, and performance optimizations)

---

## [0.2.0] - 2025-11-23

### Added
- **Emoji Support**: Integrated Discord Application Emojis for better visual presentation of dyes.
  - `/harmony`: Base dye and suggestions now use emojis.
  - `/mixer`: Start, end, and intermediate dyes now use emojis.
  - `/comparison`: Dye fields now use emojis.
  - `/match`: Matched dye now displays its emoji in the embed and thumbnail.
- **Utility Scripts**: Added Python scripts for managing the bot on Fly.io.
  - `restart_bot.py`: Restarts the bot application.
  - `wake_bot.py`: Wakes up stopped machines.
- **EmojiService**: New service to manage and retrieve Discord Application Emojis (`src/services/emoji-service.ts`).

### Changed
- **Embed Thumbnails**: Switched from attaching local emoji files to using Discord CDN URLs for embed thumbnails, improving performance and reducing message payload size.
- **Deployment Configuration**: Updated `fly.toml` to explicitly set the start command to `node dist/index.js`, resolving crash issues.

### Fixed
- **Crash Loop**: Fixed an issue where the bot would crash loop on Fly.io due to an incorrect implicit start command.
- **Interaction Errors**: Fixed a bug where the bot would crash when trying to report an error for an interaction that had already timed out or was unknown.
- **Tests**: Resolved test failures in `harmony.test.ts`, `embed-builder.test.ts`, `mixer.test.ts`, `comparison.test.ts`, and `match.test.ts` related to the emoji integration changes.
