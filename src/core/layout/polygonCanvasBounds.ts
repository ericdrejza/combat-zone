import type { LayoutPoint } from './types';

export const CANVAS_WIDTH = 960;
export const CANVAS_HEIGHT = 640;

export function isPointWithinCanvas(point: LayoutPoint): boolean {
  return (
    point.x >= 0 &&
    point.x <= CANVAS_WIDTH &&
    point.y >= 0 &&
    point.y <= CANVAS_HEIGHT
  );
}

/** Returns whether every polygon vertex remains inside the drawable canvas. */
export function isPolygonWithinCanvas(polygon: LayoutPoint[]): boolean {
  return polygon.every(isPointWithinCanvas);
}
