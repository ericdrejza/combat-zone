import type { EncounterState } from '@core/encounter/types';
import { detectGrid } from '@core/movement/gridDetection';

/** Pixel analysis is local; the canvas here reads image data and never renders the encounter. */
export async function detectBackgroundGrid(url: string, encounter: EncounterState, signal: AbortSignal) {
  const image = new Image(); image.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    const abort = () => { image.src = ''; reject(new DOMException('Cancelled', 'AbortError')); };
    signal.addEventListener('abort', abort, { once: true });
    image.onload = () => { signal.removeEventListener('abort', abort); resolve(); };
    image.onerror = () => { signal.removeEventListener('abort', abort); reject(new Error('The background could not be read. Use vertex alignment instead.')); };
    image.src = url;
  });
  if (signal.aborted) return null;
  const scale = Math.min(1, 384 / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas'); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Image analysis is unavailable. Use vertex alignment instead.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  if (signal.aborted) return null;
  try {
    return detectGrid(context.getImageData(0, 0, canvas.width, canvas.height).data,
      canvas.width, canvas.height, encounter.canvasSize.width, encounter.canvasSize.height, encounter.grid);
  } catch { throw new Error('The background does not allow pixel analysis. Use vertex alignment instead.'); }
}
