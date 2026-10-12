import { act, renderHook } from '@testing-library/react';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { isEncounterOperationActive } from '@core/history/encounterOperations';
import { prepareValidatedEncounterChangeForRuntime } from '@core/validation/runtimeEncounterChange';
import { prepareValidatedEncounterChange } from '@core/validation/validatedEncounterChange';
import { mergeEngagements } from '@entities/engagement/engagementMutations';
import { commitEncounterChange, loadEncounterState } from '@store/encounterSlice';
import { store } from '@store/store';
import { setPersistenceWritable } from '@store/persistenceWriteGuardMiddleware';
import { resetAppStore } from '@tests/ui/renderApp';
import { actor, collection, zone } from '@tests/ui/canvas/CanvasShell.actorSelection.test-support';
import { useEngagementDrag } from '@ui/canvas/engagements/useEngagementDrag';

vi.mock('@core/validation/runtimeEncounterChange', () => ({ prepareValidatedEncounterChangeForRuntime: vi.fn() }));
beforeEach(resetAppStore);
afterEach(() => setPersistenceWritable(true));
it.each(['snapshot', 'writer', 'failure'] as const)('rejects an unfinished merge after a %s change and releases its operation', async kind => {
  const encounter = {
    ...createEncounterState({ id: 'deferred', name: 'Deferred' }),
    zones: collection([zone('zone', 0, 0, 600, 400)]),
    actors: collection(['a', 'b', 'c', 'd'].map(id => actor(id, 'zone'))),
    engagements: collection([
      { id: 'source', parentZoneId: 'zone', participantIds: ['a', 'b'], layoutOrientation: 'LEFT_RIGHT' as const, layoutStrategy: 'FLEX' as const },
      { id: 'target', parentZoneId: 'zone', participantIds: ['c', 'd'], layoutOrientation: 'LEFT_RIGHT' as const, layoutStrategy: 'FLEX' as const }
    ])
  };
  store.dispatch(loadEncounterState(encounter));
  let resolve!: (value: ReturnType<typeof prepareValidatedEncounterChange>) => void;
  let reject!: (reason: Error) => void;
  vi.mocked(prepareValidatedEncounterChangeForRuntime).mockReturnValue(new Promise((done, fail) => { resolve = done; reject = fail; }));
  const placements = ['a', 'b', 'c', 'd'].map((id, index) => ({ actor: encounter.actors.byId[id], point: { x: [60, 120, 280, 400][index], y: index < 2 ? 100 : 220 }, radius: 15 }));
  const { result } = renderHook(() => useEngagementDrag(store.dispatch, encounter, placements));
  act(() => {
    result.current.handleEngagementDragStart('source', { x: 90, y: 100 });
    result.current.handleEngagementDrag({ x: 340, y: 220 });
    result.current.handleEngagementDragEnd();
  });
  expect(isEncounterOperationActive()).toBe(true);
  if (kind === 'writer') setPersistenceWritable(false);
  if (kind === 'snapshot') store.dispatch(commitEncounterChange({ action: createEncounterActionRecord('encounter.rename'), nextEncounter: { ...encounter, name: 'Newer' } }));
  const current = store.getState().encounter.present;
  await act(async () => {
    if (kind === 'failure') reject(new Error('Worker failed'));
    else resolve(prepareValidatedEncounterChange({ currentEncounter: encounter, nextEncounter: mergeEngagements(encounter, 'source', 'target'), action: createEncounterActionRecord('engagement.merge') }));
  });
  expect(store.getState().encounter.present).toBe(current);
  expect(result.current.engagementDrag).toBeNull();
  expect(isEncounterOperationActive()).toBe(false);
});
