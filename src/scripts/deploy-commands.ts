/**
 * Deploy slash commands to Discord
 * Run with: npm run deploy:commands
 */

import { REST, Routes } from 'discord.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { harmonyCommand } from '../commands/harmony.js';
import { matchCommand } from '../commands/match.js';
import { mixerCommand } from '../commands/mixer.js';
import { dyeCommand } from '../commands/dye.js';
import { matchImageCommand } from '../commands/match-image.js';
import { matchImageHelpCommand } from '../commands/match-image-help.js';
import { comparisonCommand } from '../commands/comparison.js';
import { accessibilityCommand } from '../commands/accessibility.js';
import { statsCommand } from '../commands/stats.js';
import { manualCommand } from '../commands/manual.js';
import { aboutCommand } from '../commands/about.js';
import { languageCommand } from '../commands/language.js';

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
  manualCommand.data.toJSON(),
  aboutCommand.data.toJSON(),
  languageCommand.data.toJSON(),
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
      data = await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), {
        body: commands,
      });
    } else {
      // Deploy globally (slower, takes up to 1 hour to propagate)
      logger.info('Deploying globally...');
      data = await rest.put(Routes.applicationCommands(config.clientId), { body: commands });
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
