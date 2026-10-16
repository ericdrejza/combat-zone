import type { LayoutPoint } from "@core/layout/types";
import type { ZoneShape } from "./types";

export const CIRCLE_SEGMENTS = 60;
export const HEXAGON_SEGMENTS = 6;

export type Bounds = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export function createRectanglePolygon(
  start: LayoutPoint,
  current: LayoutPoint
): LayoutPoint[] {
  return [
    start,
    { x: current.x, y: start.y },
    current,
    { x: start.x, y: current.y }
  ];
}

export function createSegmentedEllipsePolygon(
  start: LayoutPoint,
  current: LayoutPoint,
  segments: number
): LayoutPoint[] {
  const center = {
    x: (start.x + current.x) / 2,
    y: (start.y + current.y) / 2
  };
  const radiusX = Math.abs(current.x - start.x) / 2;
  const radiusY = Math.abs(current.y - start.y) / 2;
  const angles = Array.from(
    { length: segments },
    (_, index) => (index / segments) * Math.PI * 2
  );
  const maxCos = Math.max(...angles.map((angle) => Math.abs(Math.cos(angle))));
  const maxSin = Math.max(...angles.map((angle) => Math.abs(Math.sin(angle))));

  return angles.map((angle) => ({
    x: center.x + Math.cos(angle) * (radiusX / maxCos),
    y: center.y + Math.sin(angle) * (radiusY / maxSin)
  }));
}

export function createCirclePolygon(
  start: LayoutPoint,
  current: LayoutPoint
): LayoutPoint[] {
  return createSegmentedEllipsePolygon(start, current, CIRCLE_SEGMENTS);
}

export function createHexagonPolygon(
  start: LayoutPoint,
  current: LayoutPoint
): LayoutPoint[] {
  return createSegmentedEllipsePolygon(start, current, HEXAGON_SEGMENTS);
}

export function createShapePolygon(
  shape: Extract<ZoneShape, 'rectangle' | 'circle' | 'hexagon'>,
  start: LayoutPoint,
  current: LayoutPoint
): LayoutPoint[] {
  if (shape === 'rectangle') {
    return createRectanglePolygon(start, current);
  }

  return shape === 'circle'
    ? createCirclePolygon(start, current)
    : createHexagonPolygon(start, current);
}

export function createCirclePolygonFromBounds(bounds: Bounds): LayoutPoint[] {
  return createCirclePolygon(
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height }
  );
}

export function createHexagonPolygonFromBounds(bounds: Bounds): LayoutPoint[] {
  return createHexagonPolygon(
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height }
  );
}

export function getPolygonBounds(polygon: LayoutPoint[]): Bounds {
  const xValues = polygon.map((point) => point.x);
  const yValues = polygon.map((point) => point.y);
  const x = Math.min(...xValues);
  const y = Math.min(...yValues);
  const maxX = Math.max(...xValues);
  const maxY = Math.max(...yValues);

  return {
    height: Math.max(maxY - y, 1),
    width: Math.max(maxX - x, 1),
    x,
    y
  };
}
