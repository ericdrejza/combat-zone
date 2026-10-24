import type { CanvasSize } from '@core/layout/polygonCanvasBounds';

export const PLAYER_ASPECT_RATIOS: CanvasSize[] = [
  { width: 16, height: 9 }, { width: 16, height: 10 },
  { width: 4, height: 3 }, { width: 21, height: 9 }
];
export const DEFAULT_PLAYER_ASPECT_RATIO = PLAYER_ASPECT_RATIOS[0];

export function validPlayerAspectRatio(value: unknown): value is CanvasSize {
  if (!value || typeof value !== 'object') return false;
  const ratio = value as CanvasSize;
  return Number.isSafeInteger(ratio.width) && ratio.width > 0 &&
    Number.isSafeInteger(ratio.height) && ratio.height > 0;
}

/** Canonical ratios preserve legacy resolution framing without storing pixel dimensions. */
export function normalizePlayerAspectRatio(ratio: CanvasSize): CanvasSize {
  let a = ratio.width, b = ratio.height;
  while (b) { const remainder = a % b; a = b; b = remainder; }
  return { width: ratio.width / a, height: ratio.height / a };
}

/** A stable logical height keeps navigation independent of display pixel density. */
export function playerProjectionSize(ratio: CanvasSize): CanvasSize {
  return { width: 1080 * ratio.width / ratio.height, height: 1080 };
}
