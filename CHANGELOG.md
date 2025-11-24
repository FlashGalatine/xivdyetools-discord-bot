# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
