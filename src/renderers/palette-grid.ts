/**
 * Palette grid renderer using @napi-rs/canvas
 * Generates a visual comparison of extracted colors and matched dyes
 */

import { createCanvas } from '@napi-rs/canvas';
import type { Dye, RGB } from 'xivdyetools-core';

/**
 * A single palette entry to render
 */
export interface PaletteGridEntry {
  /** Extracted RGB color from image */
  extracted: RGB;
  /** Matched FFXIV dye */
  matchedDye: Dye;
  /** Color distance between extracted and matched */
  distance: number;
  /** Dominance percentage (0-100) */
  dominance: number;
}

export interface PaletteGridOptions {
  /** Array of palette entries to render */
  colors: PaletteGridEntry[];
  /** Canvas width (default: 800) */
  width?: number;
  /** Show distance values (default: true) */
  showDistance?: boolean;
}

/**
 * Convert RGB to hex string
 */
function rgbToHex(rgb: RGB): string {
  const toHex = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`.toUpperCase();
}

/**
 * Render a palette grid showing extracted colors and matched dyes
 *
 * Layout:
 * ┌────────────────────────────────────────────────────────────┐
 * │  EXTRACTED          →          MATCHED DYE                 │
 * ├────────────────────────────────────────────────────────────┤
 * │  [██████] 42%       →   [██████] Dalamud Red               │
 * │  #B01515                #AA1111  Δ12.3                     │
 * ├────────────────────────────────────────────────────────────┤
 * │  [██████] 31%       →   [██████] Jet Black                 │
 * │  #0C0C0C                #0A0A0A  Δ5.7                      │
 * └────────────────────────────────────────────────────────────┘
 */
export function renderPaletteGrid(options: PaletteGridOptions): Buffer {
  const { colors, showDistance = true } = options;
  const width = options.width ?? 800;

  if (colors.length === 0) {
    throw new Error('No colors to render');
  }

  // Layout constants
  const padding = 20;
  const headerHeight = 50;
  const rowHeight = 80;
  const swatchSize = 50;
  const arrowWidth = 40;

  // Calculate heights
  const contentHeight = colors.length * rowHeight;
  const height = headerHeight + contentHeight + padding * 2;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Draw background with dark theme
  ctx.fillStyle = '#1e1e2e';
  ctx.fillRect(0, 0, width, height);

  // Draw header
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('EXTRACTED', padding + swatchSize + 15, padding + 30);
  ctx.fillText('MATCHED DYE', width / 2 + 30, padding + 30);

  // Draw header separator
  ctx.strokeStyle = '#3a3a4a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, headerHeight + padding - 5);
  ctx.lineTo(width - padding, headerHeight + padding - 5);
  ctx.stroke();

  // Draw each color row
  colors.forEach((entry, index) => {
    const y = headerHeight + padding + index * rowHeight;

    // Draw row separator (except for first)
    if (index > 0) {
      ctx.strokeStyle = '#2a2a3a';
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }

    const rowCenterY = y + rowHeight / 2;

    // === Left side: Extracted color ===

    // Extracted color swatch
    const extractedHex = rgbToHex(entry.extracted);
    ctx.fillStyle = extractedHex;
    ctx.beginPath();
    ctx.roundRect(padding, rowCenterY - swatchSize / 2, swatchSize, swatchSize, 6);
    ctx.fill();

    // Swatch border
    ctx.strokeStyle = '#4a4a5a';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Dominance percentage
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${entry.dominance}%`, padding + swatchSize + 15, rowCenterY - 8);

    // Extracted hex
    ctx.fillStyle = '#888899';
    ctx.font = '12px monospace';
    ctx.fillText(extractedHex, padding + swatchSize + 15, rowCenterY + 15);

    // === Arrow ===
    const arrowX = width / 2 - arrowWidth / 2;
    ctx.fillStyle = '#6a6a7a';
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('→', arrowX + arrowWidth / 2, rowCenterY + 8);

    // === Right side: Matched dye ===
    const rightStartX = width / 2 + 20;

    // Matched dye swatch
    ctx.fillStyle = entry.matchedDye.hex;
    ctx.beginPath();
    ctx.roundRect(rightStartX, rowCenterY - swatchSize / 2, swatchSize, swatchSize, 6);
    ctx.fill();

    // Swatch border
    ctx.strokeStyle = '#4a4a5a';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Dye name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'left';

    // Truncate long names
    let dyeName = entry.matchedDye.name;
    if (dyeName.length > 18) {
      dyeName = dyeName.substring(0, 15) + '...';
    }
    ctx.fillText(dyeName, rightStartX + swatchSize + 15, rowCenterY - 8);

    // Dye hex and distance
    ctx.fillStyle = '#888899';
    ctx.font = '12px monospace';
    let infoText = entry.matchedDye.hex.toUpperCase();
    if (showDistance) {
      infoText += `  Δ${entry.distance.toFixed(1)}`;
    }
    ctx.fillText(infoText, rightStartX + swatchSize + 15, rowCenterY + 15);
  });

  return Buffer.from(canvas.toBuffer('image/png'));
}
