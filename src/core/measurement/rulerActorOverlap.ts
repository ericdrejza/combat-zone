import type { EncounterState } from '@core/encounter/types';
import type { LayoutPoint } from '@core/layout/types';
import type { Actor } from '@entities/actor/types';
import { actorAnchorCells } from '@core/movement/gridTopology';
import { worldToGrid, snapToGrid } from '@core/movement/gridGeometry';
import { resolveGridGeometry } from '@core/movement/gridScale';
import { measureArea, type AreaMeasurement } from './areaGeometry';
import { coveredArea, type AreaCoverageShape, type RulerCellCoverage } from './cellCoverage';
import { circleIntersectionArea, clipHalfPlane, polygonArea } from './coverageGeometry';
import { measureRoute } from './distance';
import type { DiagonalCost, RulerOptions } from './types';

type OverlapArea = AreaMeasurement & { segment?: [LayoutPoint, LayoutPoint] };

/** Paths have no continuous area: only the route itself can touch a token. */
export function rulerOverlapAreas(encounter: EncounterState, points: LayoutPoint[], options: RulerOptions,
  policy: DiagonalCost, coverage: RulerCellCoverage): OverlapArea[] {
  if (points.length < 2) return [];
  if (options.shape !== 'path') return [measureArea(encounter, points[0], points.at(-1)!, options, policy, false, coverage)];
  const route = measureRoute(encounter.grid, points, encounter.movementRules.snapToGrid, policy).points;
  const grid = resolveGridGeometry(encounter.grid);
  return route.slice(1).map((point, i) => encounter.movementRules.snapToGrid
    ? measureArea(encounter, route[i], point, { shape: 'line' }, policy, false, coverage)
    : { cells: [], outlines: [], distance: 0, area: 0, segment: [worldToGrid(grid, route[i]), worldToGrid(grid, point)] });
}

function segmentDistance(point: LayoutPoint, a: LayoutPoint, b: LayoutPoint) {
  const dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length)) : 0;
  return Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy);
}

function circleTouchesArea(center: LayoutPoint, radius: number, shape: AreaCoverageShape) {
  const dx = center.x - shape.origin.x, dy = center.y - shape.origin.y, distance = Math.hypot(dx, dy);
  if (shape.shape === 'circle') return distance < radius + shape.radius;
  if (shape.shape !== 'cone') return circleIntersectionArea(shape.polygon, center, radius) > 1e-9;
  const delta = Math.atan2(Math.sin(Math.atan2(dy, dx) - shape.direction), Math.cos(Math.atan2(dy, dx) - shape.direction));
  if (Math.abs(delta) <= shape.halfAngle && distance < shape.radius + radius) return true;
  return [-1, 1].some(side => {
    const angle = shape.direction + side * shape.halfAngle;
    return segmentDistance(center, shape.origin, { x: shape.origin.x + shape.radius * Math.cos(angle), y: shape.origin.y + shape.radius * Math.sin(angle) }) < radius;
  });
}

/** Clip the route segment to a convex token footprint, including boundary touches. */
function segmentTouchesPolygon(segment: [LayoutPoint, LayoutPoint], polygon: LayoutPoint[]) {
  let clipped: LayoutPoint[] = segment;
  const orientation = polygon.reduce((sum, a, i) => sum + a.x * polygon[(i + 1) % polygon.length].y - a.y * polygon[(i + 1) % polygon.length].x, 0);
  for (let i = 0; i < polygon.length && clipped.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    clipped = clipHalfPlane(clipped, p => Math.sign(orientation) * ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) + 1e-9);
  }
  return clipped.length > 0;
}

/** Snapped coverage compares occupied cells; continuous coverage uses live token geometry. */
export function actorOverlapsRuler(encounter: EncounterState, actor: Actor, point: LayoutPoint,
  footprint: LayoutPoint[], areas: OverlapArea[]): boolean {
  if (encounter.movementRules.snapToGrid) {
    const grid = resolveGridGeometry(encounter.grid);
    const cells = actorAnchorCells(encounter, snapToGrid(grid, point, actor.size), actor.size);
    return areas.some(area => area.cells.some(vertices => {
      const center = { x: vertices.reduce((sum, p) => sum + p.x, 0) / vertices.length, y: vertices.reduce((sum, p) => sum + p.y, 0) / vertices.length };
      return cells.some(cell => Math.hypot(cell.center.x - center.x, cell.center.y - center.y) < 1e-5);
    }));
  }
  const grid = resolveGridGeometry(encounter.grid), polygon = footprint.map(p => worldToGrid(grid, p));
  const center = worldToGrid(grid, point), radius = Math.hypot(polygon[0].x - center.x, polygon[0].y - center.y);
  // Rotation preserves circles; projection/warp requires the transformed footprint instead.
  const circle = actor.shape === 'circle' && grid.type !== 'isometric' && !grid.warp;
  const tolerance = Math.max(1e-9, polygonArea(polygon) * 1e-10);
  return areas.some(area => {
    if (area.segment) return circle ? segmentDistance(center, ...area.segment) <= radius : segmentTouchesPolygon(area.segment, polygon);
    return area.coverageShape && (circle ? circleTouchesArea(center, radius, area.coverageShape) : coveredArea(polygon, area.coverageShape) > tolerance);
  });
}
