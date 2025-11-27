/**
 * Copy translation JSON files from src/i18n/translations to dist/i18n/translations
 *
 * TypeScript compiler only compiles .ts files, so JSON files must be copied manually
 */

import { copyFileSync, mkdirSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const srcDir = join(__dirname, '..', 'src', 'i18n', 'translations');
const distDir = join(__dirname, '..', 'dist', 'i18n', 'translations');

// Create dist directory if it doesn't exist
if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true });
}

// Copy all JSON files
const files = readdirSync(srcDir).filter((f) => f.endsWith('.json'));

console.log(`📦 Copying ${files.length} translation files to dist...`);

for (const file of files) {
  copyFileSync(join(srcDir, file), join(distDir, file));
  console.log(`   ✓ ${file}`);
}

console.log(`✅ Translation files copied to ${distDir}`);
