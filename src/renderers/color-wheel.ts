/**
 * Color wheel renderer using @napi-rs/canvas
 * Generates a 400×400px color wheel with harmony indicators
 */

import { createCanvas } from '@napi-rs/canvas';
import { ColorService } from 'xivdyetools-core';

export interface ColorWheelOptions {
    baseHue: number; // 0-360
    harmonyAngles: number[]; // Array of hue angles for harmony colors
    width?: number;
    height?: number;
}

/**
 * Render a color wheel with harmony indicators
 */
export async function renderColorWheel(options: ColorWheelOptions): Promise<Buffer> {
    const width = options.width || 400;
    const height = options.height || 400;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    const centerX = width / 2;
    const centerY = height / 2;
    const outerRadius = Math.min(width, height) / 2 - 20;
    const innerRadius = outerRadius * 0.3;

    // Draw background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    // Draw color wheel (60 segments)
    const segments = 60;
    for (let i = 0; i < segments; i++) {
        const startAngle = (i / segments) * Math.PI * 2 - Math.PI / 2;
        const endAngle = ((i + 1) / segments) * Math.PI * 2 - Math.PI / 2;
        const hue = (i / segments) * 360;

        // Create gradient from center (white/desaturated) to edge (saturated)
        const gradient = ctx.createRadialGradient(
            centerX,
            centerY,
            innerRadius,
            centerX,
            centerY,
            outerRadius
        );

        const innerColor = ColorService.hsvToHex(hue, 20, 100);
        const outerColor = ColorService.hsvToHex(hue, 100, 100);

        gradient.addColorStop(0, innerColor);
        gradient.addColorStop(1, outerColor);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, outerRadius, startAngle, endAngle);
        ctx.closePath();
        ctx.fill();
    }

    // Draw center circle (removes center)
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
    ctx.fill();

    // Draw base color indicator (larger circle)
    drawHueIndicator(ctx, centerX, centerY, outerRadius, options.baseHue, '#ffffff', 8);

    // Draw harmony color indicators
    options.harmonyAngles.forEach((angle) => {
        drawHueIndicator(ctx, centerX, centerY, outerRadius, angle, '#ffffff', 6);
    });

    // Draw lines connecting harmony colors to center
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    options.harmonyAngles.forEach((angle) => {
        const angleRad = (angle - 90) * (Math.PI / 180);
        const x = centerX + Math.cos(angleRad) * outerRadius;
        const y = centerY + Math.sin(angleRad) * outerRadius;

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(x, y);
        ctx.stroke();
    });

    return canvas.toBuffer('image/png');
}

/**
 * Draw a hue indicator at a specific angle
 */
function drawHueIndicator(
    ctx: any,
    centerX: number,
    centerY: number,
    radius: number,
    hue: number,
    strokeColor: string,
    size: number
): void {
    const angleRad = (hue - 90) * (Math.PI / 180); // -90 to start from top
    const x = centerX + Math.cos(angleRad) * radius;
    const y = centerY + Math.sin(angleRad) * radius;

    // Draw circle
    ctx.strokeStyle = strokeColor;
    ctx.fillStyle = ColorService.hsvToHex(hue, 100, 100);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
}
