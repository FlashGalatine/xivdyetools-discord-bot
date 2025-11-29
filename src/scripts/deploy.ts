/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any */
import Client from 'ssh2-sftp-client';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { execSync } from 'child_process';

// Load environment variables
dotenv.config();

const config = {
  host: process.env.SFTP_HOST,
  port: parseInt(process.env.SFTP_PORT || '22', 10),
  username: process.env.SFTP_USERNAME,
  password: process.env.SFTP_PASSWORD,
  remotePath: '/xivdyetools-discord-bot', // Adjust if needed
};

// Validate config
if (!config.host || !config.username || !config.password) {
  console.error('❌ Missing SFTP configuration in .env');
  console.error('Required: SFTP_HOST, SFTP_USERNAME, SFTP_PASSWORD');
  process.exit(1);
}

const sftp = new Client();

interface FileManifest {
  [path: string]: string; // path -> hash
}

function computeFileHash(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('md5');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

function getFilesRecursively(dir: string, baseDir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);

  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat && stat.isDirectory()) {
      results = results.concat(getFilesRecursively(filePath, baseDir));
    } else {
      results.push(path.relative(baseDir, filePath).replace(/\\/g, '/'));
    }
  });

  return results;
}

async function deploy(): Promise<void> {
  try {
    // Check for flags
    const isFullDeploy = process.argv.includes('--full');
    const excludeEmoji = process.argv.includes('--no-emoji');

    console.log('🚀 Starting deployment...');
    if (isFullDeploy) {
      console.log('📦 Full deployment mode: All files will be uploaded');
    }
    if (excludeEmoji) {
      console.log('🎭 Excluding emoji directory from deployment');
    }

    // 1. Build project
    console.log('📦 Building project...');
    execSync('npm run build', { stdio: 'inherit' });

    // 2. Connect to SFTP
    console.log(`🔌 Connecting to ${config.host} as ${config.username}...`);
    await sftp.connect({
      ...config,
      tryKeyboard: true,
    });
    console.log('✅ Connected!');

    // 3. Prepare local manifest
    console.log('📊 Computing local file hashes...');
    const localManifest: FileManifest = {};
    const filesToSync: { localPath: string; remotePath: string; relativePath: string }[] = [];

    // Define directories/files to sync
    const syncConfig = [
      { local: 'dist', remote: 'dist' },
      ...(excludeEmoji ? [] : [{ local: 'emoji', remote: 'emoji' }]),
      { local: 'package.json', remote: 'package.json' },
      { local: 'package-lock.json', remote: 'package-lock.json' },
      { local: 'start.js', remote: 'start.js' },
    ];

    for (const item of syncConfig) {
      const localItemPath = path.resolve(process.cwd(), item.local);

      if (!fs.existsSync(localItemPath)) {
        console.warn(`⚠️ Local path not found: ${item.local}`);
        continue;
      }

      const stat = fs.statSync(localItemPath);
      if (stat.isDirectory()) {
        const files = getFilesRecursively(localItemPath, process.cwd());
        for (const file of files) {
          // Only include files that are within the current item.local directory
          if (file.startsWith(item.local + '/')) {
            const fullLocalPath = path.resolve(process.cwd(), file);
            const hash = computeFileHash(fullLocalPath);
            localManifest[file] = hash;
            filesToSync.push({
              localPath: fullLocalPath,
              remotePath: `${config.remotePath}/${file}`,
              relativePath: file,
            });
          }
        }
      } else {
        // Single file
        const hash = computeFileHash(localItemPath);
        localManifest[item.local] = hash;
        filesToSync.push({
          localPath: localItemPath,
          remotePath: `${config.remotePath}/${item.remote}`,
          relativePath: item.local,
        });
      }
    }

    // 4. Get remote manifest
    let remoteManifest: FileManifest = {};
    const manifestPath = `${config.remotePath}/deploy-manifest.json`;

    if (!isFullDeploy) {
      try {
        console.log('📥 Checking remote manifest...');
        const remoteManifestBuffer = await sftp.get(manifestPath);
        if (remoteManifestBuffer) {
          remoteManifest = JSON.parse((remoteManifestBuffer as Buffer).toString());
        }
      } catch (err) {
        console.log('ℹ️ No remote manifest found (first deploy or deleted). Uploading all files.');
      }
    } else {
      console.log('📦 Full deploy mode: Skipping manifest check');
    }

    // 5. Determine files to upload
    const uploadQueue = filesToSync.filter((file) => {
      if (isFullDeploy) {
        return true; // Upload all files in full deploy mode
      }
      const localHash = localManifest[file.relativePath];
      const remoteHash = remoteManifest[file.relativePath];
      return localHash !== remoteHash;
    });

    if (uploadQueue.length === 0) {
      console.log('✨ No changes detected. Everything is up to date!');
    } else {
      if (isFullDeploy) {
        console.log(`⬆️ Uploading all ${uploadQueue.length} files (full deploy)...`);
      } else {
        console.log(`⬆️ Uploading ${uploadQueue.length} changed files...`);
      }

      // Ensure directories exist for queued files
      // We can be lazy and just ensure the main dirs exist, or robust and ensure all parents
      // For simplicity, let's ensure base dirs exist.
      // Ideally we should ensure parent dir for each file.

      for (const file of uploadQueue) {
        const remoteDir = path.dirname(file.remotePath);
        const dirExists = await sftp.exists(remoteDir);
        if (!dirExists) {
          await sftp.mkdir(remoteDir, true);
        }

        console.log(`  - ${file.relativePath}`);
        await sftp.put(file.localPath, file.remotePath);
      }

      console.log('✅ Files uploaded.');

      // 6. Upload new manifest
      console.log('📝 Updating remote manifest...');
      await sftp.put(Buffer.from(JSON.stringify(localManifest, null, 2)), manifestPath);
    }

    console.log('✅ Deployment complete!');
  } catch (err) {
    console.error('❌ Deployment failed:', err);
  } finally {
    await sftp.end();
  }
}

void deploy();
