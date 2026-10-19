import type { EncounterState } from '@core/encounter/types';
import type { LayoutPoint } from '@core/layout/types';
import type { Zone } from '@entities/zone/types';
import { getZoneLocalPolygon, rotatePoint } from '@entities/zone/zoneRotation';
import { getPolygonBounds } from '@core/layout/polygonGeometry';
import { createRectanglePolygon } from '@entities/zone/zoneShapeGeometry';
import { nearbyAnchors } from './gridGeometry';
import { resolveGridGeometry } from './gridScale';
import { anchorKey, nearestGridVertex, pointDistance } from './gridTopology';

const EPSILON = 1e-5;
const bucketKey = (x: number, y: number) => `${x}:${y}`;

function pointIndex(points: LayoutPoint[]) {
  const buckets = new Map<string, LayoutPoint[]>();
  for (const point of points) {
    const key = bucketKey(Math.round(point.x / EPSILON), Math.round(point.y / EPSILON));
    const bucket = buckets.get(key) ?? [];
    bucket.push(point); buckets.set(key, bucket);
  }
  return (point: LayoutPoint) => {
    const x = Math.round(point.x / EPSILON), y = Math.round(point.y / EPSILON);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      if (buckets.get(bucketKey(x + dx, y + dy))?.some(candidate => pointDistance(point, candidate) < EPSILON)) return true;
    }
    return false;
  };
}

/** All four corners of the oriented bounds, independent of generated outline samples. */
export function zoneBoundsCorners(zone: Pick<Zone, 'polygon' | 'rotation'>): LayoutPoint[] {
  const bounds = getPolygonBounds(getZoneLocalPolygon(zone));
  return createRectanglePolygon({ x: bounds.minX, y: bounds.minY }, { x: bounds.maxX, y: bounds.maxY })
    .map(point => rotatePoint(point, zone.rotation ?? 0));
}

/** Find nearby rectangular bounds whose four corners are grid vertices, without changing orientation. */
export function snappedZoneBounds(state: EncounterState, zone: Pick<Zone, 'polygon' | 'rotation'>, anchor?: LayoutPoint): { first: LayoutPoint; last: LayoutPoint } | null {
  const rotation = zone.rotation ?? 0;
  const bounds = getPolygonBounds(getZoneLocalPolygon(zone));
  if (bounds.maxX - bounds.minX < EPSILON || bounds.maxY - bounds.minY < EPSILON) return null;
  const requested = createRectanglePolygon({ x: bounds.minX, y: bounds.minY }, { x: bounds.maxX, y: bounds.maxY });
  const world = (point: LayoutPoint) => rotatePoint(point, rotation);
  const local = (point: LayoutPoint) => rotatePoint(point, -rotation);
  const fixed = anchor ? local(anchor) : undefined;
  const ratio = fixed ? { x: (fixed.x - bounds.minX) / (bounds.maxX - bounds.minX), y: (fixed.y - bounds.minY) / (bounds.maxY - bounds.minY) } : undefined;
  const keepsAnchor = (first: LayoutPoint, last: LayoutPoint) => !fixed || !ratio || pointDistance(fixed, {
    x: first.x + ratio.x * (last.x - first.x), y: first.y + ratio.y * (last.y - first.y)
  }) < EPSILON;
  const positive = (first: LayoutPoint, last: LayoutPoint) => last.x - first.x > EPSILON && last.y - first.y > EPSILON;
  const first = local(nearestGridVertex(state, world(requested[0])));
  const last = local(nearestGridVertex(state, world(requested[2])));
  if (positive(first, last) && keepsAnchor(first, last) && createRectanglePolygon(first, last)
    .every(point => pointDistance(world(point), nearestGridVertex(state, world(point))) < EPSILON)) return { first, last };

  // Search joint bounds rather than snapping four corners independently, which shears shapes.
  // The local neighborhood bounds pointer-frame work even on dense/warped grids.
  const grid = resolveGridGeometry(state.grid);
  const candidates = requested.map(point => [...new Map(nearbyAnchors(grid, world(point), 'large', 3)
    .map(candidate => [anchorKey(candidate), local(candidate)])).values()]);
  const hasTopRight = pointIndex(candidates[1]), hasBottomLeft = pointIndex(candidates[3]);
  let best: { first: LayoutPoint; last: LayoutPoint } | null = null;
  let minimum = Infinity;
  for (const a of candidates[0]) for (const c of candidates[2]) {
    if (!positive(a, c) || !keepsAnchor(a, c)) continue;
    const b = { x: c.x, y: a.y }, d = { x: a.x, y: c.y };
    if (!hasTopRight(b) || !hasBottomLeft(d)) continue;
    const distance = [a, b, c, d].reduce((sum, point, index) => sum +
      (point.x - requested[index].x) ** 2 + (point.y - requested[index].y) ** 2, 0);
    if (distance < minimum - EPSILON) { minimum = distance; best = { first: a, last: c }; }
  }
  return best;
}
