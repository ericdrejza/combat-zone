import type { EncounterState } from '@core/encounter/types';
import type { LayoutPoint } from '@core/layout/types';
import type { EncounterActionRecord } from '@core/history/types';
import type { MovementPreferences } from './types';
import { measureRoute } from './distance';

export function resetMovementAccounting(state: EncounterState): EncounterState {
  return Object.keys(state.initiativeTracker.movement ?? {}).length
    ? { ...state, initiativeTracker: { ...state.initiativeTracker, movement: {} } } : state;
}
export function movementTrackingActive(state: EncounterState, preferences: MovementPreferences, actorId: string) {
  return preferences.trackMovement && !state.movementRules.zoneLocked && state.initiativeTracker.currentRound !== null && state.initiativeTracker.currentActorId === actorId;
}
/** Runs inside the accepted candidate: counters never survive a rejected movement alone. */
export function reconcileMovementAccounting(before: EncounterState, next: EncounterState, action: EncounterActionRecord,
  preferences: MovementPreferences): EncounterState {
  const old = before.initiativeTracker, tracker = next.initiativeTracker;
  const periodChanged = old.currentRound !== tracker.currentRound || (preferences.resetMovement === 'turn' && old.currentActorId !== tracker.currentActorId);
  const scaleChanged = before.grid.distancePerCell !== next.grid.distancePerCell || before.grid.distanceUnit !== next.grid.distanceUnit;
  if (periodChanged || scaleChanged || action.type === 'movement.settings') next = resetMovementAccounting(next);
  let totals = next.initiativeTracker.movement ?? {};
  const retained = Object.fromEntries(Object.entries(totals).filter(([id]) => !!next.actors.byId[id]));
  if (Object.keys(retained).length !== Object.keys(totals).length) totals = retained;
  if (action.type === 'actor.moveSpatial' && !before.movementRules.zoneLocked && !action.payload.removedFromCanvas) {
    for (const id of next.actors.allIds) {
      const start = before.actors.byId[id]?.spatialPosition, end = next.actors.byId[id]?.spatialPosition;
      if (!start || !end || (start.x === end.x && start.y === end.y) || !movementTrackingActive(next, preferences, id)) continue;
      const prior = totals[id] ?? { distance: 0, diagonals: 0 };
      const paths = action.payload.movementWaypoints as Record<string, LayoutPoint[]> | undefined;
      const route = measureRoute(next.grid, [start, ...(paths?.[id] ?? []), end], next.movementRules.snapToGrid, preferences.diagonalCost, prior.diagonals, next.actors.byId[id].size);
      totals = { ...totals, [id]: { distance: prior.distance + route.distance, diagonals: prior.diagonals + route.diagonals } };
    }
  }
  return totals === next.initiativeTracker.movement || (!next.initiativeTracker.movement && !Object.keys(totals).length)
    ? next : { ...next, initiativeTracker: { ...next.initiativeTracker, movement: totals } };
}
