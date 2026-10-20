import { validRulerArtifact } from '@combat-zone/firebase-api';
import type { EncounterState } from '@core/encounter/types';
import type { LockedRuler } from './types';
import { rulersEqual } from './rulerEquality';

export function saveRuler(state: EncounterState, ruler: LockedRuler): EncounterState {
  if (!validRulerArtifact(ruler)) return state;
  const existing = state.rulers.byId[ruler.id];
  if (existing && rulersEqual([existing], [ruler])) return state;
  return { ...state, rulers: { allIds: existing ? state.rulers.allIds : [...state.rulers.allIds, ruler.id], byId: { ...state.rulers.byId, [ruler.id]: ruler } } };
}
export function deleteRuler(state: EncounterState, id: string): EncounterState {
  if (!state.rulers.byId[id]) return state;
  const { [id]: _removed, ...byId } = state.rulers.byId;
  return { ...state, rulers: { byId, allIds: state.rulers.allIds.filter(value => value !== id) } };
}
export function clearSavedRulers(state: EncounterState): EncounterState {
  return state.rulers.allIds.length ? { ...state, rulers: { byId: {}, allIds: [] } } : state;
}
