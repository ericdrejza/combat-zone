import type { EncounterState } from '@core/encounter/types';
import { snapToGrid } from './gridGeometry';
import { resolveGridGeometry } from './gridScale';

/** Ordinary snapping is expected; occupancy-driven relocation needs an audit entry. */
export function adjustedSpatialActorIds(state: EncounterState, requested: unknown): string[] {
  if (!state.movementRules.snapToGrid || !requested || typeof requested !== 'object' || Array.isArray(requested)) return [];
  return Object.entries(requested).flatMap(([id, point]) => {
    const actor = state.actors.byId[id], actual = actor?.spatialPosition;
    if (!actual || !point || typeof point !== 'object' || Array.isArray(point) || typeof point.x !== 'number' || typeof point.y !== 'number') return [];
    const expected = snapToGrid(resolveGridGeometry(state.grid), point, actor.size);
    return Math.hypot(expected.x - actual.x, expected.y - actual.y) > 1e-6 ? [id] : [];
  });
}
