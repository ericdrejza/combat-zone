import type { LayoutPoint } from './types';
import { getPolygonBounds, getPolygonCenter } from './polygonGeometry';

export type RectangleSide = 'left' | 'right' | 'top' | 'bottom';

export const RECTANGLE_SIDES: RectangleSide[] = [
  'left',
  'right',
  'top',
  'bottom'
];

export function getRadialPoint(
  point: LayoutPoint,
  origin: LayoutPoint,
  scale: number
): LayoutPoint {
  return {
    x: origin.x + (point.x - origin.x) * scale,
    y: origin.y + (point.y - origin.y) * scale
  };
}

export function getGenericCandidate(
  polygon: LayoutPoint[],
  origin: LayoutPoint,
  scale: number,
  blockedScales: number[]
): LayoutPoint[] {
  return polygon.map((point, index) =>
    getRadialPoint(
      point,
      origin,
      Math.min(scale, blockedScales[index] ?? Infinity)
    )
  );
}

export function getRectangleCandidate(
  polygon: LayoutPoint[],
  scale: number,
  blockedScales: number[]
): LayoutPoint[] {
  const bounds = getPolygonBounds(polygon);
  const origin = getPolygonCenter(polygon);
  const sideScale = (index: number) =>
    Math.min(scale, blockedScales[index] ?? Infinity);

  const minX = origin.x - (origin.x - bounds.minX) * sideScale(0);
  const maxX = origin.x + (bounds.maxX - origin.x) * sideScale(1);
  const minY = origin.y - (origin.y - bounds.minY) * sideScale(2);
  const maxY = origin.y + (bounds.maxY - origin.y) * sideScale(3);

  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY }
  ];
}

function setRectangleSide(
  polygon: LayoutPoint[],
  side: RectangleSide,
  coordinate: number
): LayoutPoint[] {
  const bounds = getPolygonBounds(polygon);
  const nextBounds = { ...bounds };

  if (side === 'left') {
    nextBounds.minX = coordinate;
  } else if (side === 'right') {
    nextBounds.maxX = coordinate;
  } else if (side === 'top') {
    nextBounds.minY = coordinate;
  } else {
    nextBounds.maxY = coordinate;
  }

  return [
    { x: nextBounds.minX, y: nextBounds.minY },
    { x: nextBounds.maxX, y: nextBounds.minY },
    { x: nextBounds.maxX, y: nextBounds.maxY },
    { x: nextBounds.minX, y: nextBounds.maxY }
  ];
}

function getSideCoordinate(
  polygon: LayoutPoint[],
  side: RectangleSide
): number {
  const bounds = getPolygonBounds(polygon);

  return side === 'left'
    ? bounds.minX
    : side === 'right'
      ? bounds.maxX
      : side === 'top'
        ? bounds.minY
        : bounds.maxY;
}

export function getRectangleSideScale(
  polygon: LayoutPoint[],
  basePolygon: LayoutPoint[],
  side: RectangleSide
): number {
  const baseBounds = getPolygonBounds(basePolygon);
  const baseCenter = getPolygonCenter(basePolygon);
  const bounds = getPolygonBounds(polygon);

  if (side === 'left') {
    return (baseCenter.x - bounds.minX) / (baseCenter.x - baseBounds.minX);
  }
  if (side === 'right') {
    return (bounds.maxX - baseCenter.x) / (baseBounds.maxX - baseCenter.x);
  }
  if (side === 'top') {
    return (baseCenter.y - bounds.minY) / (baseCenter.y - baseBounds.minY);
  }

  return (bounds.maxY - baseCenter.y) / (baseBounds.maxY - baseCenter.y);
}

export function getRadialScale(
  point: LayoutPoint,
  basePoint: LayoutPoint,
  origin: LayoutPoint
): number {
  const baseDistance = Math.hypot(basePoint.x - origin.x, basePoint.y - origin.y);

  if (baseDistance === 0) {
    return 1;
  }

  return Math.hypot(point.x - origin.x, point.y - origin.y) / baseDistance;
}

export function moveVertexToLimit(
  polygon: LayoutPoint[],
  vertexIndex: number,
  desiredPoint: LayoutPoint,
  isPolygonAllowed: (polygon: LayoutPoint[]) => boolean
): { polygon: LayoutPoint[]; reachedTarget: boolean } {
  const currentPoint = polygon[vertexIndex];
  const desiredPolygon = polygon.map((point, index) =>
    index === vertexIndex ? desiredPoint : point
  );

  if (isPolygonAllowed(desiredPolygon)) {
    return { polygon: desiredPolygon, reachedTarget: true };
  }

  let lower = 0;
  let upper = 1;

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const middle = (lower + upper) / 2;
    const candidate = polygon.map((point, index) =>
      index === vertexIndex
        ? {
            x: currentPoint.x + (desiredPoint.x - currentPoint.x) * middle,
            y: currentPoint.y + (desiredPoint.y - currentPoint.y) * middle
          }
        : point
    );

    if (isPolygonAllowed(candidate)) {
      lower = middle;
    } else {
      upper = middle;
    }
  }

  return {
    polygon: polygon.map((point, index) =>
      index === vertexIndex
        ? {
            x: currentPoint.x + (desiredPoint.x - currentPoint.x) * lower,
            y: currentPoint.y + (desiredPoint.y - currentPoint.y) * lower
          }
        : point
    ),
    reachedTarget: false
  };
}

export function moveSideToLimit(
  polygon: LayoutPoint[],
  side: RectangleSide,
  desiredCoordinate: number,
  isPolygonAllowed: (polygon: LayoutPoint[]) => boolean
): { polygon: LayoutPoint[]; reachedTarget: boolean } {
  const currentCoordinate = getSideCoordinate(polygon, side);
  const desiredPolygon = setRectangleSide(polygon, side, desiredCoordinate);

  if (isPolygonAllowed(desiredPolygon)) {
    return { polygon: desiredPolygon, reachedTarget: true };
  }

  let lower = 0;
  let upper = 1;

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const middle = (lower + upper) / 2;
    const candidate = setRectangleSide(
      polygon,
      side,
      currentCoordinate + (desiredCoordinate - currentCoordinate) * middle
    );

    if (isPolygonAllowed(candidate)) {
      lower = middle;
    } else {
      upper = middle;
    }
  }

  return {
    polygon: setRectangleSide(
      polygon,
      side,
      currentCoordinate + (desiredCoordinate - currentCoordinate) * lower
    ),
    reachedTarget: false
  };
}
