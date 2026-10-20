import type { EncounterState } from '@core/encounter/types';
import type { Actor } from '@entities/actor/types';
import type { LayoutPoint } from '@core/layout/types';
import type { DiagonalCost } from './types';
import { measureRoute, projectPolyline } from './distance';
import { cellBoundary } from './cellBoundary';
import { canvasCellCenters, cellVertices, actorAnchorCells, anchorKey } from '@core/movement/gridTopology';
import { gridToWorld, worldToGrid, footprintFits, spatialActorRadius } from '@core/movement/gridGeometry';
import { resolveGridGeometry } from '@core/movement/gridScale';

/** A distance envelope is advisory; it does not introduce obstacle pathfinding or change destination validation. */
export function movementReachOutlines(state: EncounterState, actor: Actor, available: number, policy: DiagonalCost, priorDiagonals = 0): LayoutPoint[][] {
  const start = actor.spatialPosition;
  if (!start || state.movementRules.zoneLocked || !Number.isFinite(available)) return [];
  const grid = resolveGridGeometry(state.grid), local = worldToGrid(grid, start), unit = state.grid.distancePerCell ?? 5;
  const radius = Math.max(0, available) / unit * grid.cellSize;
  if (!state.movementRules.snapToGrid) return [projectPolyline(state.grid, Array.from({ length: 128 }, (_, i) => ({
    x: local.x + Math.cos(i * Math.PI / 64) * radius, y: local.y + Math.sin(i * Math.PI / 64) * radius
  })), true)];
  const extent = radius * Math.SQRT2 + grid.cellSize * 2;
  const corners = [-1, 1].flatMap(x => [-1, 1].map(y => gridToWorld(grid, { x: local.x + x * extent, y: local.y + y * extent })));
  const region = { minX: Math.max(0, Math.min(...corners.map(p => p.x))), minY: Math.max(0, Math.min(...corners.map(p => p.y))),
    maxX: Math.min(state.canvasSize.width, Math.max(...corners.map(p => p.x))), maxY: Math.min(state.canvasSize.height, Math.max(...corners.map(p => p.y))) };
  const centers = canvasCellCenters(state, region);
  const candidates = actor.size === 'large' ? centers.flatMap(center => cellVertices(grid, center)) : centers;
  const anchors = new Map(candidates.map(point => [anchorKey(point), point]));
  const cells = new Map<string, LayoutPoint[]>();
  for (const point of anchors.values()) {
    if (!footprintFits(point, spatialActorRadius(actor), state.canvasSize)) continue;
    const route = measureRoute(state.grid, [start, point], true, policy, priorDiagonals, actor.size);
    if (route.distance > Math.max(0, available) + 1e-7) continue;
    for (const cell of actorAnchorCells(state, point, actor.size)) {
      if (cell.polygon.every(p => p.x >= -1e-7 && p.y >= -1e-7 && p.x <= state.canvasSize.width + 1e-7 && p.y <= state.canvasSize.height + 1e-7)) cells.set(anchorKey(cell.center), cell.polygon.map(p => worldToGrid(grid, p)));
    }
  }
  return cellBoundary([...cells.values()]).map(outline => projectPolyline(state.grid, outline, true));
}
