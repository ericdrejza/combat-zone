import { detectGrid } from './gridDetection';
import type { GridConfiguration } from './types';

export type GridDetectionInput = {
  pixels: Uint8ClampedArray; width: number; height: number;
  canvasWidth: number; canvasHeight: number; grid: GridConfiguration;
};
export type GridDetectionResponse = { grid: GridConfiguration | null; error?: string };

/** Larger detection passes run off the UI thread and can be cancelled immediately. */
export function analyzeGridImage(input: GridDetectionInput, signal: AbortSignal): Promise<GridConfiguration | null> {
  if (signal.aborted) return Promise.resolve(null);
  if (typeof Worker === 'undefined') return Promise.resolve(detectGrid(input.pixels, input.width, input.height, input.canvasWidth, input.canvasHeight, input.grid));
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try { worker = new Worker(new URL('./gridDetection.worker.ts', import.meta.url), { type: 'module' }); }
    catch { resolve(detectGrid(input.pixels, input.width, input.height, input.canvasWidth, input.canvasHeight, input.grid)); return; }
    const cleanup = () => { signal.removeEventListener('abort', abort); worker.terminate(); };
    const abort = () => { cleanup(); resolve(null); };
    signal.addEventListener('abort', abort, { once: true });
    worker.onmessage = (event: MessageEvent<GridDetectionResponse>) => {
      cleanup();
      if (event.data.error) reject(new Error(event.data.error)); else resolve(event.data.grid);
    };
    worker.onerror = event => { event.preventDefault(); cleanup(); reject(new Error('Grid analysis failed. Try vertex alignment.')); };
    try { worker.postMessage(input, [input.pixels.buffer as ArrayBuffer]); }
    catch { cleanup(); reject(new Error('Grid analysis could not start. Try vertex alignment.')); }
  });
}
