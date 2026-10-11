import { createEncounterState } from '@core/encounter/createEncounterState';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { prepareValidatedEncounterChangeAsync } from '@core/validation/validatedEncounterChange';

// Browser UI imports cannot execute in a module worker (including React refresh).
vi.mock('@ui/canvas_preferences/canvasPreferenceStorage', () => {
  throw new Error('Browser preferences were imported into the validation worker');
});

afterEach(() => vi.unstubAllGlobals());

it('boots and prepares changes without importing browser preference modules', async () => {
  const postMessage = vi.fn();
  let receive: (event: { data: unknown }) => void = () => {};
  vi.stubGlobal('self', {
    addEventListener: (_type: string, listener: typeof receive) => { receive = listener; },
    postMessage
  });
  await import('@core/validation/validation.worker');
  const currentEncounter = createEncounterState({ id: 'worker', name: 'Worker' });
  receive({ data: { type: 'prepare-change', requestId: 1, currentEncounter,
    nextEncounter: { ...currentEncounter, name: 'Changed' },
    action: createEncounterActionRecord('encounter.rename') } });
  expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
    type: 'change-prepared', prepared: expect.objectContaining({ blocked: false,
      nextEncounter: expect.objectContaining({ name: 'Changed' }) })
  }));
});

it.each(['startup', 'runtime'])('falls back to validated preparation after worker %s failure', async failure => {
  class FailedWorker {
    private onError: (event: object) => void = () => {};
    constructor() { if (failure === 'startup') throw new Error('Worker unavailable'); }
    addEventListener(type: string, listener: (event: object) => void) {
      if (type === 'error') this.onError = listener;
    }
    postMessage() { queueMicrotask(() => this.onError({})); }
    terminate() {}
  }
  vi.stubGlobal('Worker', FailedWorker);
  const currentEncounter = createEncounterState({ id: 'fallback', name: 'Fallback' });
  const prepared = await prepareValidatedEncounterChangeAsync({ currentEncounter,
    nextEncounter: { ...currentEncounter, name: 'Changed' },
    action: createEncounterActionRecord('encounter.rename') });
  expect(prepared.blocked).toBe(false);
  expect(prepared.nextEncounter.name).toBe('Changed');
  expect(prepared.action.validationResult?.valid).toBe(true);

  const invalidAction = createEncounterActionRecord('actor.move', { actorId: 'missing', destinationZoneId: 'missing' });
  const advisory = await prepareValidatedEncounterChangeAsync({ currentEncounter,
    nextEncounter: currentEncounter, action: invalidAction });
  expect(advisory.blocked).toBe(false);
  expect(advisory.action.validationResult?.valid).toBe(false);

  currentEncounter.validationState.mode = 'STRICT';
  const blocked = await prepareValidatedEncounterChangeAsync({ currentEncounter,
    nextEncounter: currentEncounter,
    action: invalidAction });
  expect(blocked.blocked).toBe(true);
});
