import type { EncounterState } from '@core/encounter/types';
import type { AppDispatch } from '@store/store';

/** Execute Redux thunks while recording only observable plain actions. */
export function encounterDispatchSpy(encounter: EncounterState) {
  const actions = vi.fn();
  const dispatch = ((action: unknown): unknown => {
    if (typeof action === 'function') return action(dispatch, () => ({ encounter: { present: encounter } }), undefined);
    return actions(action);
  }) as AppDispatch;
  return { dispatch, actions };
}
