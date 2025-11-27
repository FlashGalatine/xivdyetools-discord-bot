/**
 * Functional tests for Color Wheel renderer
 * Verifies that valid PNG buffers are returned
 */

import { describe, it, expect } from 'vitest';
import { renderColorWheel, type ColorWheelOptions } from './color-wheel.js';

// PNG magic bytes
const PNG_MAGIC_BYTES = [0x89, 0x50, 0x4e, 0x47];

describe('Color Wheel Renderer', () => {
  describe('renderColorWheel', () => {
    it('should return valid PNG buffer', async () => {
      const options: ColorWheelOptions = {
        baseHue: 0,
        harmonyAngles: [180],
      };

      const buffer = await renderColorWheel(options);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should have PNG magic bytes at start', async () => {
      const options: ColorWheelOptions = {
        baseHue: 120,
        harmonyAngles: [240, 0],
      };

      const buffer = await renderColorWheel(options);

      // Check first 4 bytes match PNG signature
      expect(buffer[0]).toBe(PNG_MAGIC_BYTES[0]);
      expect(buffer[1]).toBe(PNG_MAGIC_BYTES[1]);
      expect(buffer[2]).toBe(PNG_MAGIC_BYTES[2]);
      expect(buffer[3]).toBe(PNG_MAGIC_BYTES[3]);
    });

    it('should use default dimensions when not specified', async () => {
      const options: ColorWheelOptions = {
        baseHue: 0,
        harmonyAngles: [],
      };

      const buffer = await renderColorWheel(options);

      // Default is 400x400, so buffer should be substantial
      expect(buffer.length).toBeGreaterThan(1000);
    });

    it('should respect custom width/height options', async () => {
      const smallOptions: ColorWheelOptions = {
        baseHue: 0,
        harmonyAngles: [],
        width: 100,
        height: 100,
      };

      const largeOptions: ColorWheelOptions = {
        baseHue: 0,
        harmonyAngles: [],
        width: 600,
        height: 600,
      };

      const smallBuffer = await renderColorWheel(smallOptions);
      const largeBuffer = await renderColorWheel(largeOptions);

      // Larger image should have larger buffer (generally)
      expect(largeBuffer.length).toBeGreaterThan(smallBuffer.length);
    });

    it('should handle empty harmonyAngles array', async () => {
      const options: ColorWheelOptions = {
        baseHue: 90,
        harmonyAngles: [],
      };

      const buffer = await renderColorWheel(options);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer[0]).toBe(PNG_MAGIC_BYTES[0]);
    });

    it('should handle multiple harmonyAngles', async () => {
      const options: ColorWheelOptions = {
        baseHue: 0,
        harmonyAngles: [30, 60, 90, 120, 150, 180],
      };

      const buffer = await renderColorWheel(options);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should handle edge case baseHue = 0', async () => {
      const options: ColorWheelOptions = {
        baseHue: 0,
        harmonyAngles: [180],
      };

      const buffer = await renderColorWheel(options);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer[0]).toBe(PNG_MAGIC_BYTES[0]);
    });

    it('should handle edge case baseHue = 360', async () => {
      const options: ColorWheelOptions = {
        baseHue: 360,
        harmonyAngles: [180],
      };

      const buffer = await renderColorWheel(options);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer[0]).toBe(PNG_MAGIC_BYTES[0]);
    });
  });
});
