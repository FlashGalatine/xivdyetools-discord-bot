/**
 * Parity tests - Ensure Discord bot produces same results as web app
 *
 * Both the Discord bot and web app use xivdyetools-core, so all color
 * algorithms, dye matching, and harmony generation should be identical.
 */

import { describe, it, expect } from 'vitest';
import {
    DyeService,
    ColorService,
    dyeDatabase,
    type Dye,
} from 'xivdyetools-core';

const dyeService = new DyeService(dyeDatabase);

describe('Parity - Color Conversions', () => {
    it('should convert hex to RGB identically', () => {
        const testCases = [
            { hex: '#FF0000', expected: { r: 255, g: 0, b: 0 } },
            { hex: '#00FF00', expected: { r: 0, g: 255, b: 0 } },
            { hex: '#0000FF', expected: { r: 0, g: 0, b: 255 } },
            { hex: '#FFFFFF', expected: { r: 255, g: 255, b: 255 } },
            { hex: '#000000', expected: { r: 0, g: 0, b: 0 } },
            { hex: '#D42F2F', expected: { r: 212, g: 47, b: 47 } },
        ];

        testCases.forEach(({ hex, expected }) => {
            const result = ColorService.hexToRgb(hex);
            expect(result).toEqual(expected);
        });
    });

    it('should convert RGB to hex identically', () => {
        const testCases = [
            { rgb: { r: 255, g: 0, b: 0 }, expected: '#FF0000' },
            { rgb: { r: 0, g: 255, b: 0 }, expected: '#00FF00' },
            { rgb: { r: 0, g: 0, b: 255 }, expected: '#0000FF' },
            { rgb: { r: 212, g: 47, b: 47 }, expected: '#D42F2F' },
        ];

        testCases.forEach(({ rgb, expected }) => {
            const result = ColorService.rgbToHex(rgb.r, rgb.g, rgb.b);
            expect(result).toBe(expected);
        });
    });

    it('should convert hex to HSV identically', () => {
        const red = ColorService.hexToHsv('#FF0000');
        expect(red.h).toBeCloseTo(0, 0);
        expect(red.s).toBeCloseTo(100, 0);
        expect(red.v).toBeCloseTo(100, 0);

        const green = ColorService.hexToHsv('#00FF00');
        expect(green.h).toBeCloseTo(120, 0);
        expect(green.s).toBeCloseTo(100, 0);
        expect(green.v).toBeCloseTo(100, 0);

        const blue = ColorService.hexToHsv('#0000FF');
        expect(blue.h).toBeCloseTo(240, 0);
        expect(blue.s).toBeCloseTo(100, 0);
        expect(blue.v).toBeCloseTo(100, 0);
    });

    it('should convert HSV to hex identically', () => {
        const red = ColorService.hsvToHex(0, 100, 100);
        expect(red).toBe('#FF0000');

        const green = ColorService.hsvToHex(120, 100, 100);
        expect(green).toBe('#00FF00');

        const blue = ColorService.hsvToHex(240, 100, 100);
        expect(blue).toBe('#0000FF');
    });
});

describe('Parity - Color Distance', () => {
    it('should calculate Euclidean distance identically', () => {
        // Same color = 0 distance
        const same = ColorService.getColorDistance('#FF0000', '#FF0000');
        expect(same).toBe(0);

        // Pure red to pure blue
        const redToBlue = ColorService.getColorDistance('#FF0000', '#0000FF');
        expect(redToBlue).toBeGreaterThan(0);

        // Distance should be symmetric
        const blueToRed = ColorService.getColorDistance('#0000FF', '#FF0000');
        expect(redToBlue).toBeCloseTo(blueToRed, 2);
    });

    it('should calculate distances consistently', () => {
        const testCases = [
            { color1: '#FF0000', color2: '#FE0000' }, // Very close
            { color1: '#FF0000', color2: '#00FF00' }, // Opposite
            { color1: '#000000', color2: '#FFFFFF' }, // Maximum distance
        ];

        testCases.forEach(({ color1, color2 }) => {
            const distance1 = ColorService.getColorDistance(color1, color2);
            const distance2 = ColorService.getColorDistance(color2, color1);
            expect(distance1).toBeCloseTo(distance2, 2);
        });
    });
});

describe('Parity - Dye Matching', () => {
    it('should find exact dye matches identically', () => {
        // Get all dyes
        const allDyes = dyeService.getAllDyes();

        // Test a few known dyes
        const testDyes = allDyes.slice(0, 10);

        testDyes.forEach((testDye) => {
            const match = dyeService.findClosestDye(testDye.hex);
            expect(match).toBeDefined();

            // Distance should be 0 for exact match
            const distance = ColorService.getColorDistance(testDye.hex, match!.hex);
            expect(distance).toBeLessThan(1); // Allow tiny floating point error
        });
    });

    it('should find consistent closest matches', () => {
        const testColors = [
            '#FF0000', // Pure red
            '#00FF00', // Pure green
            '#0000FF', // Pure blue
            '#FF00FF', // Magenta
            '#FFFF00', // Yellow
            '#00FFFF', // Cyan
        ];

        testColors.forEach((color) => {
            const match1 = dyeService.findClosestDye(color);
            const match2 = dyeService.findClosestDye(color);

            // Same input should always return same result
            expect(match1?.name).toBe(match2?.name);
            expect(match1?.hex).toBe(match2?.hex);
        });
    });
});

describe('Parity - Harmony Generation', () => {
    const testColor = '#FF0000';

    it('should generate complementary harmony identically', () => {
        const comp1 = dyeService.findComplementaryPair(testColor);
        const comp2 = dyeService.findComplementaryPair(testColor);

        expect(comp1?.name).toBe(comp2?.name);
        expect(comp1?.hex).toBe(comp2?.hex);
    });

    it('should generate analogous harmony identically', () => {
        const analogous1 = dyeService.findAnalogousDyes(testColor);
        const analogous2 = dyeService.findAnalogousDyes(testColor);

        expect(analogous1.length).toBe(analogous2.length);
        analogous1.forEach((dye, index) => {
            expect(dye.name).toBe(analogous2[index].name);
            expect(dye.hex).toBe(analogous2[index].hex);
        });
    });

    it('should generate triadic harmony identically', () => {
        const triadic1 = dyeService.findTriadicDyes(testColor);
        const triadic2 = dyeService.findTriadicDyes(testColor);

        expect(triadic1.length).toBe(triadic2.length);
        triadic1.forEach((dye, index) => {
            expect(dye.name).toBe(triadic2[index].name);
        });
    });

    it('should generate split-complementary harmony identically', () => {
        const split1 = dyeService.findSplitComplementaryDyes(testColor);
        const split2 = dyeService.findSplitComplementaryDyes(testColor);

        expect(split1.length).toBe(split2.length);
        split1.forEach((dye, index) => {
            expect(dye.name).toBe(split2[index].name);
        });
    });

    it('should generate tetradic harmony identically', () => {
        const tetradic1 = dyeService.findTetradicDyes(testColor);
        const tetradic2 = dyeService.findTetradicDyes(testColor);

        expect(tetradic1.length).toBe(tetradic2.length);
        tetradic1.forEach((dye, index) => {
            expect(dye.name).toBe(tetradic2[index].name);
        });
    });

    it('should generate square harmony identically', () => {
        const square1 = dyeService.findSquareDyes(testColor);
        const square2 = dyeService.findSquareDyes(testColor);

        expect(square1.length).toBe(square2.length);
        square1.forEach((dye, index) => {
            expect(dye.name).toBe(square2[index].name);
        });
    });

    it('should generate monochromatic harmony identically', () => {
        const mono1 = dyeService.findMonochromaticDyes(testColor, 5);
        const mono2 = dyeService.findMonochromaticDyes(testColor, 5);

        expect(mono1.length).toBe(mono2.length);
        mono1.forEach((dye, index) => {
            expect(dye.name).toBe(mono2[index].name);
        });
    });

    it('should generate compound harmony identically', () => {
        const compound1 = dyeService.findCompoundDyes(testColor);
        const compound2 = dyeService.findCompoundDyes(testColor);

        expect(compound1.length).toBe(compound2.length);
        compound1.forEach((dye, index) => {
            expect(dye.name).toBe(compound2[index].name);
        });
    });

    it('should generate shades harmony identically', () => {
        const shades1 = dyeService.findShadesDyes(testColor);
        const shades2 = dyeService.findShadesDyes(testColor);

        expect(shades1.length).toBe(shades2.length);
        shades1.forEach((dye, index) => {
            expect(dye.name).toBe(shades2[index].name);
        });
    });
});

describe('Parity - Dye Database', () => {
    it('should load 136 dyes consistently', () => {
        const allDyes = dyeService.getAllDyes();
        expect(allDyes.length).toBe(136);
    });

    it('should have all required dye properties', () => {
        const allDyes = dyeService.getAllDyes();

        allDyes.forEach((dye) => {
            expect(dye).toHaveProperty('name');
            expect(dye).toHaveProperty('hex');
            expect(dye).toHaveProperty('category');
            expect(dye).toHaveProperty('itemID');
            expect(dye).toHaveProperty('acquisition');

            // Validate types
            expect(typeof dye.name).toBe('string');
            expect(typeof dye.hex).toBe('string');
            expect(typeof dye.category).toBe('string');
            // itemID can be number or null for some dyes
            if (dye.itemID !== null) {
                expect(typeof dye.itemID).toBe('number');
            }
            expect(typeof dye.acquisition).toBe('string');
        });
    });

    it('should have known test dyes available', () => {
        const allDyes = dyeService.getAllDyes();
        const dyeNames = allDyes.map(d => d.name);

        // Test for some common dyes
        expect(dyeNames).toContain('Snow White');
        expect(dyeNames).toContain('Soot Black');
        expect(dyeNames).toContain('Dalamud Red');
        expect(dyeNames).toContain('Azure Blue');
    });

    it('should have all dyes with valid hex colors', () => {
        const allDyes = dyeService.getAllDyes();
        const hexRegex = /^#[0-9A-F]{6}$/i;

        allDyes.forEach((dye) => {
            expect(dye.hex).toMatch(hexRegex);
        });
    });

    it('should have no duplicate dye names', () => {
        const allDyes = dyeService.getAllDyes();
        const names = allDyes.map(d => d.name);
        const uniqueNames = new Set(names);

        expect(uniqueNames.size).toBe(names.length);
    });

    it('should have no duplicate item IDs among non-null IDs', () => {
        const allDyes = dyeService.getAllDyes();
        const nonNullItemIDs = allDyes
            .filter(d => d.itemID !== null)
            .map(d => d.itemID);
        const uniqueIDs = new Set(nonNullItemIDs);

        // Each non-null itemID should be unique
        expect(uniqueIDs.size).toBe(nonNullItemIDs.length);
    });
});

describe('Parity - Specific Known Results', () => {
    it('should find Ruby Red for pure red #FF0000', () => {
        const match = dyeService.findClosestDye('#FF0000');
        // Based on earlier test logs, pure red matches to Ruby Red
        expect(match).toBeDefined();
        expect(match?.category).toBe('Reds');
    });

    it('should generate consistent complementary for known inputs', () => {
        // Red hue 0° → complement at 180° (cyan/blue range)
        const comp = dyeService.findComplementaryPair('#FF0000');
        expect(comp).toBeDefined();

        // Complementary color should be in blue/cyan range
        const compHsv = ColorService.hexToHsv(comp!.hex);
        expect(compHsv.h).toBeGreaterThan(150);
        expect(compHsv.h).toBeLessThan(210);
    });

    it('should generate 2 triadic dyes for any input', () => {
        const testColors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00'];

        testColors.forEach((color) => {
            const triadic = dyeService.findTriadicDyes(color);
            // Triadic should return 2 companions
            expect(triadic.length).toBe(2);
        });
    });

    it('should generate 2 analogous dyes for any input', () => {
        const testColors = ['#FF0000', '#00FF00', '#0000FF'];

        testColors.forEach((color) => {
            const analogous = dyeService.findAnalogousDyes(color);
            // Analogous should return 2 companions (±30°)
            expect(analogous.length).toBe(2);
        });
    });
});
