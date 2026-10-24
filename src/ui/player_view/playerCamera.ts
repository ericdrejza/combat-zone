import type { CanvasSize } from '@core/layout/polygonCanvasBounds';
import type { LayoutPoint } from '@core/layout/types';

export type PlayerRegion = CanvasSize & LayoutPoint;

/** Includes the centered blank space when a canvas does not overflow an axis. */
export function visibleCanvasRegion(canvas: CanvasSize, size: CanvasSize, zoom: number, left: number, top: number): PlayerRegion {
  return {
    x: (left - Math.max(0, (size.width - canvas.width * zoom) / 2)) / zoom,
    y: (top - Math.max(0, (size.height - canvas.height * zoom) / 2)) / zoom,
    width: size.width / zoom, height: size.height / zoom
  };
}

export function clampPlayerRegion(region: PlayerRegion, canvas: CanvasSize): PlayerRegion {
  const clamp = (start: number, length: number, total: number) => length >= total
    ? (total - length) / 2 : Math.max(0, Math.min(total - length, start));
  return { ...region, x: clamp(region.x, region.width, canvas.width), y: clamp(region.y, region.height, canvas.height) };
}

/** Fit the region into any display without changing the region or its aspect ratio. */
export function playerFrame(region: PlayerRegion, size: CanvasSize) {
  const scale = Math.min(size.width / region.width, size.height / region.height);
  return { scale, x: (size.width - region.width * scale) / 2, y: (size.height - region.height * scale) / 2 };
}
