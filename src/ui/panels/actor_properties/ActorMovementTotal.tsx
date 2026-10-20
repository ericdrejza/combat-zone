import { abbreviateDistanceUnit } from '@core/measurement/distanceUnits';
import { useSelector } from 'react-redux';
import type { RootState } from '@store/store';
import { useMovementPreferences } from '@ui/combat_preferences/useMovementPreferences';
import { movementTrackingActive } from '@core/measurement/movementAccounting';

export function ActorMovementTotal({ actorId }: { actorId: string }) {
  const state = useSelector((state: RootState) => state.encounter.present);
  const { preferences } = useMovementPreferences();
  if (!preferences.trackMovement || state.movementRules.zoneLocked || state.initiativeTracker.currentRound === null) return null;
  const total = state.initiativeTracker.movement?.[actorId]?.distance ?? 0, limit = state.actors.byId[actorId]?.movementLimit;
  return <p role="status" aria-label="Movement spent" className={limit !== undefined && total > limit ? 'text-red-600 dark:text-red-400' : 'text-canvas-muted'}>
    Movement: {Number(total.toFixed(2))} {abbreviateDistanceUnit(state.grid.distanceUnit ?? 'feet')}
    {movementTrackingActive(state, preferences, actorId) ? ' · current turn' : ''}
  </p>;
}
