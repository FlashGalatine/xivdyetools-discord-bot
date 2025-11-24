import Client from 'ssh2-sftp-client';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
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
async function deploy() {
    try {
        console.log('🚀 Starting deployment...');
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
        // 3. Upload files
        const localDist = path.resolve(process.cwd(), 'dist');
        const localEmoji = path.resolve(process.cwd(), 'emoji');
        const remoteDist = `${config.remotePath}/dist`;
        const remoteEmoji = `${config.remotePath}/emoji`;
        // Ensure remote directories exist
        console.log('📂 Ensuring remote directories exist...');
        await sftp.mkdir(remoteDist, true);
        await sftp.mkdir(remoteEmoji, true);
        // Upload dist
        console.log('⬆️ Uploading dist/ folder...');
        await sftp.uploadDir(localDist, remoteDist);
        // Upload emoji (optional, if they change)
        console.log('⬆️ Uploading emoji/ folder...');
        await sftp.uploadDir(localEmoji, remoteEmoji);
        // Upload individual files
        const filesToUpload = ['package.json', 'package-lock.json', 'start.js'];
        for (const file of filesToUpload) {
            const localPath = path.resolve(process.cwd(), file);
            const remotePath = `${config.remotePath}/${file}`;
            if (fs.existsSync(localPath)) {
                console.log(`⬆️ Uploading ${file}...`);
                await sftp.put(localPath, remotePath);
            }
        }
        console.log('✅ Deployment complete!');
    }
    catch (err) {
        console.error('❌ Deployment failed:', err);
    }
    finally {
        await sftp.end();
    }
}
void deploy();
//# sourceMappingURL=deploy.js.map