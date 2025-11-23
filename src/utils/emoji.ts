/**
 * Emoji utility for dye color spheres
 * Maps dye itemIDs to emoji files
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { Dye } from 'xivdyetools-core';
import { logger } from './logger.js';

// Get directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to emoji folder (relative to this file: utils -> src -> root -> emoji)
const EMOJI_DIR = join(__dirname, '..', '..', 'emoji');

/**
 * Get emoji file path for a dye
 * Returns null if emoji doesn't exist
 */
export function getDyeEmojiPath(dye: Dye): string | null {
    const emojiPath = join(EMOJI_DIR, `${dye.itemID}.webp`);

    if (existsSync(emojiPath)) {
        return emojiPath;
    }

    logger.debug(`Emoji not found for dye ${dye.name} (itemID: ${dye.itemID})`);
    return null;
}

/**
 * Get emoji buffer for a dye
 * Returns null if emoji doesn't exist
 */
export function getDyeEmojiBuffer(dye: Dye): Buffer | null {
    const emojiPath = getDyeEmojiPath(dye);

    if (!emojiPath) {
        return null;
    }

    try {
        return readFileSync(emojiPath);
    } catch (error) {
        logger.error(`Error reading emoji file for ${dye.name}:`, error);
        return null;
    }
}

/**
 * Get emoji attachment filename for a dye
 */
export function getDyeEmojiFilename(dye: Dye): string {
    return `dye_${dye.itemID}.webp`;
}

/**
 * Check if emoji exists for a dye
 */
export function hasDyeEmoji(dye: Dye): boolean {
    return getDyeEmojiPath(dye) !== null;
}
