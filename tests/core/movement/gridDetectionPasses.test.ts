import { detectGridAtResolutions } from '@core/movement/gridDetectionPasses';
import { analyzeGridImage } from '@core/movement/gridDetectionRuntime';
import { detectGrid } from '@core/movement/gridDetection';
import { createDefaultGrid } from '@core/movement/types';

/** Area-sampled faint one-pixel lines from a large map, rather than an ideal thumbnail-sized grid. */
function faintMapPixels(width: number, height: number) {
  const scale = width / 4000, cell = 60 * scale, line = scale, origin = 20 * scale;
  const coverage = (coordinate: number) => {
    const nearest = Math.round((coordinate - origin) / cell);
    let sum = 0;
    for (let i = nearest - 1; i <= nearest + 1; i++) {
      const center = origin + i * cell;
      sum += Math.max(0, Math.min(coordinate + 0.5, center + line / 2) - Math.max(coordinate - 0.5, center - line / 2));
    }
    return Math.min(1, sum);
  };
  const xs = Array.from({ length: width }, (_, x) => coverage(x + 0.5)), ys = Array.from({ length: height }, (_, y) => coverage(y + 0.5));
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const value = 220 - 55 * (xs[x] + ys[y] - xs[x] * ys[y]);
    pixels.set([value, value, value, 255], (y * width + x) * 4);
  }
  return pixels;
}
const input = () => ({ imageWidth: 4000, imageHeight: 2800, canvasWidth: 4000, canvasHeight: 2800,
  grid: createDefaultGrid(), signal: new AbortController().signal });
describe('adaptive grid detection resolution', () => {
  it('reproduces thumbnail failure and detects faint small cells at a higher resolution', async () => {
    vi.stubGlobal('Worker', undefined);
    try {
      const thumbnail = detectGrid(faintMapPixels(384, 269), 384, 269, 4000, 2800, createDefaultGrid());
      expect(thumbnail === null || Math.abs(thumbnail.cellSize - 60) > 2).toBe(true);
      const readPixels = vi.fn(faintMapPixels);
      const result = await detectGridAtResolutions({ ...input(), readPixels, analyze: analyzeGridImage });
      expect(readPixels.mock.calls.length).toBeGreaterThan(1);
      expect(result).not.toBeNull(); expect(result!.cellSize).toBeGreaterThan(58); expect(result!.cellSize).toBeLessThan(62);
      expect(result!.rotation).toBe(0);
    } finally { vi.unstubAllGlobals(); }
  });
  it('checks the larger pass even after a thumbnail match and never enlarges a smaller original', async () => {
    const corrected = { ...createDefaultGrid(), cellSize: 48 };
    const analyze = vi.fn().mockResolvedValueOnce(createDefaultGrid()).mockResolvedValueOnce(corrected);
    const readPixels = vi.fn((width: number, height: number) => new Uint8ClampedArray(width * height * 4));
    expect(await detectGridAtResolutions({ ...input(), imageWidth: 500, imageHeight: 250, readPixels, analyze })).toEqual(corrected);
    expect(readPixels.mock.calls).toEqual([[384, 192], [500, 250]]);
    expect(analyze).toHaveBeenCalledTimes(2);
  });
  it('does not retry or return stale results after cancellation', async () => {
    const controller = new AbortController(), readPixels = vi.fn(() => new Uint8ClampedArray(4));
    const analyze = vi.fn(async () => { controller.abort(); return createDefaultGrid(); });
    expect(await detectGridAtResolutions({ ...input(), signal: controller.signal, readPixels, analyze })).toBeNull();
    expect(analyze).toHaveBeenCalledTimes(1);
    expect(await detectGridAtResolutions({ ...input(), signal: controller.signal, readPixels, analyze })).toBeNull();
    expect(analyze).toHaveBeenCalledTimes(1);
  });
});
