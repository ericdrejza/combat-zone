import type { EncounterState } from './types';
import { footprintFits, spatialActorRadius } from '@core/movement/gridGeometry';

export type BackgroundResizeOverflowBehavior = 'zoneless' | 'clamp';
export function readBackgroundResizeOverflowBehavior(value: unknown): BackgroundResizeOverflowBehavior {
  return value === 'clamp' ? 'clamp' : 'zoneless';
}

/** Includes saved placements while Zone mode is active. Check after edge completion. */
export function overflowingSpatialActorIds(state: EncounterState): string[] {
  return state.actors.allIds.filter(id => {
    const actor = state.actors.byId[id], point = actor.spatialPosition;
    return point && !footprintFits(point, spatialActorRadius(actor, state.grid, point), state.canvasSize);
  });
}

/** Clearing spatial placement preserves suspended Zone/Engagement relationships and resources. */
export function unplaceOverflowingSpatialActors(state: EncounterState): EncounterState {
  const outside = overflowingSpatialActorIds(state);
  if (!outside.length) return state;
  const byId = { ...state.actors.byId };
  for (const id of outside) {
    byId[id] = { ...byId[id] }; delete byId[id].spatialPosition;
  }
  return { ...state, actors: { ...state.actors, byId } };
}
