/**
 * Preset swatch renderer using @napi-rs/canvas
 * Generates a visual display of a preset color palette
 */

import { createCanvas } from '@napi-rs/canvas';
import type { Dye, PresetPalette, CategoryMeta } from 'xivdyetools-core';

export interface PresetSwatchOptions {
  /** Preset palette metadata */
  preset: PresetPalette;
  /** Category metadata for icon display */
  categoryMeta?: CategoryMeta;
  /** Resolved dye objects */
  dyes: (Dye | null)[];
  /** Canvas width (default: 600) */
  width?: number;
}

/**
 * Render a preset palette swatch with title, description, and color blocks
 *
 * Layout:
 * ┌────────────────────────────────────────────────────┐
 * │                    Red Mage                        │
 * │           The crimson elegance...                  │
 * ├──────────┬──────────┬──────────┬──────────────────┤
 * │  ██████  │  ██████  │  ██████  │  ██████          │
 * │  ██████  │  ██████  │  ██████  │  ██████          │
 * ├──────────┼──────────┼──────────┼──────────────────┤
 * │ Dalamud  │   Jet    │ Metallic │   Snow           │
 * │   Red    │  Black   │   Gold   │  White           │
 * └──────────┴──────────┴──────────┴──────────────────┘
 */
export function renderPresetSwatch(options: PresetSwatchOptions): Buffer {
  const { preset, dyes, categoryMeta } = options;
  const width = options.width ?? 600;

  // Filter out null dyes
  const validDyes = dyes.filter((d): d is Dye => d !== null);

  if (validDyes.length === 0) {
    throw new Error('No valid dyes to render');
  }

  // Layout constants
  const padding = 20;
  const headerHeight = 80;
  const swatchHeight = 100;
  const labelHeight = 50;
  const spacing = 10;

  // Calculate swatch width based on number of dyes
  const availableWidth = width - padding * 2 - spacing * (validDyes.length - 1);
  const swatchWidth = Math.floor(availableWidth / validDyes.length);

  // Total height
  const height = headerHeight + swatchHeight + labelHeight + padding * 2;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Draw background with dark theme
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, width, height);

  // Draw category icon and title
  const icon = categoryMeta?.icon ?? '🎨';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${icon} ${preset.name}`, width / 2, padding + 28);

  // Draw description (truncated if too long)
  ctx.fillStyle = '#aaaaaa';
  ctx.font = '14px sans-serif';
  let description = preset.description;
  if (description.length > 60) {
    description = description.substring(0, 57) + '...';
  }
  ctx.fillText(description, width / 2, padding + 55);

  // Draw each dye swatch
  validDyes.forEach((dye, index) => {
    const x = padding + index * (swatchWidth + spacing);
    const y = headerHeight + padding;

    // Draw color swatch with rounded corners
    ctx.fillStyle = dye.hex;
    roundRect(ctx, x, y, swatchWidth, swatchHeight, 8);
    ctx.fill();

    // Draw subtle border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, swatchWidth, swatchHeight, 8);
    ctx.stroke();

    // Draw dye name (truncated if needed)
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';

    let dyeName = dye.name;
    if (dyeName.length > 12) {
      dyeName = dyeName.substring(0, 10) + '...';
    }
    ctx.fillText(dyeName, x + swatchWidth / 2, y + swatchHeight + 18);

    // Draw hex code
    ctx.font = '10px monospace';
    ctx.fillStyle = '#888888';
    ctx.fillText(dye.hex.toUpperCase(), x + swatchWidth / 2, y + swatchHeight + 35);
  });

  return canvas.toBuffer('image/png');
}

/**
 * Helper function to draw a rounded rectangle path
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

// Type augmentation for canvas context
type CanvasRenderingContext2D = ReturnType<ReturnType<typeof createCanvas>['getContext']>;
