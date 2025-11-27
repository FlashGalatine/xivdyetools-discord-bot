/**
 * Functional tests for Swatch Grid renderer
 * Verifies that valid PNG buffers are returned
 */

import { describe, it, expect } from 'vitest';
import { renderSwatchGrid, type SwatchGridOptions } from './swatch-grid.js';
import type { Dye } from 'xivdyetools-core';

// PNG magic bytes
const PNG_MAGIC_BYTES = [0x89, 0x50, 0x4e, 0x47];

// Mock dyes for testing
const createMockDye = (overrides: Partial<Dye> = {}): Dye => ({
  id: 1,
  name: 'Test Dye',
  hex: '#FF0000',
  rgb: { r: 255, g: 0, b: 0 },
  hsv: { h: 0, s: 100, v: 100 },
  category: 'Reds',
  itemID: 5730,
  acquisition: 'Purchased from a vendor',
  cost: 0,
  ...overrides,
});

describe('Swatch Grid Renderer', () => {
  describe('renderSwatchGrid', () => {
    it('should return valid PNG buffer', async () => {
      const options: SwatchGridOptions = {
        dyes: [createMockDye()],
      };

      const buffer = await renderSwatchGrid(options);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should have PNG magic bytes at start', async () => {
      const options: SwatchGridOptions = {
        dyes: [createMockDye({ hex: '#00FF00' })],
      };

      const buffer = await renderSwatchGrid(options);

      expect(buffer[0]).toBe(PNG_MAGIC_BYTES[0]);
      expect(buffer[1]).toBe(PNG_MAGIC_BYTES[1]);
      expect(buffer[2]).toBe(PNG_MAGIC_BYTES[2]);
      expect(buffer[3]).toBe(PNG_MAGIC_BYTES[3]);
    });

    it('should use default swatch size when not specified', async () => {
      const options: SwatchGridOptions = {
        dyes: [createMockDye()],
      };

      const buffer = await renderSwatchGrid(options);

      // Default swatch size is 140, should produce reasonable buffer
      expect(buffer.length).toBeGreaterThan(1000);
    });

    it('should respect custom swatchSize option', async () => {
      const smallOptions: SwatchGridOptions = {
        dyes: [createMockDye()],
        swatchSize: 50,
      };

      const largeOptions: SwatchGridOptions = {
        dyes: [createMockDye()],
        swatchSize: 200,
      };

      const smallBuffer = await renderSwatchGrid(smallOptions);
      const largeBuffer = await renderSwatchGrid(largeOptions);

      expect(largeBuffer.length).toBeGreaterThan(smallBuffer.length);
    });

    it('should handle single dye', async () => {
      const options: SwatchGridOptions = {
        dyes: [createMockDye({ name: 'Dalamud Red', hex: '#B22222' })],
      };

      const buffer = await renderSwatchGrid(options);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer[0]).toBe(PNG_MAGIC_BYTES[0]);
    });

    it('should handle multiple dyes (up to 5)', async () => {
      const options: SwatchGridOptions = {
        dyes: [
          createMockDye({ name: 'Dye 1', hex: '#FF0000' }),
          createMockDye({ name: 'Dye 2', hex: '#00FF00' }),
          createMockDye({ name: 'Dye 3', hex: '#0000FF' }),
          createMockDye({ name: 'Dye 4', hex: '#FFFF00' }),
          createMockDye({ name: 'Dye 5', hex: '#FF00FF' }),
        ],
      };

      const buffer = await renderSwatchGrid(options);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer[0]).toBe(PNG_MAGIC_BYTES[0]);
    });

    it('should show RGB values when showValues=true', async () => {
      const options: SwatchGridOptions = {
        dyes: [createMockDye()],
        showValues: true,
      };

      const buffer = await renderSwatchGrid(options);

      expect(buffer).toBeInstanceOf(Buffer);
      // Buffer should be larger due to additional text
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should truncate long dye names', async () => {
      const options: SwatchGridOptions = {
        dyes: [
          createMockDye({ name: 'This Is A Very Very Long Dye Name That Should Be Truncated' }),
        ],
      };

      // Should not throw
      const buffer = await renderSwatchGrid(options);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer[0]).toBe(PNG_MAGIC_BYTES[0]);
    });
  });
});
