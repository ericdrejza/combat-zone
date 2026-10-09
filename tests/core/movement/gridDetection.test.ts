import { detectGrid, detectSquareGrid } from '@core/movement/gridDetection';
import { createDefaultGrid } from '@core/movement/types';
import { snapToGrid } from '@core/movement/gridGeometry';

function hexPixels(width: number, height: number, cell: number, angle: number, origin: { x: number; y: number }, samples = 1) {
  const pixels = new Uint8ClampedArray(width * height * 4), radius = cell / Math.sqrt(3);
  const c = Math.cos(angle), s = Math.sin(angle);
  const normals = [Math.PI / 6, Math.PI / 2, 5 * Math.PI / 6].map(a => ({ x: Math.cos(a), y: Math.sin(a) }));
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let coverage = 0;
    for (let sy = 0; sy < samples; sy++) for (let sx = 0; sx < samples; sx++) {
      const dx = x + (samples > 1 ? (sx + 0.5) / samples : 0) - origin.x;
      const dy = y + (samples > 1 ? (sy + 0.5) / samples : 0) - origin.y;
      const u = dx * c + dy * s, v = -dx * s + dy * c, q = Math.round(u / (1.5 * radius));
      let distance = Infinity, nearX = 0, nearY = 0;
      for (let a = q - 1; a <= q + 1; a++) {
        const r = Math.round(v / cell - a / 2);
        for (let b = r - 1; b <= r + 1; b++) {
          const nx = u - a * 1.5 * radius, ny = v - (b + a / 2) * cell;
          if (nx * nx + ny * ny < distance) { distance = nx * nx + ny * ny; nearX = nx; nearY = ny; }
        }
      }
      const extent = Math.max(...normals.map(n => Math.abs(nearX * n.x + nearY * n.y)));
      if (Math.abs(cell / 2 - extent) < (samples > 1 ? 0.4 : 0.7)) coverage++;
    }
    const value = 220 - coverage / (samples * samples) * 180;
    pixels.set([value, value, value, 255], (y * width + x) * 4);
  }
  return pixels;
}

describe('background grid detection', () => {
  it.each(['hex-flat', 'hex-pointy'] as const)('detects %s spacing and cell-center phase', type => {
    const size = 256, cell = 48;
    const pixels = hexPixels(size, size, cell, type === 'hex-pointy' ? Math.PI / 6 : 0, { x: 11, y: 17 });
    const result = detectGrid(pixels, size, size, size, size, { ...createDefaultGrid(), type });
    expect(result).not.toBeNull(); expect(result!.type).toBe(type); expect(result!.cellSize).toBeCloseTo(cell, 0); expect(result!.rotation).toBe(0);
    const center = snapToGrid(result!, { x: 11, y: 17 }, 'medium');
    expect(Math.hypot(center.x - 11, center.y - 17)).toBeLessThan(3);
  });
  it.each(['hex-flat', 'hex-pointy'] as const)('keeps true %s cells after image resampling rather than the larger repeating lattice', type => {
    const pixels = hexPixels(384, 256, 25.6, type === 'hex-pointy' ? Math.PI / 6 : 0, { x: 40, y: 40 }, 2);
    const result = detectGrid(pixels, 384, 256, 960, 640, { ...createDefaultGrid(), type });
    expect(result).not.toBeNull(); expect(result!.cellSize).toBeGreaterThan(62); expect(result!.cellSize).toBeLessThan(66); expect(result!.rotation).toBe(0);
  });
  it.each([0, 45])('detects repeated grid lines at %s degrees without clicks', rotation => {
    const size = 192, cell = 24, pixels = new Uint8ClampedArray(size * size * 4);
    const c = Math.cos(rotation * Math.PI / 180), s = Math.sin(rotation * Math.PI / 180);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = (x - 7) * c + (y - 11) * s, v = -(x - 7) * s + (y - 11) * c;
      const nearLine = (value: number) => Math.abs(value - Math.round(value / cell) * cell) < 0.65;
      const value = nearLine(u) || nearLine(v) ? 40 : 220;
      pixels.set([value, value, value, 255], (y * size + x) * 4);
    }
    const result = detectSquareGrid(pixels, size, size, size, size, createDefaultGrid());
    expect(result).not.toBeNull(); expect(result!.cellSize).toBeCloseTo(cell, 0); expect(result!.rotation).toBe(rotation);
    const anchor = snapToGrid(result!, { x: 7, y: 11 }, 'large');
    expect(Math.hypot(anchor.x - 7, anchor.y - 11)).toBeLessThan(3);
  });
  it('does not invent a grid in a featureless background', () => {
    expect(detectSquareGrid(new Uint8ClampedArray(96 * 96 * 4).fill(255), 96, 96, 960, 960, createDefaultGrid())).toBeNull();
  });
  it('finds the fundamental cell spacing after fractional image resampling', () => {
    const width = 384, height = 256, pixels = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      let coverage = 0;
      for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) {
        const near = (v: number) => Math.abs(v - 16 - Math.round((v - 16) / 25.6) * 25.6) <= 0.4;
        if (near(x + (sx + 0.5) / 4) || near(y + (sy + 0.5) / 4)) coverage++;
      }
      const value = 230 - coverage / 16 * 160;
      pixels.set([value, value, value, 255], (y * width + x) * 4);
    }
    const result = detectSquareGrid(pixels, width, height, 960, 640, createDefaultGrid());
    expect(result).not.toBeNull(); expect(result!.cellSize).toBeGreaterThan(62); expect(result!.cellSize).toBeLessThan(66);
    expect(result!.rotation).toBe(0);
    const anchor = snapToGrid(result!, { x: 40, y: 40 }, 'large');
    expect(Math.hypot(anchor.x - 40, anchor.y - 40)).toBeLessThan(5);
  });
});
