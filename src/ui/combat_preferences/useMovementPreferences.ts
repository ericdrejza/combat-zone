import { useEffect, useState } from 'react';
import type { MovementPreferences } from '@core/measurement/types';
import { resetMovementAccounting } from '@core/measurement/movementAccounting';
import { useStore } from 'react-redux';
import type { RootState } from '@store/store';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { commitEncounterChange } from '@store/encounterSlice';
import { runEncounterOperation } from '@core/history/encounterOperations';
import { prepareValidatedEncounterChangeForRuntime } from '@core/validation/runtimeEncounterChange';
import { isPersistenceWritable } from '@store/persistenceWriteGuardMiddleware';
import { LOCAL_PREFERENCES_RESET_EVENT } from '@ui/motion_preferences/MotionPreferenceProvider';
import { MOVEMENT_PREFERENCES_KEY, MOVEMENT_PREFERENCES_EVENT, readMovementPreferences, saveMovementPreferences, clearMovementPreferenceFallback } from './movementPreferenceStorage';

export function useMovementPreferences() {
  const [preferences, setPreferences] = useState(readMovementPreferences);
  const store = useStore<RootState>();
  useEffect(() => {
    const refresh = () => { clearMovementPreferenceFallback(); setPreferences(readMovementPreferences()); };
    const update = (event: Event) => setPreferences((event as CustomEvent<MovementPreferences>).detail);
    const storage = (event: StorageEvent) => { if (event.key === MOVEMENT_PREFERENCES_KEY || event.key === null) refresh(); };
    globalThis.addEventListener('storage', storage);
    globalThis.addEventListener(MOVEMENT_PREFERENCES_EVENT, update);
    globalThis.addEventListener(LOCAL_PREFERENCES_RESET_EVENT, refresh);
    return () => { globalThis.removeEventListener('storage', storage); globalThis.removeEventListener(MOVEMENT_PREFERENCES_EVENT, update); globalThis.removeEventListener(LOCAL_PREFERENCES_RESET_EVENT, refresh); };
  }, []);
  async function save(next: MovementPreferences) {
    if (!isPersistenceWritable()) return;
    await runEncounterOperation(async () => {
      const before = store.getState().encounter.present, after = resetMovementAccounting(before);
      if (after !== before) {
        const prepared = await prepareValidatedEncounterChangeForRuntime({ currentEncounter: before, nextEncounter: after, action: createEncounterActionRecord('movement.settings') });
        if (prepared.blocked || prepared.requiresConfirmation || !isPersistenceWritable() || store.getState().encounter.present !== before) return;
        store.dispatch(commitEncounterChange({ action: prepared.action, nextEncounter: prepared.nextEncounter }));
      }
      if (isPersistenceWritable()) saveMovementPreferences(next);
    });
  }
  return { preferences, save };
}
