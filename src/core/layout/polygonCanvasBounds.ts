import type { LayoutPoint } from './types';

export const CANVAS_WIDTH = 960;
export const CANVAS_HEIGHT = 640;
export type CanvasSize = {
  height: number;
  width: number;
};
export const DEFAULT_CANVAS_SIZE: CanvasSize = {
  height: CANVAS_HEIGHT,
  width: CANVAS_WIDTH
};

export function isPointWithinCanvas(
  point: LayoutPoint,
  canvasSize: CanvasSize = DEFAULT_CANVAS_SIZE
): boolean {
  return (
    point.x >= 0 &&
    point.x <= canvasSize.width &&
    point.y >= 0 &&
    point.y <= canvasSize.height
  );
}

/** Returns whether every polygon vertex remains inside the drawable canvas. */
export function isPolygonWithinCanvas(
  polygon: LayoutPoint[],
  canvasSize: CanvasSize = DEFAULT_CANVAS_SIZE
): boolean {
  return polygon.every((point) => isPointWithinCanvas(point, canvasSize));
}
