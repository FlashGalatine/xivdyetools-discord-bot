/**
 * Accessibility contrast matrix renderer using @napi-rs/canvas
 * Generates a matrix showing pairwise WCAG contrast ratios between dyes
 */

import { createCanvas, type SKRSContext2D } from '@napi-rs/canvas';
import { ColorService } from 'xivdyetools-core';

export interface ContrastMatrixOptions {
  /** Array of dye objects with name and hex properties */
  dyes: { name: string; hex: string }[];
  /** Optional title for the matrix */
  title?: string;
}

export interface ContrastResult {
  ratio: number;
  level: 'AAA' | 'AA' | 'Fail';
}

/**
 * Get WCAG compliance level for a contrast ratio
 */
export function getWCAGLevel(ratio: number): 'AAA' | 'AA' | 'Fail' {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  return 'Fail';
}

/**
 * Get badge color for WCAG level
 */
function getBadgeColor(level: 'AAA' | 'AA' | 'Fail'): string {
  switch (level) {
    case 'AAA':
      return '#22c55e'; // Green
    case 'AA':
      return '#eab308'; // Yellow
    case 'Fail':
      return '#ef4444'; // Red
  }
}

/**
 * Calculate contrast between two colors using ColorService
 */
export function calculateContrast(hex1: string, hex2: string): ContrastResult {
  const ratio = ColorService.getContrastRatio(hex1, hex2);
  return {
    ratio,
    level: getWCAGLevel(ratio),
  };
}

/**
 * Truncate text with ellipsis if too long
 */
function truncateText(ctx: SKRSContext2D, text: string, maxWidth: number): string {
  const metrics = ctx.measureText(text);
  if ((metrics.width as number) <= maxWidth) return text;

  let truncated = text;
  while ((ctx.measureText(truncated + '...').width as number) > maxWidth && truncated.length > 0) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + '...';
}

/**
 * Render accessibility contrast matrix
 * Shows pairwise contrast ratios between all dyes with WCAG badges
 */
export function renderContrastMatrix(options: ContrastMatrixOptions): Buffer {
  const { dyes, title } = options;
  const dyeCount = dyes.length;

  // Layout configuration
  const cellSize = 100;
  const headerWidth = 120;
  const headerHeight = 50;
  const swatchSize = 24;
  const titleHeight = title ? 50 : 0;
  const padding = 20;
  const legendHeight = 40;

  // Calculate canvas dimensions
  const canvasWidth = padding * 2 + headerWidth + cellSize * dyeCount;
  const canvasHeight =
    padding * 2 + titleHeight + headerHeight + cellSize * dyeCount + legendHeight;

  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');

  // Draw background
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Draw title if provided
  if (title) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, canvasWidth / 2, padding + titleHeight / 2);
  }

  const startY = padding + titleHeight;
  const startX = padding;

  // Draw column headers (dye names with swatches)
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let col = 0; col < dyeCount; col++) {
    const dye = dyes[col];
    const x = startX + headerWidth + col * cellSize + cellSize / 2;
    const y = startY + headerHeight / 2;

    // Draw color swatch
    const swatchX = x - swatchSize / 2;
    const swatchY = y - 18;
    ctx.fillStyle = dye.hex;
    ctx.fillRect(swatchX, swatchY, swatchSize, swatchSize);
    ctx.strokeStyle = '#666666';
    ctx.lineWidth = 1;
    ctx.strokeRect(swatchX, swatchY, swatchSize, swatchSize);

    // Draw dye name (truncated if needed)
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    const truncatedName = truncateText(ctx, dye.name, cellSize - 10);
    ctx.fillText(truncatedName, x, y + 12);
  }

  // Draw row headers and matrix cells
  for (let row = 0; row < dyeCount; row++) {
    const dye = dyes[row];
    const y = startY + headerHeight + row * cellSize + cellSize / 2;

    // Draw row header with swatch
    const swatchX = startX + 10;
    const swatchY = y - swatchSize / 2;
    ctx.fillStyle = dye.hex;
    ctx.fillRect(swatchX, swatchY, swatchSize, swatchSize);
    ctx.strokeStyle = '#666666';
    ctx.lineWidth = 1;
    ctx.strokeRect(swatchX, swatchY, swatchSize, swatchSize);

    // Draw dye name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    const truncatedName = truncateText(ctx, dye.name, headerWidth - swatchSize - 25);
    ctx.fillText(truncatedName, swatchX + swatchSize + 8, y);

    // Draw matrix cells
    for (let col = 0; col < dyeCount; col++) {
      const x = startX + headerWidth + col * cellSize;
      const cellY = startY + headerHeight + row * cellSize;

      // Draw cell background
      if (row === col) {
        // Diagonal - same color comparison
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(x, cellY, cellSize, cellSize);

        // Draw diagonal pattern
        ctx.strokeStyle = '#3a3a3a';
        ctx.lineWidth = 1;
        for (let i = 0; i < cellSize; i += 10) {
          ctx.beginPath();
          ctx.moveTo(x + i, cellY);
          ctx.lineTo(x, cellY + i);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x + cellSize, cellY + i);
          ctx.lineTo(x + i, cellY + cellSize);
          ctx.stroke();
        }

        ctx.fillStyle = '#666666';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('—', x + cellSize / 2, y);
      } else {
        // Calculate contrast
        const contrast = calculateContrast(dyes[row].hex, dyes[col].hex);
        const badgeColor = getBadgeColor(contrast.level);

        // Cell background based on level
        ctx.fillStyle =
          contrast.level === 'AAA' ? '#1a2e1a' : contrast.level === 'AA' ? '#2e2a1a' : '#2e1a1a';
        ctx.fillRect(x, cellY, cellSize, cellSize);

        // Draw cell border
        ctx.strokeStyle = '#3a3a3a';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, cellY, cellSize, cellSize);

        // Draw contrast ratio
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(contrast.ratio.toFixed(2) + ':1', x + cellSize / 2, y - 10);

        // Draw WCAG badge
        const badgeWidth = 36;
        const badgeHeight = 20;
        const badgeX = x + cellSize / 2 - badgeWidth / 2;
        const badgeY = y + 8;

        // Badge background
        ctx.fillStyle = badgeColor;
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 4);
        ctx.fill();

        // Badge text
        ctx.fillStyle = contrast.level === 'AA' ? '#000000' : '#ffffff';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(contrast.level, x + cellSize / 2, badgeY + badgeHeight / 2);
      }
    }
  }

  // Draw legend at bottom
  const legendY = startY + headerHeight + cellSize * dyeCount + 15;
  const legendItems = [
    { label: 'AAA (7:1+)', color: '#22c55e' },
    { label: 'AA (4.5:1+)', color: '#eab308' },
    { label: 'Fail (<4.5:1)', color: '#ef4444' },
  ];

  ctx.font = '11px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  let legendX = padding;

  for (const item of legendItems) {
    // Draw badge
    const badgeWidth = 36;
    const badgeHeight = 18;
    ctx.fillStyle = item.color;
    ctx.beginPath();
    ctx.roundRect(legendX, legendY - badgeHeight / 2, badgeWidth, badgeHeight, 4);
    ctx.fill();

    // Draw badge label
    ctx.fillStyle = item.color === '#eab308' ? '#000000' : '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(item.label.split(' ')[0], legendX + badgeWidth / 2, legendY);

    // Draw ratio label
    ctx.textAlign = 'left';
    ctx.fillStyle = '#888888';
    ctx.fillText(item.label.split(' ').slice(1).join(' '), legendX + badgeWidth + 5, legendY);

    legendX += 130;
  }

  return canvas.toBuffer('image/png');
}
