import { getMinimumActorRadius } from './actorFootprints';
import type { LayoutPoint } from './types';

export function getMinimumZoneWidth(): number {
  return getMinimumActorRadius() * 2;
}

export function getMinimumZoneHeight(): number {
  return getMinimumActorRadius() * 2;
}

/** A zone must have room for at least one small actor footprint. */
export function isZonePolygonSizeValid(polygon: LayoutPoint[]): boolean {
  if (polygon.length === 0) {
    return false;
  }

  const xValues = polygon.map(({ x }) => x);
  const yValues = polygon.map(({ y }) => y);
  const width = Math.max(...xValues) - Math.min(...xValues);
  const height = Math.max(...yValues) - Math.min(...yValues);

  return (
    width >= getMinimumZoneWidth() &&
    height >= getMinimumZoneHeight()
  );
}
