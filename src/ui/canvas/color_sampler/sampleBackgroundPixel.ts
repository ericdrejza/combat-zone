import type { LayoutPoint } from '@core/layout/types';
import { getBackgroundFrame } from '@core/encounter/backgroundFrame';
import type { EncounterState } from '@core/encounter/types';

/** Read one source pixel, composited over the actual themed background fill. */
export async function sampleBackgroundPixel(svg: SVGSVGElement, encounter: EncounterState, point: LayoutPoint): Promise<string> {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Pixel sampling unavailable');
  const fill = svg.querySelector('[data-layer="background"] rect');
  context.fillStyle = fill ? getComputedStyle(fill).fill : '#ffffff';
  context.fillRect(0, 0, 1, 1);
  const frame = getBackgroundFrame(encounter.backgroundImage, encounter.canvasSize);
  if (encounter.backgroundImage && point.x >= frame.x && point.y >= frame.y && point.x < frame.x + frame.width && point.y < frame.y + frame.height) {
    const video = svg.querySelector<HTMLVideoElement>('[data-layer="background"] video');
    let source: HTMLImageElement | HTMLVideoElement;
    if (video && video.readyState >= 2) source = video;
    else {
      const href = svg.querySelector('image[aria-label="Canvas background image"]')?.getAttribute('href');
      if (!href) throw new Error('Background not loaded');
      const image = new Image(); image.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = reject; image.src = href; });
      source = image;
    }
    const width = source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth;
    const height = source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight;
    context.drawImage(source, Math.min(width - 1, Math.floor((point.x - frame.x) / frame.width * width)),
      Math.min(height - 1, Math.floor((point.y - frame.y) / frame.height * height)), 1, 1, 0, 0, 1, 1);
  }
  return '#' + [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).map(value => value.toString(16).padStart(2, '0')).join('');
}
