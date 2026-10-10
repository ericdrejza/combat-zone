import { act, fireEvent, waitFor } from '@testing-library/react';
import { store } from '@store/store';
import { redoEncounterChange, undoEncounterChange } from '@store/encounterSlice';
import { setPersistenceWritable } from '@store/persistenceWriteGuardMiddleware';
import { COMBAT_PREFERENCES_STORAGE_KEY } from '@ui/combat_preferences/CombatPreferenceProvider';
import { encounter, setup } from './actorKeyboardTestSupport';

describe('held-key spatial movement', () => {
  let clock = 0;
  beforeEach(() => { clock = 0; vi.spyOn(performance, 'now').mockImplementation(() => clock); });
  afterEach(() => { vi.restoreAllMocks(); localStorage.removeItem(COMBAT_PREFERENCES_STORAGE_KEY); });
  it.each(['grid', 'free'] as const)('repeats %s movement with independently undoable steps', async strategy => {
    const initial = encounter();
    initial.movementStrategy = strategy;
    initial.actors.byId.alpha.spatialPosition = { x: 160, y: 160 };
    setup(initial, ['alpha']);
    const distance = strategy === 'grid' ? 64 : 10;
    const snapshots = [store.getState().encounter.present];
    for (let step = 1; step <= 3; step++) {
      clock += 250;
      fireEvent.keyDown(window, { key: 'ArrowRight', repeat: step > 1 });
      await waitFor(() => expect(store.getState().encounter.present.actors.byId.alpha.spatialPosition).toEqual({ x: 160 + step * distance, y: 160 }));
      snapshots.push(store.getState().encounter.present);
    }
    expect(store.getState().encounter.past).toHaveLength(3);
    for (let step = 2; step >= 0; step--) {
      act(() => store.dispatch(undoEncounterChange()));
      expect(store.getState().encounter.present).toEqual(snapshots[step]);
    }
    for (let step = 1; step <= 3; step++) {
      act(() => store.dispatch(redoEncounterChange()));
      expect(store.getState().encounter.present).toEqual(snapshots[step]);
    }
  });

  it.each(['grid', 'free'] as const)('does not queue %s repeat events received during pending validation', async strategy => {
    const initial = encounter(); initial.movementStrategy = strategy;
    initial.actors.byId.alpha.spatialPosition = { x: 160, y: 160 };
    setup(initial, ['alpha']);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    clock += 250;
    fireEvent.keyDown(window, { key: 'ArrowRight', repeat: true });
    clock += 250;
    fireEvent.keyDown(window, { key: 'ArrowRight', repeat: true });
    fireEvent.keyUp(window, { key: 'ArrowRight' });
    await waitFor(() => expect(store.getState().encounter.past).toHaveLength(1));
    expect(store.getState().encounter.present.actors.byId.alpha.spatialPosition).toEqual({ x: strategy === 'grid' ? 224 : 170, y: 160 });
  });

  it.each(['ADVISORY', 'STRICT'] as const)('validates repeat steps at the canvas boundary in %s', async mode => {
    const initial = encounter(); initial.movementStrategy = 'free'; initial.validationState.mode = mode;
    initial.actors.byId.alpha.spatialPosition = { x: 1170, y: 160 };
    setup(initial, ['alpha']);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() => expect(store.getState().encounter.present.actors.byId.alpha.spatialPosition?.x).toBe(1180));
    const before = store.getState().encounter.present;
    clock += 250;
    fireEvent.keyDown(window, { key: 'ArrowRight', repeat: true });
    await waitFor(() => expect(store.getState().encounterLog.entries.some(entry => entry.actionType === 'actor.moveSpatial' && entry.kind === 'validation-block')).toBe(true));
    expect(store.getState().encounter.present).toBe(before);
    expect(store.getState().encounter.past).toHaveLength(1);
  });

  it.each([200, 500])('throttles native repeats to the configured %sms interval', async delay => {
    localStorage.setItem(COMBAT_PREFERENCES_STORAGE_KEY, JSON.stringify({ movementRepeatDelayMs: delay }));
    const initial = encounter(); initial.movementStrategy = 'grid';
    initial.actors.byId.alpha.spatialPosition = { x: 160, y: 160 };
    setup(initial, ['alpha']);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() => expect(store.getState().encounter.past).toHaveLength(1));
    clock = delay - 1;
    fireEvent.keyDown(window, { key: 'ArrowRight', repeat: true });
    await act(async () => {});
    expect(store.getState().encounter.past).toHaveLength(1);
    clock = delay;
    fireEvent.keyDown(window, { key: 'ArrowRight', repeat: true });
    await waitFor(() => expect(store.getState().encounter.past).toHaveLength(2));
    expect(store.getState().encounter.present.actors.byId.alpha.spatialPosition).toEqual({ x: 288, y: 160 });
  });

  it('does not bypass the writer boundary on repeated movement', async () => {
    const initial = encounter(); initial.movementStrategy = 'grid';
    initial.actors.byId.alpha.spatialPosition = { x: 160, y: 160 };
    setup(initial, ['alpha']);
    try {
      setPersistenceWritable(false);
      clock += 250;
      fireEvent.keyDown(window, { key: 'ArrowRight', repeat: true });
      await act(async () => {});
      expect(store.getState().encounter.past).toHaveLength(0);
      expect(store.getState().encounter.present).toEqual(initial);
    } finally { setPersistenceWritable(true); }
  });
});
