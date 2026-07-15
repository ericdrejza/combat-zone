import type { LayoutPoint } from "@core/layout/types";
import type { Zone } from "@entities/zone/types";
import type { ZoneShape } from "@entities/zone/types";
import { MIN_SHAPE_SIZE } from "./canvasConstants";
import {
  createCirclePolygonFromBounds,
  createHexagonPolygonFromBounds,
  getPolygonBounds
} from "./zoneShapeGeometry";

export function resizeRectanglePolygon(
  polygon: LayoutPoint[],
  vertexIndex: number,
  point: LayoutPoint
): LayoutPoint[] {
  if (polygon.length !== 4) {
    return polygon.map((existingPoint, index) =>
      index === vertexIndex ? point : existingPoint
    );
  }

  const nextPolygon = [...polygon];

  if (vertexIndex === 0) {
    const opposite = polygon[2];

    nextPolygon[0] = point;
    nextPolygon[1] = { x: opposite.x, y: point.y };
    nextPolygon[2] = opposite;
    nextPolygon[3] = { x: point.x, y: opposite.y };
  }

  if (vertexIndex === 1) {
    const opposite = polygon[3];

    nextPolygon[0] = { x: opposite.x, y: point.y };
    nextPolygon[1] = point;
    nextPolygon[2] = { x: point.x, y: opposite.y };
    nextPolygon[3] = opposite;
  }

  if (vertexIndex === 2) {
    const opposite = polygon[0];

    nextPolygon[0] = opposite;
    nextPolygon[1] = { x: point.x, y: opposite.y };
    nextPolygon[2] = point;
    nextPolygon[3] = { x: opposite.x, y: point.y };
  }

  if (vertexIndex === 3) {
    const opposite = polygon[1];

    nextPolygon[0] = { x: point.x, y: opposite.y };
    nextPolygon[1] = opposite;
    nextPolygon[2] = { x: opposite.x, y: point.y };
    nextPolygon[3] = point;
  }

  return nextPolygon;
}

export function resizeGeneratedShapePolygon(
  polygon: LayoutPoint[],
  handleIndex: number,
  point: LayoutPoint,
  shape: Extract<ZoneShape, "circle" | "hexagon">
): LayoutPoint[] {
  const bounds = getPolygonBounds(polygon);
  const nextBounds = { ...bounds };
  const maxX = bounds.x + bounds.width;
  const maxY = bounds.y + bounds.height;

  if (handleIndex === 0 || handleIndex === 1 || handleIndex === 7) {
    nextBounds.y = point.y;
    nextBounds.height = maxY - point.y;
  }

  if (handleIndex === 1 || handleIndex === 2 || handleIndex === 3) {
    nextBounds.width = point.x - bounds.x;
  }

  if (handleIndex === 3 || handleIndex === 4 || handleIndex === 5) {
    nextBounds.height = point.y - bounds.y;
  }

  if (handleIndex === 5 || handleIndex === 6 || handleIndex === 7) {
    nextBounds.x = point.x;
    nextBounds.width = maxX - point.x;
  }

  const normalizedBounds = {
    x:
      nextBounds.width >= 0
        ? nextBounds.x
        : nextBounds.x + nextBounds.width,
    y:
      nextBounds.height >= 0
        ? nextBounds.y
        : nextBounds.y + nextBounds.height,
    width: Math.max(Math.abs(nextBounds.width), MIN_SHAPE_SIZE),
    height: Math.max(Math.abs(nextBounds.height), MIN_SHAPE_SIZE)
  };

  return shape === "circle"
    ? createCirclePolygonFromBounds(normalizedBounds)
    : createHexagonPolygonFromBounds(normalizedBounds);
}

export function getZoneResizeHandles(
  zone: Zone,
  polygon: LayoutPoint[]
): LayoutPoint[] {
  if (zone.shape === "circle" || zone.shape === "hexagon") {
    const bounds = getPolygonBounds(polygon);
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;

    return [
      { x: centerX, y: bounds.y },
      { x: bounds.x + bounds.width, y: bounds.y },
      { x: bounds.x + bounds.width, y: centerY },
      { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
      { x: centerX, y: bounds.y + bounds.height },
      { x: bounds.x, y: bounds.y + bounds.height },
      { x: bounds.x, y: centerY },
      { x: bounds.x, y: bounds.y }
    ];
  }

  return polygon;
}

export function resizeZonePolygon(
  zone: Zone,
  polygon: LayoutPoint[],
  vertexIndex: number,
  point: LayoutPoint
): LayoutPoint[] {
  if (zone.shape === "rectangle") {
    return resizeRectanglePolygon(polygon, vertexIndex, point);
  }

  if (zone.shape === "circle" || zone.shape === "hexagon") {
    return resizeGeneratedShapePolygon(polygon, vertexIndex, point, zone.shape);
  }

  return polygon.map((existingPoint, index) =>
    index === vertexIndex ? point : existingPoint
  );
}
