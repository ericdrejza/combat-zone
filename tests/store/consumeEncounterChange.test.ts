import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { isEncounterOperationActive } from '@core/history/encounterOperations';
import { prepareValidatedEncounterChange, type PreparedValidatedEncounterChange } from '@core/validation/validatedEncounterChange';
import { consumeEncounterChange } from '@store/consumeEncounterChange';
import { commitEncounterChange } from '@store/encounterSlice';
import { setPersistenceWritable } from '@store/persistenceWriteGuardMiddleware';
import { store } from '@store/store';
import { resetAppStore } from '@tests/ui/renderApp';

beforeEach(resetAppStore);
afterEach(() => setPersistenceWritable(true));
function fixture() {
  const before = store.getState().encounter.present;
  const result = prepareValidatedEncounterChange({ currentEncounter: before, nextEncounter: { ...before, name: 'Deferred' }, action: createEncounterActionRecord('encounter.rename') });
  let resolve!: (value: PreparedValidatedEncounterChange) => void;
  const pending = new Promise<PreparedValidatedEncounterChange>(done => { resolve = done; });
  const consume = vi.fn((resolved: PreparedValidatedEncounterChange) => store.dispatch(commitEncounterChange({ action: resolved.action, nextEncounter: resolved.nextEncounter })));
  const operation = consumeEncounterChange(pending, before, store.dispatch, consume);
  return { before, result, resolve, consume, operation };
}
it('keeps history blocked until a deferred commit finishes', async () => {
  const f = fixture(); expect(isEncounterOperationActive()).toBe(true);
  f.resolve(f.result); await f.operation;
  expect(store.getState().encounter.present.name).toBe('Deferred');
  expect(isEncounterOperationActive()).toBe(false);
});
it.each(['snapshot', 'writer'] as const)('rejects a deferred result after the %s changes', async kind => {
  const f = fixture();
  if (kind === 'writer') setPersistenceWritable(false);
  else store.dispatch(commitEncounterChange({ action: createEncounterActionRecord('encounter.rename'), nextEncounter: { ...f.before, name: 'Newer' } }));
  const current = store.getState().encounter.present;
  f.resolve(f.result); await f.operation;
  expect(f.consume).not.toHaveBeenCalled();
  expect(store.getState().encounter.present).toBe(current);
  expect(isEncounterOperationActive()).toBe(false);
});
