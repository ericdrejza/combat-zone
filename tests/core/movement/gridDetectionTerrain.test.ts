import { detectSquareGrid } from '@core/movement/gridDetection';
import { createDefaultGrid } from '@core/movement/types';

describe('faint grids over illustrated terrain', () => {
  it('recovers thin grid lines over stronger synthetic texture without an image fixture', () => {
    const width = 256, height = 256, pixels = new Uint8ClampedArray(width * height * 4);
    let seed = 872341;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const line = (x - 10) % 32 === 0 || (y - 14) % 32 === 0;
      const value = 130 + 40 * Math.sin(x / 38) + 30 * Math.cos(y / 51) + ((seed >>> 16) % 30) - (line ? 18 : 0);
      pixels.set([value, value, value, 255], (y * width + x) * 4);
    }
    const result = detectSquareGrid(pixels, width, height, width, height, createDefaultGrid());
    expect(result).not.toBeNull(); expect(result!.rotation).toBe(0);
    expect(result!.cellSize).toBeCloseTo(32, 0);
  });
  it('rejects textured artwork without a repeating line lattice', () => {
    const width = 192, height = 192, pixels = new Uint8ClampedArray(width * height * 4);
    let seed = 123456;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const value = 100 + 40 * Math.sin(x / 38) + 30 * Math.cos(y / 51) + ((seed >>> 16) % 60);
      pixels.set([value, value, value, 255], (y * width + x) * 4);
    }
    expect(detectSquareGrid(pixels, width, height, width, height, createDefaultGrid())).toBeNull();
  });
});
