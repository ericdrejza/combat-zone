import type { EncounterState } from '@core/encounter/types';
import type { LayoutPoint } from '@core/layout/types';
import { isPointWithinCanvas } from '@core/layout/polygonCanvasBounds';
import type { Zone } from '@entities/zone/types';
import { remapZoneBounds } from '@entities/zone/remapZoneBounds';
import { normalizeRotation, rotatePoint } from '@entities/zone/zoneRotation';
import { nearbyAnchors } from './gridGeometry';
import { resolveGridGeometry } from './gridScale';
import { anchorKey, pointDistance } from './gridTopology';
import { zoneBoundsCorners } from './snappedZoneBounds';
import { snapZonePolygon } from './zoneVertexSnapping';

const EPSILON = 1e-5;
const squaredDistance = (a: LayoutPoint, b: LayoutPoint) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

/** Release-only reconciliation: search actual grid rectangles, allowing angle and size to settle together. */
export function snapZoneRotation(state: EncounterState, zone: Pick<Zone, 'shape' | 'polygon' | 'rotation'>): { polygon: LayoutPoint[]; rotation: number } {
  if (!state.movementRules.snapZoneVertices || zone.shape === 'polygon') {
    return { polygon: snapZonePolygon(state, zone), rotation: zone.rotation ?? 0 };
  }
  const requested = zoneBoundsCorners(zone);
  const grid = resolveGridGeometry(state.grid);
  const candidates = requested.map(point => [...new Map(nearbyAnchors(grid, point, 'large', 3)
    .filter(candidate => isPointWithinCanvas(candidate, state.canvasSize))
    .map(candidate => [anchorKey(candidate), candidate])).values()]);
  // A parallelogram's fourth corner is determined by its other three. Matching
  // that corner to a grid vertex plus perpendicular sides guarantees a rectangle.
  let best: LayoutPoint[] | undefined;
  let minimum = Infinity;
  for (const a of candidates[0]) for (const b of candidates[1]) {
    const x = b.x - a.x, y = b.y - a.y;
    const width = Math.hypot(x, y);
    const partial = squaredDistance(a, requested[0]) + squaredDistance(b, requested[1]);
    if (width < EPSILON || partial >= minimum) continue;
    for (const d of candidates[3]) {
      const dx = d.x - a.x, dy = d.y - a.y;
      const height = Math.hypot(dx, dy);
      if (height < EPSILON || x * dy - y * dx <= 0 || Math.abs(x * dx + y * dy) > 1e-8 * width * height) continue;
      const c = { x: b.x + dx, y: b.y + dy };
      const distance = partial + squaredDistance(c, requested[2]) + squaredDistance(d, requested[3]);
      if (distance >= minimum - EPSILON) continue;
      const vertex = candidates[2].find(point => pointDistance(point, c) < EPSILON);
      if (vertex) { minimum = distance; best = [a, b, vertex, d]; }
    }
  }
  if (!best) return { polygon: zone.polygon, rotation: zone.rotation ?? 0 };
  const corners = best;
  const rotation = normalizeRotation(Math.atan2(corners[1].y - corners[0].y, corners[1].x - corners[0].x) * 180 / Math.PI);
  const polygon = remapZoneBounds(zone, rotatePoint(corners[0], -rotation), rotatePoint(corners[2], -rotation), rotation)
    .map(point => corners.find(corner => pointDistance(corner, point) < EPSILON) ?? point);
  return { polygon, rotation };
}
