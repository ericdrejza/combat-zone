import type { LayoutPoint } from './types';
import type { NestingActor } from './nesting_ts';

export const GEOMETRY_EPSILON = 0.0001;

export function distance(a: LayoutPoint, b: LayoutPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function isPointInPolygon(
  point: LayoutPoint,
  polygon: LayoutPoint[]
): boolean {
  let inside = false;

  for (
    let index = 0, previous = polygon.length - 1;
    index < polygon.length;
    previous = index++
  ) {
    const current = polygon[index];
    const prior = polygon[previous];
    const cross =
      (point.y - prior.y) * (current.x - prior.x) -
      (point.x - prior.x) * (current.y - prior.y);
    const dot =
      (point.x - prior.x) * (current.x - prior.x) +
      (point.y - prior.y) * (current.y - prior.y);
    const lengthSquared = distance(prior, current) ** 2;

    if (
      Math.abs(cross) <= GEOMETRY_EPSILON &&
      dot >= -GEOMETRY_EPSILON &&
      dot <= lengthSquared + GEOMETRY_EPSILON
    ) {
      return true;
    }

    const crossesRay =
      (current.y > point.y) !== (prior.y > point.y) &&
      point.x <
        ((prior.x - current.x) * (point.y - current.y)) /
          (prior.y - current.y) +
          current.x;
    if (crossesRay) {
      inside = !inside;
    }
  }

  return inside;
}

export function getPolygonBounds(polygon: LayoutPoint[]) {
  return polygon.reduce(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      maxX: Math.max(bounds.maxX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxY: Math.max(bounds.maxY, point.y)
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY
    }
  );
}

export function getPolygonCenter(polygon: LayoutPoint[]): LayoutPoint {
  const bounds = getPolygonBounds(polygon);

  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2
  };
}

export function getFootprint(
  actor: NestingActor,
  center: LayoutPoint,
  expansion: number,
  circleSegments: number
): LayoutPoint[] {
  const radius = actor.radius + expansion;

  if (actor.shape === 'rectangle') {
    return [
      { x: center.x - radius, y: center.y - radius },
      { x: center.x + radius, y: center.y - radius },
      { x: center.x + radius, y: center.y + radius },
      { x: center.x - radius, y: center.y + radius }
    ];
  }

  return Array.from({ length: circleSegments }, (_, index) => {
    const angle = (index / circleSegments) * Math.PI * 2;

    return {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius
    };
  });
}

function orientation(a: LayoutPoint, b: LayoutPoint, c: LayoutPoint): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function segmentsIntersect(
  a: LayoutPoint,
  b: LayoutPoint,
  c: LayoutPoint,
  d: LayoutPoint
): boolean {
  const first = orientation(a, b, c);
  const second = orientation(a, b, d);
  const third = orientation(c, d, a);
  const fourth = orientation(c, d, b);

  return (
    ((first > GEOMETRY_EPSILON && second < -GEOMETRY_EPSILON) ||
      (first < -GEOMETRY_EPSILON && second > GEOMETRY_EPSILON)) &&
    ((third > GEOMETRY_EPSILON && fourth < -GEOMETRY_EPSILON) ||
      (third < -GEOMETRY_EPSILON && fourth > GEOMETRY_EPSILON))
  );
}

export function isFootprintInsideZone(
  footprint: LayoutPoint[],
  zonePolygon: LayoutPoint[]
): boolean {
  if (!footprint.every((point) => isPointInPolygon(point, zonePolygon))) {
    return false;
  }

  return !footprint.some((point, index) => {
    const next = footprint[(index + 1) % footprint.length];

    return zonePolygon.some((zonePoint, zoneIndex) =>
      segmentsIntersect(
        point,
        next,
        zonePoint,
        zonePolygon[(zoneIndex + 1) % zonePolygon.length]
      )
    );
  });
}

function getAxes(polygon: LayoutPoint[]): LayoutPoint[] {
  return polygon.map((point, index) => {
    const next = polygon[(index + 1) % polygon.length];
    const edge = { x: next.x - point.x, y: next.y - point.y };

    return { x: -edge.y, y: edge.x };
  });
}

function project(polygon: LayoutPoint[], axis: LayoutPoint) {
  const values = polygon.map((point) => point.x * axis.x + point.y * axis.y);

  return {
    min: Math.min(...values),
    max: Math.max(...values)
  };
}

export function footprintsOverlap(
  first: LayoutPoint[],
  second: LayoutPoint[]
): boolean {
  return [...getAxes(first), ...getAxes(second)].every((axis) => {
    const firstProjection = project(first, axis);
    const secondProjection = project(second, axis);

    return !(
      firstProjection.max <= secondProjection.min + GEOMETRY_EPSILON ||
      secondProjection.max <= firstProjection.min + GEOMETRY_EPSILON
    );
  });
}
