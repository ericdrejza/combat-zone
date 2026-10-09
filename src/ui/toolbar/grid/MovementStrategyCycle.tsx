import { calculateActorPlacementGeometry } from '@ui/canvas/actors/actorPlacementGeometryCalculator';
import { Repeat2 } from 'lucide-react';
import { useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '@store/store';
import { changeMovementStrategy } from '@core/movement/movementStrategies';
import { getActorRenderPlacements } from '@ui/canvas/actors/actorCanvasLayout';
import { useKeyboardEncounterCommit } from '@ui/canvas/useKeyboardEncounterCommit';
import { usePersistence } from '@ui/persistence/PersistenceProvider';
import { ToolbarOptionButton } from '../ToolbarOption';

export function MovementStrategyCycle() {
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const { readOnly } = usePersistence();
  const commit = useKeyboardEncounterCommit();
  const [busy, setBusy] = useState(false);
  const next = encounter.movementStrategy === 'zone' ? 'grid' : encounter.movementStrategy === 'grid' ? 'free' : 'zone';
  return <ToolbarOptionButton aria-label={`Movement strategy: ${encounter.movementStrategy}. Switch to ${next}`} title={`Switch movement to ${next}`} disabled={readOnly || busy} type="button"
    onClick={async () => {
      setBusy(true);
      try {
        const missing = encounter.movementStrategy === 'zone' ? encounter.zones.allIds.filter(zoneId => encounter.actors.allIds.some(id => {
          const actor = encounter.actors.byId[id]; return actor.currentZoneId === zoneId && !actor.spatialPosition && !getActorRenderPlacements(encounter).some(p => p.actor.id === id);
        })) : [];
        const fallback = Object.fromEntries(calculateActorPlacementGeometry(encounter, missing).map(({ actorId, point }) => [actorId, point]));
        const points = { ...fallback, ...Object.fromEntries(getActorRenderPlacements(encounter).map(({ actor, point }) => [actor.id, point])) };
        await commit('movement.changeStrategy', { strategy: next }, state => changeMovementStrategy(state, next, points));
      } finally { setBusy(false); }
    }}><Repeat2 aria-hidden="true" size={16} /></ToolbarOptionButton>;
}
