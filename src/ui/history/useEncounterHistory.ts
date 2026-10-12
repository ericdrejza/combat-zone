import { useContext, useSyncExternalStore } from 'react';
import { useSelector, useStore } from 'react-redux';
import { isEncounterOperationActive, subscribeEncounterOperations } from '@core/history/encounterOperations';
import { canRedoEncounterHistory, canUndoEncounterHistory } from '@core/history/types';
import { redoEncounterChange, undoEncounterChange } from '@store/encounterSlice';
import { isPersistenceWritable } from '@store/persistenceWriteGuardMiddleware';
import type { RootState } from '@store/store';
import { PersistenceContext } from '@ui/persistence/PersistenceContext';

/** Visible controls and shortcuts share both availability and last-moment guards. */
export function useEncounterHistory() {
  const store = useStore<RootState>();
  const history = useSelector((state: RootState) => state.encounter);
  const { readOnly, initialized } = useContext(PersistenceContext);
  const busy = useSyncExternalStore(subscribeEncounterOperations, isEncounterOperationActive, () => false);
  const enabled = initialized && !readOnly && !busy;
  const replay = (direction: 'undo' | 'redo') => {
    if (!initialized || readOnly || !isPersistenceWritable() || isEncounterOperationActive()) return;
    const current = store.getState().encounter;
    if (direction === 'undo' ? canUndoEncounterHistory(current) : canRedoEncounterHistory(current)) {
      store.dispatch(direction === 'undo' ? undoEncounterChange() : redoEncounterChange());
    }
  };
  return {
    canUndo: enabled && canUndoEncounterHistory(history),
    canRedo: enabled && canRedoEncounterHistory(history),
    undo: () => replay('undo'), redo: () => replay('redo')
  };
}
