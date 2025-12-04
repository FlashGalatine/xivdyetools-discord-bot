/**
 * Functional tests for Accessibility Contrast Matrix renderer
 * Verifies that valid PNG buffers are returned and contrast calculations are correct
 */

import { describe, it, expect } from 'vitest';
import {
  renderContrastMatrix,
  calculateContrast,
  getWCAGLevel,
  type ContrastMatrixOptions,
  type ContrastResult,
} from './accessibility-matrix.js';

// PNG magic bytes
const PNG_MAGIC_BYTES = [0x89, 0x50, 0x4e, 0x47];

describe('Accessibility Contrast Matrix Renderer', () => {
  describe('getWCAGLevel', () => {
    it('should return AAA for ratio >= 7', () => {
      expect(getWCAGLevel(7)).toBe('AAA');
      expect(getWCAGLevel(7.5)).toBe('AAA');
      expect(getWCAGLevel(21)).toBe('AAA');
    });

    it('should return AA for ratio >= 4.5 and < 7', () => {
      expect(getWCAGLevel(4.5)).toBe('AA');
      expect(getWCAGLevel(5)).toBe('AA');
      expect(getWCAGLevel(6.99)).toBe('AA');
    });

    it('should return Fail for ratio < 4.5', () => {
      expect(getWCAGLevel(4.49)).toBe('Fail');
      expect(getWCAGLevel(3)).toBe('Fail');
      expect(getWCAGLevel(1)).toBe('Fail');
    });

    it('should handle edge cases', () => {
      expect(getWCAGLevel(0)).toBe('Fail');
      expect(getWCAGLevel(4.5)).toBe('AA');
      expect(getWCAGLevel(7)).toBe('AAA');
    });
  });

  describe('calculateContrast', () => {
    it('should return correct contrast result for black and white', () => {
      const result = calculateContrast('#000000', '#FFFFFF');

      expect(result.ratio).toBeCloseTo(21, 0);
      expect(result.level).toBe('AAA');
    });

    it('should return correct contrast result for same colors', () => {
      const result = calculateContrast('#FF0000', '#FF0000');

      expect(result.ratio).toBeCloseTo(1, 0);
      expect(result.level).toBe('Fail');
    });

    it('should return AAA level for high contrast colors', () => {
      const result = calculateContrast('#000000', '#FFFFFF');

      expect(result.level).toBe('AAA');
      expect(result.ratio).toBeGreaterThanOrEqual(7);
    });

    it('should return AA level for medium contrast colors', () => {
      // Gray on white typically gives AA level
      const result = calculateContrast('#767676', '#FFFFFF');

      expect(result.level).toBe('AA');
      expect(result.ratio).toBeGreaterThanOrEqual(4.5);
      expect(result.ratio).toBeLessThan(7);
    });

    it('should return Fail level for low contrast colors', () => {
      const result = calculateContrast('#DDDDDD', '#FFFFFF');

      expect(result.level).toBe('Fail');
      expect(result.ratio).toBeLessThan(4.5);
    });

    it('should handle lowercase hex codes', () => {
      const result = calculateContrast('#ffffff', '#000000');

      expect(result.ratio).toBeCloseTo(21, 0);
      expect(result.level).toBe('AAA');
    });

    it('should return ContrastResult with required properties', () => {
      const result: ContrastResult = calculateContrast('#FF0000', '#00FF00');

      expect(result).toHaveProperty('ratio');
      expect(result).toHaveProperty('level');
      expect(typeof result.ratio).toBe('number');
      expect(['AAA', 'AA', 'Fail']).toContain(result.level);
    });
  });

  describe('renderContrastMatrix', () => {
    it('should return valid PNG buffer', () => {
      const options: ContrastMatrixOptions = {
        dyes: [
          { name: 'Red', hex: '#FF0000' },
          { name: 'Blue', hex: '#0000FF' },
        ],
      };

      const buffer = renderContrastMatrix(options);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should have PNG magic bytes at start', () => {
      const options: ContrastMatrixOptions = {
        dyes: [
          { name: 'Green', hex: '#00FF00' },
          { name: 'Yellow', hex: '#FFFF00' },
        ],
      };

      const buffer = renderContrastMatrix(options);

      expect(buffer[0]).toBe(PNG_MAGIC_BYTES[0]);
      expect(buffer[1]).toBe(PNG_MAGIC_BYTES[1]);
      expect(buffer[2]).toBe(PNG_MAGIC_BYTES[2]);
      expect(buffer[3]).toBe(PNG_MAGIC_BYTES[3]);
    });

    it('should render matrix with 2 dyes', () => {
      const options: ContrastMatrixOptions = {
        dyes: [
          { name: 'Dye 1', hex: '#FF0000' },
          { name: 'Dye 2', hex: '#00FF00' },
        ],
      };

      const buffer = renderContrastMatrix(options);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(1000);
    });

    it('should render matrix with multiple dyes', () => {
      const options: ContrastMatrixOptions = {
        dyes: [
          { name: 'Red', hex: '#FF0000' },
          { name: 'Green', hex: '#00FF00' },
          { name: 'Blue', hex: '#0000FF' },
          { name: 'Yellow', hex: '#FFFF00' },
        ],
      };

      const buffer = renderContrastMatrix(options);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer[0]).toBe(PNG_MAGIC_BYTES[0]);
    });

    it('should render larger buffer for more dyes', () => {
      const smallOptions: ContrastMatrixOptions = {
        dyes: [
          { name: 'Red', hex: '#FF0000' },
          { name: 'Blue', hex: '#0000FF' },
        ],
      };

      const largeOptions: ContrastMatrixOptions = {
        dyes: [
          { name: 'Red', hex: '#FF0000' },
          { name: 'Green', hex: '#00FF00' },
          { name: 'Blue', hex: '#0000FF' },
          { name: 'Yellow', hex: '#FFFF00' },
          { name: 'Cyan', hex: '#00FFFF' },
        ],
      };

      const smallBuffer = renderContrastMatrix(smallOptions);
      const largeBuffer = renderContrastMatrix(largeOptions);

      expect(largeBuffer.length).toBeGreaterThan(smallBuffer.length);
    });

    it('should render matrix with title', () => {
      const options: ContrastMatrixOptions = {
        dyes: [
          { name: 'Red', hex: '#FF0000' },
          { name: 'Blue', hex: '#0000FF' },
        ],
        title: 'Contrast Matrix Test',
      };

      const buffer = renderContrastMatrix(options);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer[0]).toBe(PNG_MAGIC_BYTES[0]);
    });

    it('should render larger buffer with title than without', () => {
      const dyes = [
        { name: 'Red', hex: '#FF0000' },
        { name: 'Blue', hex: '#0000FF' },
      ];

      const withoutTitle = renderContrastMatrix({ dyes });
      const withTitle = renderContrastMatrix({ dyes, title: 'Test Title' });

      // Title adds height to the image
      expect(withTitle.length).toBeGreaterThan(withoutTitle.length);
    });

    it('should handle long dye names (truncation)', () => {
      const options: ContrastMatrixOptions = {
        dyes: [
          { name: 'This Is A Very Very Long Dye Name That Should Be Truncated', hex: '#FF0000' },
          { name: 'Another Extremely Long Dye Name For Testing Purposes', hex: '#0000FF' },
        ],
      };

      // Should not throw
      const buffer = renderContrastMatrix(options);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer[0]).toBe(PNG_MAGIC_BYTES[0]);
    });

    it('should handle high contrast color pairs', () => {
      const options: ContrastMatrixOptions = {
        dyes: [
          { name: 'Black', hex: '#000000' },
          { name: 'White', hex: '#FFFFFF' },
        ],
      };

      const buffer = renderContrastMatrix(options);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer[0]).toBe(PNG_MAGIC_BYTES[0]);
    });

    it('should handle low contrast color pairs', () => {
      const options: ContrastMatrixOptions = {
        dyes: [
          { name: 'Light Gray', hex: '#DDDDDD' },
          { name: 'White', hex: '#FFFFFF' },
        ],
      };

      const buffer = renderContrastMatrix(options);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer[0]).toBe(PNG_MAGIC_BYTES[0]);
    });

    it('should handle similar colors (same color)', () => {
      const options: ContrastMatrixOptions = {
        dyes: [
          { name: 'Red 1', hex: '#FF0000' },
          { name: 'Red 2', hex: '#FF0000' },
        ],
      };

      const buffer = renderContrastMatrix(options);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer[0]).toBe(PNG_MAGIC_BYTES[0]);
    });

    it('should render diagonal cells differently (same color comparison)', () => {
      const options: ContrastMatrixOptions = {
        dyes: [
          { name: 'Red', hex: '#FF0000' },
          { name: 'Blue', hex: '#0000FF' },
          { name: 'Green', hex: '#00FF00' },
        ],
      };

      // Should render without errors (diagonal has special handling)
      const buffer = renderContrastMatrix(options);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer[0]).toBe(PNG_MAGIC_BYTES[0]);
    });

    it('should handle maximum typical dye count (5 dyes)', () => {
      const options: ContrastMatrixOptions = {
        dyes: [
          { name: 'Dye 1', hex: '#FF0000' },
          { name: 'Dye 2', hex: '#00FF00' },
          { name: 'Dye 3', hex: '#0000FF' },
          { name: 'Dye 4', hex: '#FFFF00' },
          { name: 'Dye 5', hex: '#FF00FF' },
        ],
        title: '5x5 Contrast Matrix',
      };

      const buffer = renderContrastMatrix(options);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer[0]).toBe(PNG_MAGIC_BYTES[0]);
      // 5x5 matrix should be reasonably large
      expect(buffer.length).toBeGreaterThan(10000);
    });

    it('should handle lowercase hex codes', () => {
      const options: ContrastMatrixOptions = {
        dyes: [
          { name: 'Red', hex: '#ff0000' },
          { name: 'Blue', hex: '#0000ff' },
        ],
      };

      const buffer = renderContrastMatrix(options);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer[0]).toBe(PNG_MAGIC_BYTES[0]);
    });

    it('should include legend in output', () => {
      const options: ContrastMatrixOptions = {
        dyes: [
          { name: 'Red', hex: '#FF0000' },
          { name: 'Blue', hex: '#0000FF' },
        ],
      };

      // Legend adds height to the canvas, so buffer should be of reasonable size
      const buffer = renderContrastMatrix(options);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(5000);
    });
  });

  describe('contrast matrix calculations', () => {
    it('should calculate symmetric contrast ratios', () => {
      // Contrast ratio should be the same regardless of order
      const result1 = calculateContrast('#FF0000', '#00FF00');
      const result2 = calculateContrast('#00FF00', '#FF0000');

      expect(result1.ratio).toBeCloseTo(result2.ratio, 2);
      expect(result1.level).toBe(result2.level);
    });

    it('should give maximum contrast for black and white', () => {
      const result = calculateContrast('#000000', '#FFFFFF');

      // Maximum contrast ratio is 21:1
      expect(result.ratio).toBeCloseTo(21, 0);
    });

    it('should give minimum contrast for same colors', () => {
      const result = calculateContrast('#AABBCC', '#AABBCC');

      // Minimum contrast ratio is 1:1
      expect(result.ratio).toBeCloseTo(1, 0);
    });
  });
});
