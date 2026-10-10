import type { CanvasSize } from '@core/layout/polygonCanvasBounds';
import type { EncounterBackgroundImage } from './types';

/** Intrinsic asset dimensions remain separate from its optional canvas placement. */
export type BackgroundFrame = CanvasSize & { x: number; y: number };
export function getBackgroundFrame(background: EncounterBackgroundImage | null, canvas: CanvasSize): BackgroundFrame {
  return background?.frame ?? { ...canvas, x: 0, y: 0 };
}
export function validBackgroundFrame(value: unknown, canvas: CanvasSize): value is BackgroundFrame {
  if (!value || typeof value !== 'object') return false;
  const frame = value as BackgroundFrame;
  return [frame.x, frame.y, frame.width, frame.height].every(Number.isFinite) &&
    frame.x >= 0 && frame.y >= 0 && frame.width > 0 && frame.height > 0 &&
    frame.x + frame.width <= canvas.width + 1e-7 && frame.y + frame.height <= canvas.height + 1e-7;
}
