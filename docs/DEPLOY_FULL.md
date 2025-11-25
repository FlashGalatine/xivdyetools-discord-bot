# Full Deploy Feature

## Overview

Added support for full deployments to the `npm run deploy` command, allowing you to upload **all files** instead of just changed files.

## Usage

### Standard Deploy (Incremental)
```bash
npm run deploy
```
- Only uploads files that have changed since the last deployment
- Uses manifest comparison to detect changes
- **Default behavior** - fastest and most efficient

### Full Deploy
```bash
npm run deploy:full
```
**OR**
```bash
npm run deploy -- --full
```
- Uploads **all files** regardless of whether they've changed
- Bypasses manifest checking
- Useful when:
  - Remote files may have been corrupted or modified
  - You want to ensure everything is in sync
  - First deployment after manual server changes
  - Troubleshooting deployment issues

## How It Works

The `--full` flag modifies the deployment behavior:

1. **Standard Deploy**:
   - Computes hashes for all local files
   - Downloads remote manifest
   - Compares local vs remote hashes
   - Uploads only changed files
   - Updates remote manifest

2. **Full Deploy** (`--full` flag):
   - Computes hashes for all local files
   - **Skips** remote manifest check
   - Uploads **all** files regardless of hash comparison
   - Updates remote manifest

## Output Examples

### Standard Deploy
```
🚀 Starting deployment...
📦 Building project...
🔌 Connecting to server...
✅ Connected!
📊 Computing local file hashes...
📥 Checking remote manifest...
⬆️ Uploading 3 changed files...
  - dist/src/index.js
  - dist/src/commands/manual.js
  - dist/src/commands/about.js
✅ Files uploaded.
📝 Updating remote manifest...
✅ Deployment complete!
```

### Full Deploy
```
🚀 Starting deployment...
📦 Full deployment mode: All files will be uploaded
📦 Building project...
🔌 Connecting to server...
✅ Connected!
📊 Computing local file hashes...
📦 Full deploy mode: Skipping manifest check
⬆️ Uploading all 1247 files (full deploy)...
  - dist/src/index.js
  - dist/src/commands/manual.js
  - [... all other files ...]
✅ Files uploaded.
📝 Updating remote manifest...
✅ Deployment complete!
```

## Implementation Details

The `--full` flag is checked via `process.argv.includes('--full')` and modifies the deployment logic:

```typescript
const isFullDeploy = process.argv.includes('--full');

// Skip manifest check in full deploy mode
if (!isFullDeploy) {
  // Download and compare with remote manifest
}

// Upload all files in full deploy mode
const uploadQueue = filesToSync.filter(file => {
  if (isFullDeploy) {
    return true; // Always upload
  }
  // Compare hashes for standard deploy
  return localHash !== remoteHash;
});
```

## When to Use Full Deploy

✅ **Use Full Deploy When:**
- You suspect remote files are out of sync
- Manual changes were made on the server
- Troubleshooting deployment issues
- First deployment after server maintenance
- You want absolute certainty all files are current

❌ **Use Standard Deploy When:**
- Normal development workflow
- Quick updates after code changes
- You trust the manifest system
- You want faster deployments

## Performance Comparison

| Deploy Type | Files Checked | Files Uploaded | Typical Time |
|-------------|---------------|----------------|--------------|
| Standard    | All           | Only changed   | 10-30s       |
| Full        | All           | All (~1200+)   | 2-5 min      |

> **Tip**: For most deployments, use the standard `npm run deploy`. The full deploy is intentionally slower as it ensures complete synchronization.
