/**
 * Accessibility comparison renderer using @napi-rs/canvas
 * Generates a grid showing normal vision + colorblind simulations
 */

import { createCanvas, type SKRSContext2D } from '@napi-rs/canvas';
import { ColorService } from 'xivdyetools-core';

export type VisionType = 'protanopia' | 'deuteranopia' | 'tritanopia';

export interface AccessibilityComparisonOptions {
    dyeHex: string;
    dyeName: string;
    visionTypes?: VisionType[]; // If not specified, show all 3
}

interface SwatchData {
    label: string;
    hex: string;
    description: string;
}

/**
 * Render accessibility comparison grid
 */
export async function renderAccessibilityComparison(
    options: AccessibilityComparisonOptions
): Promise<Buffer> {
    const { dyeHex, dyeName, visionTypes } = options;

    // Build swatch data
    const swatches: SwatchData[] = [
        {
            label: 'Normal Vision',
            hex: dyeHex,
            description: 'Original color',
        },
    ];

    // Add requested vision types (or all if not specified)
    const types: VisionType[] = visionTypes || ['protanopia', 'deuteranopia', 'tritanopia'];

    for (const visionType of types) {
        const simulatedRgb = ColorService.simulateColorblindness(ColorService.hexToRgb(dyeHex), visionType);
        const simulatedHex = ColorService.rgbToHex(simulatedRgb.r, simulatedRgb.g, simulatedRgb.b);
        swatches.push({
            label: getVisionTypeLabel(visionType),
            hex: simulatedHex,
            description: getVisionTypeDescription(visionType),
        });
    }

    // Layout configuration
    const swatchSize = 160;
    const spacing = 20;
    const labelHeight = 100;
    const titleHeight = 60;

    // Determine grid dimensions
    const totalSwatches = swatches.length;
    let columns: number;
    let rows: number;

    if (totalSwatches === 2) {
        // 1x2 horizontal layout (normal + one type)
        columns = 2;
        rows = 1;
    } else if (totalSwatches === 4) {
        // 2x2 grid (normal + all 3 types)
        columns = 2;
        rows = 2;
    } else {
        // Fallback to horizontal layout
        columns = totalSwatches;
        rows = 1;
    }

    // Calculate canvas dimensions
    const canvasWidth = spacing + columns * (swatchSize + spacing);
    const canvasHeight = titleHeight + rows * (swatchSize + labelHeight + spacing) + spacing;

    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    // Draw background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(dyeName, canvasWidth / 2, 35);

    // Draw each swatch
    swatches.forEach((swatch, index) => {
        const col = index % columns;
        const row = Math.floor(index / columns);

        const x = spacing + col * (swatchSize + spacing);
        const y = titleHeight + spacing + row * (swatchSize + labelHeight + spacing);

        // Draw color swatch
        ctx.fillStyle = swatch.hex;
        ctx.fillRect(x, y, swatchSize, swatchSize);

        // Draw border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, swatchSize, swatchSize);

        // Draw label
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(swatch.label, x + swatchSize / 2, y + swatchSize + 20);

        // Draw hex code
        ctx.font = '12px monospace';
        ctx.fillStyle = '#aaaaaa';
        ctx.fillText(swatch.hex.toUpperCase(), x + swatchSize / 2, y + swatchSize + 38);

        // Draw description (wrap if needed)
        ctx.font = '11px sans-serif';
        ctx.fillStyle = '#888888';
        const descLines = wrapText(ctx, swatch.description, swatchSize - 10);
        descLines.forEach((line, lineIndex) => {
            ctx.fillText(line, x + swatchSize / 2, y + swatchSize + 56 + lineIndex * 14);
        });
    });

    return canvas.toBuffer('image/png');
}

/**
 * Get human-readable label for vision type
 */
function getVisionTypeLabel(visionType: VisionType): string {
    switch (visionType) {
        case 'protanopia':
            return 'Protanopia';
        case 'deuteranopia':
            return 'Deuteranopia';
        case 'tritanopia':
            return 'Tritanopia';
    }
}

/**
 * Get description for vision type
 */
function getVisionTypeDescription(visionType: VisionType): string {
    switch (visionType) {
        case 'protanopia':
            return 'Red-blind (~1% of males)';
        case 'deuteranopia':
            return 'Green-blind (~1% of males)';
        case 'tritanopia':
            return 'Blue-blind (rare)';
    }
}

/**
 * Wrap text to fit within a max width
 */
function wrapText(ctx: SKRSContext2D, text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const metrics = ctx.measureText(testLine);

        if (metrics.width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = testLine;
        }
    }

    if (currentLine) {
        lines.push(currentLine);
    }

    return lines;
}
