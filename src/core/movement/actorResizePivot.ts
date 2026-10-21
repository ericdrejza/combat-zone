import type { EncounterState } from '@core/encounter/types';
import type { LayoutPoint } from '@core/layout/types';
import type { ActorSize } from '@entities/actor/types';
import { actorAnchorCells, pointDistance } from './gridTopology';
import { nearbyAnchors, nearestPoint, worldToGrid } from './gridGeometry';
import { resolveGridGeometry } from './gridScale';
import { isSpatial, placeSpatialActors } from './movementStrategies';

/** A shared occupied cell prevents repeated center rounding from walking across the grid. */
function pivotCell(state: EncounterState, point: LayoutPoint, size: ActorSize): LayoutPoint | undefined {
  const grid = resolveGridGeometry(state.grid);
  return actorAnchorCells(state, point, size).map(({ center }) => worldToGrid(grid, center))
    .sort((a, b) => Math.abs(a.y - b.y) > 1e-5 ? a.y - b.y : a.x - b.x)[0];
}

/** Retain the top-left occupied cell in grid coordinates, including projected/warped grids. */
export function resizeSpatialActors(state: EncounterState, previous: EncounterState): EncounterState {
  if (!isSpatial(state) || !state.movementRules.snapToGrid) return state;
  const grid = resolveGridGeometry(state.grid);
  const points: Record<string, LayoutPoint> = {};
  for (const id of state.actors.allIds) {
    const actor = state.actors.byId[id], before = previous.actors.byId[id];
    if (!actor.spatialPosition || !before?.spatialPosition || actor.size === before.size) continue;
    const pivot = pivotCell(previous, before.spatialPosition, before.size);
    const candidates = pivot ? nearbyAnchors(grid, before.spatialPosition, actor.size, 3).filter(point => {
      const candidatePivot = pivotCell(state, point, actor.size);
      return candidatePivot && pointDistance(candidatePivot, pivot) < 1e-5;
    }) : [];
    points[id] = candidates.length ? nearestPoint(candidates, before.spatialPosition) : actor.spatialPosition;
  }
  return Object.keys(points).length ? placeSpatialActors(state, points) : state;
}
