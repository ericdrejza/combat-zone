import { calibrateGrid, calibrateQuadrants } from '@core/movement/gridCalibration';
import { createDefaultGrid } from '@core/movement/types';
import { gridToWorld, snapToGrid } from '@core/movement/gridGeometry';
import { detectGrid } from '@core/movement/gridDetection';

const grid = { ...createDefaultGrid(), type: 'isometric' as const, origin: { x: 256, y: 96 } };

it.each([0, 31, 90, 135])('calibrates every starting corner and winding at %s°', rotation => {
  const target = { ...grid, rotation };
  const corners = [{ x: 0, y: 0 }, { x: 64, y: 0 }, { x: 64, y: 64 }, { x: 0, y: 64 }].map(p => gridToWorld(target, p));
  for (let start = 0; start < 4; start++) for (const winding of [1, -1]) {
    const points = corners.map((_, i) => corners[(start + winding * i + 8) % 4]);
    const fit = calibrateGrid(grid, points);
    expect(fit).not.toBeNull(); expect(fit!.cellSize).toBeCloseTo(64, 6);
    expect(fit!.rotation).toBeCloseTo(rotation, 6);
    for (const point of points) {
      const vertex = snapToGrid(fit!, point, 'large');
      expect(Math.hypot(vertex.x - point.x, vertex.y - point.y)).toBeLessThan(1e-5);
    }
  }
});

it('fits four warped quadrant samples and reproduces their vertices', () => {
  const warped = { ...grid, warp: { type: 'bilinear' as const,
    x: [0, 1, 0, 0.004] as [number, number, number, number], y: [0, 0, 1, 0.003] as [number, number, number, number] } };
  const points = [[0, 0], [8, 0], [8, 6], [0, 6]].flatMap(([x, y]) =>
    [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]].map(([q, r]) => gridToWorld(warped, { x: q * 64, y: r * 64 })));
  const fit = calibrateQuadrants(grid, points, { width: 960, height: 640 });
  expect(fit?.warped).not.toBeNull();
  for (const point of points) {
    const vertex = snapToGrid(fit!.warped!, point, 'large');
    expect(Math.hypot(vertex.x - point.x, vertex.y - point.y)).toBeLessThan(0.05);
  }
});

function pixelsFor(rotation: number, noise: boolean) {
  const width = 256, height = 256, cell = 48, pixels = new Uint8ClampedArray(width * height * 4);
  const angle = rotation * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const dx = x - 71, dy = y - 83, localX = dx * c + dy * s, localY = -dx * s + dy * c;
    const u = localX + 2 * localY, v = 2 * localY - localX;
    const onLine = (value: number) => Math.abs(value - Math.round(value / cell) * cell) / Math.sqrt(5) < 0.65;
    const value = (onLine(u) || onLine(v) ? 35 : 225) + (noise ? (x * 17 + y * 13) % 15 - 7 : 0);
    pixels.set([value, value, value, 255], (y * width + x) * 4);
  }
  return pixels;
}

it.each([0, 17, 45, 90])('detects isometric spacing, rotation, and phase at %s°', rotation => {
  const fit = detectGrid(pixelsFor(rotation, true), 256, 256, 256, 256, grid);
  expect(fit).not.toBeNull(); expect(fit!.type).toBe('isometric');
  expect(Math.abs(fit!.cellSize - 48)).toBeLessThan(1);
  expect(Math.abs(fit!.rotation - rotation)).toBeLessThan(1);
  const vertex = snapToGrid(fit!, { x: 71, y: 83 }, 'large');
  expect(Math.hypot(vertex.x - 71, vertex.y - 83)).toBeLessThan(3);
});

it('rejects collapsed alignment and does not invent lines in a blank image', () => {
  expect(calibrateGrid(grid, Array(4).fill({ x: 20, y: 20 }))).toBeNull();
  expect(detectGrid(new Uint8ClampedArray(96 * 96 * 4).fill(255), 96, 96, 960, 640, grid)).toBeNull();
});

it.each([15, 30, 45])('calibrates the configured %s° projection from four corners', isometricAngle => {
  const target = { ...grid, isometricAngle, rotation: 17 };
  const points = [{ x: 0, y: 0 }, { x: 64, y: 0 }, { x: 64, y: 64 }, { x: 0, y: 64 }].map(p => gridToWorld(target, p));
  const fit = calibrateGrid({ ...grid, isometricAngle }, points)!;
  expect(fit).not.toBeNull(); expect(fit.isometricAngle).toBe(isometricAngle);
  expect(fit.cellSize).toBeCloseTo(64, 6);
  for (const point of points) expect(Math.hypot(snapToGrid(fit, point, 'large').x - point.x, snapToGrid(fit, point, 'large').y - point.y)).toBeLessThan(1e-5);
});

it.each([15, 30, 45])('automatically estimates the %s° projection with rotated noisy line families', projection => {
  const width = 256, pixels = new Uint8ClampedArray(width * width * 4), cell = 48, rotation = 17 * Math.PI / 180;
  const slope = Math.tan(projection * Math.PI / 180);
  for (let y = 0; y < width; y++) for (let x = 0; x < width; x++) {
    const dx = x - 71, dy = y - 83;
    const u = dx * Math.cos(rotation) + dy * Math.sin(rotation), v = -dx * Math.sin(rotation) + dy * Math.cos(rotation);
    const line = (coordinate: number) => Math.abs(coordinate - Math.round(coordinate / cell) * cell) * Math.sin(projection * Math.PI / 180) < 0.65;
    const value = (line(u + v / slope) || line(v / slope - u) ? 35 : 225) + (x * 17 + y * 13) % 15 - 7;
    pixels.set([value, value, value, 255], (y * width + x) * 4);
  }
  const fit = detectGrid(pixels, width, width, width, width, grid)!;
  expect(fit).not.toBeNull(); expect(fit.isometricAngle).toBeCloseTo(projection, 0);
  expect(Math.abs(fit.cellSize - cell)).toBeLessThan(1.5);
  expect(Math.abs(fit.rotation - 17)).toBeLessThan(1);
});
