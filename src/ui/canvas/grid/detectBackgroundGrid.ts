import type { EncounterState } from '@core/encounter/types';
import { analyzeGridImage } from '@core/movement/gridDetectionRuntime';
import { detectGridAtResolutions } from '@core/movement/gridDetectionPasses';

/** Pixel analysis is local; the canvas here reads image data and never renders the encounter. */
export async function detectBackgroundGrid(url: string, encounter: EncounterState, signal: AbortSignal) {
  if (signal.aborted) return null;
  const image = new Image(); image.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    const abort = () => { image.src = ''; reject(new DOMException('Cancelled', 'AbortError')); };
    signal.addEventListener('abort', abort, { once: true });
    image.onload = () => { signal.removeEventListener('abort', abort); resolve(); };
    image.onerror = () => { signal.removeEventListener('abort', abort); reject(new Error('The background could not be read. Use vertex alignment instead.')); };
    image.src = url;
  });
  if (signal.aborted) return null;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Image analysis is unavailable. Use vertex alignment instead.');
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  if (signal.aborted) return null;
  return detectGridAtResolutions({ imageWidth: image.width, imageHeight: image.height,
    canvasWidth: encounter.canvasSize.width, canvasHeight: encounter.canvasSize.height, grid: encounter.grid, signal, analyze: analyzeGridImage,
    readPixels: (width, height) => {
      canvas.width = width; canvas.height = height;
      context.drawImage(image, 0, 0, width, height);
      try { return context.getImageData(0, 0, width, height).data; }
      catch { throw new Error('The background does not allow pixel analysis. Use vertex alignment instead.'); }
    }
  });
}
