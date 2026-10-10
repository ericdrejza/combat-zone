import type { GridConfiguration } from './types';
import type { GridDetectionInput } from './gridDetectionRuntime';

/** Prefer higher-resolution evidence: thumbnails can hide small cells or invent a larger repeating pattern. */
export async function detectGridAtResolutions({ imageWidth, imageHeight, canvasWidth, canvasHeight, grid, readPixels, analyze, signal }: {
  imageWidth: number; imageHeight: number; canvasWidth: number; canvasHeight: number; grid: GridConfiguration;
  readPixels: (width: number, height: number) => Uint8ClampedArray;
  analyze: (input: GridDetectionInput, signal: AbortSignal) => Promise<GridConfiguration | null>;
  signal: AbortSignal;
}): Promise<GridConfiguration | null> {
  let previous = '';
  let best: GridConfiguration | null = null;
  for (const resolution of [384, 1152]) {
    if (signal.aborted) return null;
    const scale = Math.min(1, resolution / Math.max(imageWidth, imageHeight));
    const width = Math.max(1, Math.round(imageWidth * scale)), height = Math.max(1, Math.round(imageHeight * scale));
    const key = `${width}x${height}`;
    if (key === previous) continue;
    previous = key;
    const result = await analyze({ pixels: readPixels(width, height), width, height, canvasWidth, canvasHeight, grid }, signal);
    if (signal.aborted) return null;
    if (result) best = result;
  }
  return best;
}
