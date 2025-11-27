/**
 * Functional tests for Gradient renderer
 * Verifies that valid PNG buffers are returned
 */

import { describe, it, expect } from 'vitest';
import { renderGradient, type GradientOptions } from './gradient.js';

// PNG magic bytes
const PNG_MAGIC_BYTES = [0x89, 0x50, 0x4e, 0x47];

describe('Gradient Renderer', () => {
  describe('renderGradient', () => {
    it('should return valid PNG buffer', async () => {
      const options: GradientOptions = {
        startColor: '#FF0000',
        endColor: '#0000FF',
        steps: 5,
      };

      const buffer = await renderGradient(options);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should have PNG magic bytes at start', async () => {
      const options: GradientOptions = {
        startColor: '#00FF00',
        endColor: '#FF00FF',
        steps: 3,
      };

      const buffer = await renderGradient(options);

      expect(buffer[0]).toBe(PNG_MAGIC_BYTES[0]);
      expect(buffer[1]).toBe(PNG_MAGIC_BYTES[1]);
      expect(buffer[2]).toBe(PNG_MAGIC_BYTES[2]);
      expect(buffer[3]).toBe(PNG_MAGIC_BYTES[3]);
    });

    it('should generate correct number of intermediate colors', async () => {
      const options: GradientOptions = {
        startColor: '#000000',
        endColor: '#FFFFFF',
        steps: 6,
      };

      // Should not throw
      const buffer = await renderGradient(options);
      expect(buffer).toBeInstanceOf(Buffer);
    });

    it('should use provided intermediateColors when given', async () => {
      const options: GradientOptions = {
        startColor: '#FF0000',
        endColor: '#0000FF',
        steps: 3,
        intermediateColors: ['#FF0000', '#FF00FF', '#0000FF'],
      };

      const buffer = await renderGradient(options);
      expect(buffer).toBeInstanceOf(Buffer);
    });

    it('should throw when intermediateColors count mismatches steps', async () => {
      const options: GradientOptions = {
        startColor: '#FF0000',
        endColor: '#0000FF',
        steps: 5,
        intermediateColors: ['#FF0000', '#0000FF'], // Only 2, but steps is 5
      };

      await expect(renderGradient(options)).rejects.toThrow('Expected 5 colors, got 2');
    });

    it('should include dye names in output when provided', async () => {
      const options: GradientOptions = {
        startColor: '#FF0000',
        endColor: '#0000FF',
        steps: 3,
        dyeNames: ['Dalamud Red', 'Purple Haze', 'Royal Blue'],
      };

      const buffer = await renderGradient(options);
      expect(buffer).toBeInstanceOf(Buffer);
    });

    it('should use default dimensions when not specified', async () => {
      const options: GradientOptions = {
        startColor: '#FF0000',
        endColor: '#0000FF',
        steps: 4,
      };

      const buffer = await renderGradient(options);

      // Default is 800x200, should be substantial
      expect(buffer.length).toBeGreaterThan(1000);
    });

    it('should respect custom width/height', async () => {
      const smallOptions: GradientOptions = {
        startColor: '#FF0000',
        endColor: '#0000FF',
        steps: 3,
        width: 200,
        height: 50,
      };

      const largeOptions: GradientOptions = {
        startColor: '#FF0000',
        endColor: '#0000FF',
        steps: 3,
        width: 1000,
        height: 300,
      };

      const smallBuffer = await renderGradient(smallOptions);
      const largeBuffer = await renderGradient(largeOptions);

      expect(largeBuffer.length).toBeGreaterThan(smallBuffer.length);
    });

    it('should handle 2-step gradient (minimum)', async () => {
      const options: GradientOptions = {
        startColor: '#000000',
        endColor: '#FFFFFF',
        steps: 2,
      };

      const buffer = await renderGradient(options);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer[0]).toBe(PNG_MAGIC_BYTES[0]);
    });

    it('should handle 10-step gradient (maximum)', async () => {
      const options: GradientOptions = {
        startColor: '#FF0000',
        endColor: '#00FF00',
        steps: 10,
      };

      const buffer = await renderGradient(options);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer[0]).toBe(PNG_MAGIC_BYTES[0]);
    });
  });
});
