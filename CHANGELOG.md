# Changelog

All notable changes to this project will be documented in this file.

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
