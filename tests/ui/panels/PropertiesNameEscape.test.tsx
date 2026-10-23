import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '@tests/ui/renderApp';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { createActor } from '@entities/actor/actorMutations';
import { createZone } from '@entities/zone/zoneMutations';
import { store } from '@store/store';
import { loadEncounterState, undoEncounterChange, redoEncounterChange } from '@store/encounterSlice';
import { setActiveTool, selectEntity, setRulerDraft, lockRulerDraft, setRulerPropertiesTarget } from '@interaction/interactionState';

it.each(['actor', 'zone', 'background', 'ruler'] as const)('Escape cancels typing in %s properties without history; Enter and undo/redo still commit and restore', async type => {
  renderApp();
  let state = createEncounterState({ id: 'name', name: 'Names' });
  state = createActor(state, { id: 'a', name: 'Actor before', currentZoneId: 'zoneless' });
  state = createZone(state, { id: 'z', name: 'Zone before', polygon: [{ x: 64, y: 64 }, { x: 320, y: 64 }, { x: 320, y: 320 }, { x: 64, y: 320 }] });
  state.backgroundImage = { source: { kind: 'url', url: 'https://example.com/castle.webp' }, name: 'Castle.webp', mediaType: 'image/webp', width: 960, height: 640 };
  act(() => {
    store.dispatch(loadEncounterState(state)); store.dispatch(setActiveTool(type === 'background' ? 'background' : type === 'ruler' ? 'ruler' : 'select'));
    if (type === 'actor') store.dispatch(selectEntity({ entityType: 'actor', ids: ['a'] }));
    if (type === 'zone') store.dispatch(selectEntity({ entityType: 'zone', ids: ['z'] }));
    if (type === 'ruler') {
      store.dispatch(setRulerDraft({ points: [{ x: 128, y: 128 }, { x: 256, y: 128 }], complete: false })); store.dispatch(lockRulerDraft());
      store.dispatch(setRulerPropertiesTarget(store.getState().encounter.present.rulers.allIds[0]));
    }
  });
  const properties = within(screen.getByRole('region', { name: 'Properties panel' }));
  const label = type === 'zone' ? 'Zone name' : type === 'ruler' ? 'Ruler name' : 'Name';
  const field = () => properties.getByRole('textbox', { name: label }) as HTMLInputElement;
  const before = store.getState().encounter.present, steps = store.getState().encounter.past.length, original = field().value;
  act(() => field().focus()); fireEvent.change(field(), { target: { value: 'Discard this' } }); fireEvent.keyDown(field(), { key: 'Escape' });
  expect(field()).toHaveValue(original); fireEvent.blur(field()); expect(store.getState().encounter.present).toBe(before); expect(store.getState().encounter.past).toHaveLength(steps);
  act(() => field().focus()); fireEvent.change(field(), { target: { value: 'Committed name' } }); fireEvent.keyDown(field(), { key: 'Enter' });
  await waitFor(() => expect(store.getState().encounter.past).toHaveLength(steps + 1)); expect(field()).toHaveValue('Committed name');
  act(() => store.dispatch(undoEncounterChange())); expect(field()).toHaveValue(original);
  act(() => store.dispatch(redoEncounterChange())); expect(field()).toHaveValue('Committed name');
});
