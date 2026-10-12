import type { Dispatch } from 'redux';
import type { EncounterState } from '@core/encounter/types';
import { consumeEncounterPreparation } from '@core/history/encounterOperations';
import type { PreparedValidatedEncounterChange } from '@core/validation/validatedEncounterChange';
import type { AppDispatch } from './store';
import { isPersistenceWritable } from './persistenceWriteGuardMiddleware';

/** Validation and approval results may only apply to the snapshot they were prepared from. */
export function consumeEncounterChange(
  prepared: PreparedValidatedEncounterChange | Promise<PreparedValidatedEncounterChange>,
  encounter: EncounterState,
  dispatch: Dispatch,
  consume: (value: PreparedValidatedEncounterChange) => void
): void | Promise<void> {
  return consumeEncounterPreparation(prepared, (resolved) => {
    (dispatch as AppDispatch)((_dispatch, getState) => {
      if (isPersistenceWritable() && getState().encounter.present === encounter) consume(resolved);
    });
  });
}
