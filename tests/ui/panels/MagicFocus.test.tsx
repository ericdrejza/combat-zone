import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { createActor } from '@entities/actor/actorMutations';
import { selectEntity, setActiveTool } from '@interaction/interactionState';
import { loadEncounterState, undoEncounterChange, redoEncounterChange } from '@store/encounterSlice';
import { setPersistenceWritable } from '@store/persistenceWriteGuardMiddleware';
import { store } from '@store/store';
import { resetAppStore } from '@tests/ui/renderApp';
import { ActorStatusPanel } from '@ui/panels/status_panel/ActorStatusPanel';

function setup(mode: 'ADVISORY' | 'STRICT') {
  resetAppStore();
  let state = createEncounterState({ id: 'magic-focus', name: 'Magic Focus' });
  state = createActor(createActor(state, { id: 'a', name: 'Alpha', currentZoneId: 'zoneless' }), { id: 'b', name: 'Bravo', currentZoneId: 'zoneless' });
  state.validationState.mode = mode;
  state.actors.byId.a.statusEffects = ['weapon:sword', 'weapon:magic-focus'];
  state.actors.byId.b.statusEffects = ['weapon:sword'];
  store.dispatch(loadEncounterState(state));
  store.dispatch(setActiveTool('select'));
  store.dispatch(selectEntity({ entityType: 'actor', ids: ['a', 'b'] }));
  return render(<Provider store={store}><ActorStatusPanel /></Provider>);
}

afterEach(() => setPersistenceWritable(true));

it.each(['ADVISORY', 'STRICT'] as const)('toggles mixed Magic Focus independently with exact bulk history in %s mode', async (mode) => {
  setup(mode);
  const button = within(screen.getByRole('group', { name: 'Weapons' })).getByRole('button', { name: /^Magic focus$/i });
  expect(button).toHaveAttribute('aria-pressed', 'mixed');
  fireEvent.pointerEnter(button, { pointerType: 'mouse' });
  expect(screen.getByRole('tooltip')).toHaveTextContent(/Magic focus/i);
  fireEvent.pointerLeave(button, { pointerType: 'mouse' });
  const before = store.getState().encounter.present;
  fireEvent.click(button);
  await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'true'));
  const applied = store.getState().encounter.present;
  for (const id of ['a', 'b']) expect(applied.actors.byId[id].statusEffects).toEqual(['weapon:sword', 'weapon:magic-focus']);
  expect(store.getState().encounter.past).toHaveLength(1);
  act(() => store.dispatch(undoEncounterChange()));
  expect(store.getState().encounter.present).toEqual(before);
  expect(button).toHaveAttribute('aria-pressed', 'mixed');
  act(() => store.dispatch(redoEncounterChange()));
  expect(store.getState().encounter.present).toEqual(applied);
  fireEvent.click(button);
  await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'false'));
  for (const id of ['a', 'b']) expect(store.getState().encounter.present.actors.byId[id].statusEffects).toEqual(['weapon:sword']);
  const cleared = store.getState().encounter.present;
  setPersistenceWritable(false);
  fireEvent.click(button);
  await act(async () => {});
  expect(store.getState().encounter.present).toBe(cleared);
});
