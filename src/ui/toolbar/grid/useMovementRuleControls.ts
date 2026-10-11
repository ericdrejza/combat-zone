import { reconcileMembership } from '@core/movement/reconcileMembership';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '@store/store';
import type { MovementRules } from '@core/movement/types';
import { changeMovementRules } from '@core/movement/changeMovementRules';
import { calculateActorPlacementGeometry } from '@ui/canvas/actors/actorPlacementGeometryCalculator';
import { spatialPlacements } from '@core/movement/movementStrategies';
import { useKeyboardEncounterCommit } from '@ui/canvas/useKeyboardEncounterCommit';
import { usePersistence } from '@ui/persistence/PersistenceProvider';

export function useMovementRuleControls() {
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const commit = useKeyboardEncounterCommit(), { readOnly } = usePersistence();
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function toggle(key: keyof MovementRules) {
    if (busy || readOnly) return;
    setBusy(true); setError('');
    try {
      const geometry = encounter.movementRules.zoneLocked ? calculateActorPlacementGeometry(encounter) : spatialPlacements(encounter).map(p => ({ actorId: p.actor.id, point: p.point }));
      const points = Object.fromEntries(geometry.map(p => [p.actorId, p.point]));
      const assigned = key === 'zoneLocked' && !encounter.movementRules.zoneLocked ? await reconcileMembership(encounter, encounter, createEncounterActionRecord('movement.updateRules')) : encounter;
      if (!assigned) return;
      if (!await commit('movement.updateRules', { rule: key, enabled: !encounter.movementRules[key] }, state => state !== encounter ? state : changeMovementRules(assigned, { [key]: !state.movementRules[key] }, points))) setError('The rule could not be applied. Check geometry and validation messages.');
    } finally { setBusy(false); }
  }
  return { encounter, toggle, disabled: busy || readOnly, error };
}
