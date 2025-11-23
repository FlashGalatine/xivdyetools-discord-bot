/**
 * Gradient renderer using @napi-rs/canvas
 * Generates a horizontal color gradient with step labels
 */

import { createCanvas } from '@napi-rs/canvas';
import { ColorService } from 'xivdyetools-core';

export interface GradientOptions {
    startColor: string; // Hex color
    endColor: string; // Hex color
    steps: number; // Number of intermediate colors (including start and end)
    intermediateColors?: string[]; // Optional precomputed intermediate hex colors
    dyeNames?: string[]; // Optional dye names for each step
    width?: number;
    height?: number;
}

/**
 * Interpolate between two colors in RGB space
 */
function interpolateColor(color1: string, color2: string, ratio: number): string {
    const rgb1 = ColorService.hexToRgb(color1);
    const rgb2 = ColorService.hexToRgb(color2);

    const r = Math.round(rgb1.r + (rgb2.r - rgb1.r) * ratio);
    const g = Math.round(rgb1.g + (rgb2.g - rgb1.g) * ratio);
    const b = Math.round(rgb1.b + (rgb2.b - rgb1.b) * ratio);

    return ColorService.rgbToHex(r, g, b);
}

/**
 * Generate intermediate colors between start and end
 */
function generateGradientColors(startColor: string, endColor: string, steps: number): string[] {
    const colors: string[] = [];

    for (let i = 0; i < steps; i++) {
        const ratio = steps > 1 ? i / (steps - 1) : 0;
        colors.push(interpolateColor(startColor, endColor, ratio));
    }

    return colors;
}

/**
 * Render a horizontal gradient with step labels
 */
export async function renderGradient(options: GradientOptions): Promise<Buffer> {
    const width = options.width || 800;
    const height = options.height || 200; // Increased for labels
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Use provided intermediate colors or generate them
    const colors = options.intermediateColors ||
                   generateGradientColors(options.startColor, options.endColor, options.steps);

    // Ensure we have the correct number of colors
    if (colors.length !== options.steps) {
        throw new Error(`Expected ${options.steps} colors, got ${colors.length}`);
    }

    // Draw background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    // Calculate gradient bar dimensions
    const barHeight = 80;
    const barTop = 30;
    const barWidth = width - 60;
    const barLeft = 30;

    // Draw gradient bar using rectangles for each step
    const stepWidth = barWidth / options.steps;
    colors.forEach((color, index) => {
        ctx.fillStyle = color;
        ctx.fillRect(
            barLeft + index * stepWidth,
            barTop,
            stepWidth + 1, // +1 to avoid gaps
            barHeight
        );
    });

    // Draw border around gradient bar
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(barLeft, barTop, barWidth, barHeight);

    // Draw step indicators and labels
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';

    colors.forEach((color, index) => {
        const x = barLeft + index * stepWidth + stepWidth / 2;

        // Draw tick mark
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, barTop + barHeight);
        ctx.lineTo(x, barTop + barHeight + 10);
        ctx.stroke();

        // Draw hex label
        ctx.fillStyle = '#ffffff';
        ctx.fillText(color.toUpperCase(), x, barTop + barHeight + 25);

        // Draw dye name if provided
        if (options.dyeNames && options.dyeNames[index]) {
            ctx.font = '11px sans-serif';
            ctx.fillStyle = '#aaaaaa';

            // Truncate long names
            let dyeName = options.dyeNames[index];
            if (dyeName.length > 15) {
                dyeName = dyeName.substring(0, 12) + '...';
            }

            ctx.fillText(dyeName, x, barTop + barHeight + 40);
            ctx.font = 'bold 12px sans-serif'; // Reset font
        }
    });

    // Draw start/end labels at top
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('START', barLeft, barTop - 10);

    ctx.textAlign = 'right';
    ctx.fillText('END', barLeft + barWidth, barTop - 10);

    return canvas.toBuffer('image/png');
}
