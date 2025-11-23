/**
 * Swatch grid renderer using @napi-rs/canvas
 * Generates a horizontal grid of color swatches for comparison
 */

import { createCanvas } from '@napi-rs/canvas';
import type { Dye } from 'xivdyetools-core';

export interface SwatchGridOptions {
    dyes: Dye[];
    width?: number;
    swatchSize?: number;
    showValues?: boolean;
}

/**
 * Render a horizontal grid of color swatches
 */
export async function renderSwatchGrid(options: SwatchGridOptions): Promise<Buffer> {
    const dyes = options.dyes;
    const swatchSize = options.swatchSize || 140;
    const spacing = 20;
    const labelHeight = options.showValues ? 80 : 60;

    // Calculate canvas dimensions
    const canvasWidth = (swatchSize + spacing) * dyes.length + spacing;
    const canvasHeight = swatchSize + labelHeight + spacing * 2;

    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    // Draw background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw each dye swatch
    dyes.forEach((dye, index) => {
        const x = spacing + index * (swatchSize + spacing);
        const y = spacing;

        // Draw color swatch
        ctx.fillStyle = dye.hex;
        ctx.fillRect(x, y, swatchSize, swatchSize);

        // Draw border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, swatchSize, swatchSize);

        // Draw dye name
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';

        // Truncate long names
        let dyeName = dye.name;
        if (dyeName.length > 18) {
            dyeName = dyeName.substring(0, 15) + '...';
        }

        ctx.fillText(dyeName, x + swatchSize / 2, y + swatchSize + 25);

        // Draw hex code
        ctx.font = '12px monospace';
        ctx.fillStyle = '#aaaaaa';
        ctx.fillText(dye.hex.toUpperCase(), x + swatchSize / 2, y + swatchSize + 42);

        // Optionally draw RGB/HSV values
        if (options.showValues) {
            // Parse hex to RGB
            const r = parseInt(dye.hex.slice(1, 3), 16);
            const g = parseInt(dye.hex.slice(3, 5), 16);
            const b = parseInt(dye.hex.slice(5, 7), 16);

            ctx.font = '10px sans-serif';
            ctx.fillStyle = '#888888';
            ctx.fillText(`RGB(${r},${g},${b})`, x + swatchSize / 2, y + swatchSize + 58);
        }
    });

    return canvas.toBuffer('image/png');
}
