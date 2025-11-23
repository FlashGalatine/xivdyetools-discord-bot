/**
 * Deploy slash commands to Discord
 * Run with: npm run deploy:commands
 */

import { REST, Routes } from 'discord.js';
import { config } from './src/config.js';
import { logger } from './src/utils/logger.js';
import { harmonyCommand } from './src/commands/harmony.js';

// Collect all commands
const commands = [
    harmonyCommand.data.toJSON(),
];

const rest = new REST().setToken(config.token);

/**
 * Deploy commands
 */
async function deployCommands(): Promise<void> {
    try {
        logger.info(`Started refreshing ${commands.length} application (/) commands.`);

        let data: any;

        if (config.guildId) {
            // Deploy to specific guild (faster, good for testing)
            logger.info(`Deploying to guild: ${config.guildId}`);
            data = await rest.put(
                Routes.applicationGuildCommands(config.clientId, config.guildId),
                { body: commands }
            );
        } else {
            // Deploy globally (slower, takes up to 1 hour to propagate)
            logger.info('Deploying globally...');
            data = await rest.put(
                Routes.applicationCommands(config.clientId),
                { body: commands }
            );
        }

        logger.info(`Successfully reloaded ${(data as any[]).length} application (/) commands.`);

        // Log registered commands
        (data as any[]).forEach((cmd: any) => {
            logger.info(`  - /${cmd.name}: ${cmd.description}`);
        });
    } catch (error) {
        logger.error('Error deploying commands:', error);
        process.exit(1);
    }
}

// Run deployment
deployCommands()
    .then(() => {
        logger.info('Command deployment complete!');
        process.exit(0);
    })
    .catch((error) => {
        logger.error('Deployment failed:', error);
        process.exit(1);
    });
