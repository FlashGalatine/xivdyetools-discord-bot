
import { Client, ApplicationEmoji, Collection } from 'discord.js';
import { Dye } from 'xivdyetools-core';
import { logger } from '../utils/logger.js';
import { formatColorSwatch } from '../utils/embed-builder.js';

class EmojiService {
    private static instance: EmojiService;
    private emojis: Collection<string, ApplicationEmoji> = new Collection();
    private initialized = false;

    private constructor() { }

    public static getInstance(): EmojiService {
        if (!EmojiService.instance) {
            EmojiService.instance = new EmojiService();
        }
        return EmojiService.instance;
    }

    /**
     * Initialize the service by fetching application emojis
     */
    public async initialize(client: Client): Promise<void> {
        if (this.initialized) return;

        try {
            if (!client.application) {
                // Wait for application to be ready if needed, though usually ready by now
            }

            if (client.application) {
                this.emojis = await client.application.emojis.fetch();
                logger.info(`EmojiService initialized with ${this.emojis.size} emojis`);
                this.initialized = true;
            } else {
                logger.warn('EmojiService: Could not fetch client application');
            }
        } catch (error) {
            logger.error('EmojiService initialization failed:', error);
        }
    }

    /**
     * Get emoji for a dye
     */
    public getDyeEmoji(dye: Dye): ApplicationEmoji | undefined {
        if (!this.initialized) return undefined;

        const emojiName = `dye_${dye.itemID}`;
        return this.emojis.find(e => e.name === emojiName);
    }

    /**
     * Get formatted emoji string or null
     */
    public getDyeEmojiString(dye: Dye): string | null {
        const emoji = this.getDyeEmoji(dye);
        return emoji ? emoji.toString() : null;
    }

    /**
     * Get emoji or fallback to color swatch
     */
    public getDyeEmojiOrSwatch(dye: Dye, swatchSize: number = 4): string {
        const emoji = this.getDyeEmojiString(dye);
        if (emoji) {
            return emoji;
        }
        return formatColorSwatch(dye.hex, swatchSize);
    }
}

export const emojiService = EmojiService.getInstance();
