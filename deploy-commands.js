/**
 * Deploy slash commands to Discord
 * Run with: npm run deploy:commands
 */
import { REST, Routes } from 'discord.js';
import { config } from './src/config.js';
import { logger } from './src/utils/logger.js';
import { harmonyCommand } from './src/commands/harmony.js';
import { matchCommand } from './src/commands/match.js';
import { mixerCommand } from './src/commands/mixer.js';
import { dyeCommand } from './src/commands/dye.js';
import { matchImageCommand } from './src/commands/match-image.js';
import { matchImageHelpCommand } from './src/commands/match-image-help.js';
import { comparisonCommand } from './src/commands/comparison.js';
import { accessibilityCommand } from './src/commands/accessibility.js';
import { statsCommand } from './src/commands/stats.js';
// Collect all commands
const commands = [
    harmonyCommand.data.toJSON(),
    matchCommand.data.toJSON(),
    mixerCommand.data.toJSON(),
    dyeCommand.data.toJSON(),
    matchImageCommand.data.toJSON(),
    matchImageHelpCommand.data.toJSON(),
    comparisonCommand.data.toJSON(),
    accessibilityCommand.data.toJSON(),
    statsCommand.data.toJSON(),
];
const rest = new REST().setToken(config.token);
/**
 * Deploy commands
 */
async function deployCommands() {
    try {
        logger.info(`Started refreshing ${commands.length} application (/) commands.`);
        let data;
        if (config.guildId) {
            // Deploy to specific guild (faster, good for testing)
            logger.info(`Deploying to guild: ${config.guildId}`);
            data = await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: commands });
        }
        else {
            // Deploy globally (slower, takes up to 1 hour to propagate)
            logger.info('Deploying globally...');
            data = await rest.put(Routes.applicationCommands(config.clientId), { body: commands });
        }
        logger.info(`Successfully reloaded ${data.length} application (/) commands.`);
        // Log registered commands
        data.forEach((cmd) => {
            logger.info(`  - /${cmd.name}: ${cmd.description}`);
        });
    }
    catch (error) {
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
//# sourceMappingURL=deploy-commands.js.map