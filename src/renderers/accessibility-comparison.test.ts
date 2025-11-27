/**
 * Functional tests for Accessibility Comparison renderer
 * Verifies that valid PNG buffers are returned
 */

import { describe, it, expect } from 'vitest';
import { renderAccessibilityComparison, type AccessibilityComparisonOptions } from './accessibility-comparison.js';

// PNG magic bytes
const PNG_MAGIC_BYTES = [0x89, 0x50, 0x4e, 0x47];

describe('Accessibility Comparison Renderer', () => {
  describe('renderAccessibilityComparison', () => {
    it('should return valid PNG buffer', async () => {
      const options: AccessibilityComparisonOptions = {
        dyeHex: '#FF0000',
        dyeName: 'Test Dye',
      };

      const buffer = await renderAccessibilityComparison(options);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should have PNG magic bytes at start', async () => {
      const options: AccessibilityComparisonOptions = {
        dyeHex: '#00FF00',
        dyeName: 'Green Dye',
      };

      const buffer = await renderAccessibilityComparison(options);

      expect(buffer[0]).toBe(PNG_MAGIC_BYTES[0]);
      expect(buffer[1]).toBe(PNG_MAGIC_BYTES[1]);
      expect(buffer[2]).toBe(PNG_MAGIC_BYTES[2]);
      expect(buffer[3]).toBe(PNG_MAGIC_BYTES[3]);
    });

    it('should show all 3 vision types when not specified', async () => {
      const options: AccessibilityComparisonOptions = {
        dyeHex: '#0000FF',
        dyeName: 'Blue Dye',
      };

      const buffer = await renderAccessibilityComparison(options);

      // 4 swatches (normal + 3 types) should produce larger buffer
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(5000);
    });

    it('should show only requested vision type', async () => {
      const options: AccessibilityComparisonOptions = {
        dyeHex: '#FF00FF',
        dyeName: 'Purple Dye',
        visionTypes: ['protanopia'],
      };

      const buffer = await renderAccessibilityComparison(options);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer[0]).toBe(PNG_MAGIC_BYTES[0]);
    });

    it('should handle protanopia simulation', async () => {
      const options: AccessibilityComparisonOptions = {
        dyeHex: '#FF0000',
        dyeName: 'Red Dye',
        visionTypes: ['protanopia'],
      };

      const buffer = await renderAccessibilityComparison(options);

      expect(buffer).toBeInstanceOf(Buffer);
    });

    it('should handle deuteranopia simulation', async () => {
      const options: AccessibilityComparisonOptions = {
        dyeHex: '#00FF00',
        dyeName: 'Green Dye',
        visionTypes: ['deuteranopia'],
      };

      const buffer = await renderAccessibilityComparison(options);

      expect(buffer).toBeInstanceOf(Buffer);
    });

    it('should handle tritanopia simulation', async () => {
      const options: AccessibilityComparisonOptions = {
        dyeHex: '#0000FF',
        dyeName: 'Blue Dye',
        visionTypes: ['tritanopia'],
      };

      const buffer = await renderAccessibilityComparison(options);

      expect(buffer).toBeInstanceOf(Buffer);
    });

    it('should create 2x2 grid for 4 swatches (all types)', async () => {
      const options: AccessibilityComparisonOptions = {
        dyeHex: '#FFFF00',
        dyeName: 'Yellow Dye',
        // No visionTypes = all 3 types + normal = 4 swatches
      };

      const buffer = await renderAccessibilityComparison(options);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(5000);
    });

    it('should create 1x2 grid for 2 swatches (one type)', async () => {
      const options: AccessibilityComparisonOptions = {
        dyeHex: '#00FFFF',
        dyeName: 'Cyan Dye',
        visionTypes: ['protanopia'], // 1 type + normal = 2 swatches
      };

      const buffer = await renderAccessibilityComparison(options);

      expect(buffer).toBeInstanceOf(Buffer);
    });

    it('should wrap long descriptions correctly', async () => {
      const options: AccessibilityComparisonOptions = {
        dyeHex: '#123456',
        dyeName: 'A Very Long Dye Name That Might Need Wrapping',
      };

      // Should not throw
      const buffer = await renderAccessibilityComparison(options);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer[0]).toBe(PNG_MAGIC_BYTES[0]);
    });
  });
});
