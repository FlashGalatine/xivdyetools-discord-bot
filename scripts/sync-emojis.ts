
import { Client, GatewayIntentBits } from 'discord.js';
import { readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const EMOJI_DIR = join(__dirname, '..', 'emoji');

async function syncEmojis() {
    if (!process.env.DISCORD_TOKEN) {
        console.error('Error: DISCORD_TOKEN not found in .env');
        process.exit(1);
    }

    const client = new Client({
        intents: [GatewayIntentBits.Guilds],
    });

    try {
        console.log('Logging in...');
        await client.login(process.env.DISCORD_TOKEN);
        console.log(`Logged in as ${client.user?.tag}`);

        // Fetch existing application emojis
        console.log('Fetching existing application emojis...');
        const application = await client.application?.fetch();
        if (!application) {
            throw new Error('Could not fetch application');
        }

        const existingEmojis = await application.emojis.fetch();
        console.log(`Found ${existingEmojis.size} existing emojis.`);

        // Read local emoji files
        const files = readdirSync(EMOJI_DIR).filter(f => f.endsWith('.webp'));
        console.log(`Found ${files.length} local emoji files.`);

        let createdCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const file of files) {
            const itemID = file.replace('.webp', '');
            const emojiName = `dye_${itemID}`;

            // Check if emoji already exists
            const existing = existingEmojis.find(e => e.name === emojiName);

            if (existing) {
                // console.log(`Skipping ${emojiName} (already exists)`);
                skippedCount++;
                continue;
            }

            console.log(`Creating emoji: ${emojiName}...`);
            try {
                const filePath = join(EMOJI_DIR, file);
                const buffer = readFileSync(filePath);

                await application.emojis.create({
                    attachment: buffer,
                    name: emojiName,
                });

                createdCount++;
                // Rate limit prevention
                await new Promise(resolve => setTimeout(resolve, 1500));
            } catch (error) {
                console.error(`Failed to create emoji ${emojiName}:`, error);
                errorCount++;
            }
        }

        console.log('\nSync Complete!');
        console.log(`Created: ${createdCount}`);
        console.log(`Skipped: ${skippedCount}`);
        console.log(`Errors:  ${errorCount}`);

    } catch (error) {
        console.error('Fatal error:', error);
    } finally {
        await client.destroy();
    }
}

syncEmojis();
