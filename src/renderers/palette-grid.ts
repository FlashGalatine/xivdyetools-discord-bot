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

/**
 * Source image data for sampling indicators
 */
export interface SourceImageData {
  /** Raw pixel data (RGB, 3 bytes per pixel) */
  pixels: Buffer;
  /** Image width in pixels */
  width: number;
  /** Image height in pixels */
  height: number;
}

export interface PaletteGridOptions {
  /** Array of palette entries to render */
  colors: PaletteGridEntry[];
  /** Canvas width (default: 800) */
  width?: number;
  /** Show distance values (default: true) */
  showDistance?: boolean;
  /** Optional source image data for sampling indicators */
  sourceImage?: SourceImageData;
}

/**
 * Convert RGB to hex string
 */
function rgbToHex(rgb: RGB): string {
  const toHex = (n: number): string =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`.toUpperCase();
}

/**
 * Find representative pixel positions for each extracted color
 * Uses grid sampling for performance
 */
function findColorPositions(
  sourceImage: SourceImageData,
  colors: PaletteGridEntry[]
): Array<{ x: number; y: number }> {
  const { pixels, width, height } = sourceImage;

  // Track best match (closest pixel) for each color
  const positions: Array<{ x: number; y: number; distance: number }> = colors.map(() => ({
    x: width / 2,
    y: height / 2,
    distance: Infinity,
  }));

  // Grid sampling step size (sample ~10000 pixels max)
  const step = Math.max(1, Math.floor(Math.sqrt((width * height) / 10000)));

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const idx = (y * width + x) * 3; // RGB, 3 bytes per pixel
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];

      // Check against each extracted color
      for (let i = 0; i < colors.length; i++) {
        const extracted = colors[i].extracted;
        const dr = r - extracted.r;
        const dg = g - extracted.g;
        const db = b - extracted.b;
        const dist = Math.sqrt(dr * dr + dg * dg + db * db);

        if (dist < positions[i].distance) {
          positions[i] = { x, y, distance: dist };
        }
      }
    }
  }

  return positions.map((p) => ({ x: p.x, y: p.y }));
}

/**
 * Render a palette grid showing extracted colors and matched dyes
 *
 * Layout (without source image):
 * ┌────────────────────────────────────────────────────────────┐
 * │  EXTRACTED          →          MATCHED DYE                 │
 * ├────────────────────────────────────────────────────────────┤
 * │  [██████] 42%       →   [██████] Dalamud Red               │
 * │  #B01515                #AA1111  Δ12.3                     │
 * ├────────────────────────────────────────────────────────────┤
 * │  [██████] 31%       →   [██████] Jet Black                 │
 * │  #0C0C0C                #0A0A0A  Δ5.7                      │
 * └────────────────────────────────────────────────────────────┘
 *
 * Layout (with source image):
 * ┌────────────────────────────────────────────────────────────┐
 * │  [Source image with sampling indicator circles]            │
 * ├────────────────────────────────────────────────────────────┤
 * │  EXTRACTED          →          MATCHED DYE                 │
 * │  ... (same as above)                                       │
 * └────────────────────────────────────────────────────────────┘
 */
export async function renderPaletteGrid(options: PaletteGridOptions): Promise<Buffer> {
  // Async to allow future enhancements (e.g., image loading from URL)
  await Promise.resolve();

  const { colors, showDistance = true, sourceImage } = options;
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

  // Calculate image section height if source image provided
  let imageHeight = 0;
  let imageScale = 1;
  let imageOffsetX = 0;
  let scaledImageWidth = 0;
  let scaledImageHeight = 0;

  if (sourceImage) {
    // Scale image to fit within canvas width (with padding)
    const maxImageWidth = width - padding * 2;
    const maxImageHeight = 300; // Max height for the image section

    imageScale = Math.min(maxImageWidth / sourceImage.width, maxImageHeight / sourceImage.height);
    scaledImageWidth = sourceImage.width * imageScale;
    scaledImageHeight = sourceImage.height * imageScale;
    imageOffsetX = (width - scaledImageWidth) / 2;
    imageHeight = scaledImageHeight + padding * 2;
  }

  // Calculate heights
  const contentHeight = colors.length * rowHeight;
  const height = imageHeight + headerHeight + contentHeight + padding * 2;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Draw background with dark theme
  ctx.fillStyle = '#1e1e2e';
  ctx.fillRect(0, 0, width, height);

  // Draw source image with sampling indicators if provided
  if (sourceImage) {
    // Create an image from raw RGB pixel data
    // We need to convert RGB to RGBA for the canvas
    const rgbaData = new Uint8ClampedArray(sourceImage.width * sourceImage.height * 4);
    for (let i = 0; i < sourceImage.width * sourceImage.height; i++) {
      rgbaData[i * 4] = sourceImage.pixels[i * 3]; // R
      rgbaData[i * 4 + 1] = sourceImage.pixels[i * 3 + 1]; // G
      rgbaData[i * 4 + 2] = sourceImage.pixels[i * 3 + 2]; // B
      rgbaData[i * 4 + 3] = 255; // A (fully opaque)
    }

    // Create a temporary canvas for the source image
    const tempCanvas = createCanvas(sourceImage.width, sourceImage.height);
    const tempCtx = tempCanvas.getContext('2d');
    const imageData = tempCtx.createImageData(sourceImage.width, sourceImage.height);
    imageData.data.set(rgbaData);
    tempCtx.putImageData(imageData, 0, 0);

    // Draw the scaled image onto the main canvas
    ctx.drawImage(
      tempCanvas,
      0,
      0,
      sourceImage.width,
      sourceImage.height,
      imageOffsetX,
      padding,
      scaledImageWidth,
      scaledImageHeight
    );

    // Find color positions and draw sampling indicators
    const positions = findColorPositions(sourceImage, colors);

    // Draw sampling indicator circles
    const minDimension = Math.min(scaledImageWidth, scaledImageHeight);
    const indicatorRadius = Math.max(10, Math.min(30, minDimension * 0.04));

    for (let i = 0; i < colors.length; i++) {
      const pos = positions[i];
      const color = colors[i];

      // Scale position to match displayed image
      const scaledX = imageOffsetX + pos.x * imageScale;
      const scaledY = padding + pos.y * imageScale;

      // Outer white ring (for visibility on any background)
      ctx.beginPath();
      ctx.arc(scaledX, scaledY, indicatorRadius + 3, 0, Math.PI * 2);
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Inner colored ring (matching the extracted color)
      ctx.beginPath();
      ctx.arc(scaledX, scaledY, indicatorRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgb(${color.extracted.r}, ${color.extracted.g}, ${color.extracted.b})`;
      ctx.lineWidth = 3;
      ctx.stroke();

      // Center dot with white outline
      ctx.beginPath();
      ctx.arc(scaledX, scaledY, 4, 0, Math.PI * 2);
      ctx.fillStyle = 'white';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(scaledX, scaledY, 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgb(${color.extracted.r}, ${color.extracted.g}, ${color.extracted.b})`;
      ctx.fill();
    }

    // Draw separator line below image
    ctx.strokeStyle = '#3a3a4a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, imageHeight - 5);
    ctx.lineTo(width - padding, imageHeight - 5);
    ctx.stroke();
  }

  // Offset for grid content (below image if present)
  const gridOffsetY = imageHeight;

  // Draw header
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('EXTRACTED', padding + swatchSize + 15, gridOffsetY + padding + 30);
  ctx.fillText('MATCHED DYE', width / 2 + 30, gridOffsetY + padding + 30);

  // Draw header separator
  ctx.strokeStyle = '#3a3a4a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, gridOffsetY + headerHeight + padding - 5);
  ctx.lineTo(width - padding, gridOffsetY + headerHeight + padding - 5);
  ctx.stroke();

  // Draw each color row
  colors.forEach((entry, index) => {
    const y = gridOffsetY + headerHeight + padding + index * rowHeight;

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
