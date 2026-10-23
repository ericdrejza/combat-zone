import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderApp, getCanvas, mockCanvasBounds } from '@tests/ui/renderApp';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { createActor } from '@entities/actor/actorMutations';
import { createZone } from '@entities/zone/zoneMutations';
import { addActorsToInitiative } from '@core/encounter/initiativeMutations';
import { store } from '@store/store';
import { loadEncounterState, undoEncounterChange, redoEncounterChange } from '@store/encounterSlice';
import { editLockedRuler, selectEntity, setActiveTool, setRulerDraft, lockRulerDraft, setRulerPropertiesTarget, updateLockedRuler } from '@interaction/interactionState';
import { KEYBIND_STORAGE_KEY } from '@ui/keybinds';

type Kind = 'actor' | 'zone' | 'ruler';
beforeEach(() => localStorage.removeItem(KEYBIND_STORAGE_KEY));
function setup(kind: Kind, mode: 'STRICT' | 'ADVISORY' = 'ADVISORY') {
  renderApp(); mockCanvasBounds(getCanvas());
  let state = createZone(createEncounterState({ id: 'names', name: 'Names' }), { id: 'z', name: 'Zone before', showName: true, polygon: [{ x: 64, y: 64 }, { x: 384, y: 64 }, { x: 384, y: 384 }, { x: 64, y: 384 }] });
  state = createActor(state, { id: 'a', name: 'Actor before', currentZoneId: 'z' });
  state = createActor(state, { id: 'b', name: 'Second actor', currentZoneId: 'z' });
  state = addActorsToInitiative(state, ['a', 'b']); state.validationState.mode = mode;
  act(() => {
    store.dispatch(loadEncounterState(state)); store.dispatch(setActiveTool(kind === 'ruler' ? 'ruler' : 'select'));
    if (kind === 'ruler') {
      store.dispatch(setRulerDraft({ points: [{ x: 128, y: 128 }, { x: 256, y: 128 }], complete: false })); store.dispatch(lockRulerDraft());
      const id = store.getState().encounter.present.rulers.allIds[0];
      store.dispatch(updateLockedRuler({ id, name: 'Ruler before' })); store.dispatch(setRulerPropertiesTarget(id));
    } else store.dispatch(selectEntity({ entityType: kind, ids: [kind === 'actor' ? 'a' : 'z'] }));
  });
}
function field(kind: Kind) {
  return within(screen.getByRole('region', { name: 'Properties panel' })).getByRole('textbox', { name: kind === 'actor' ? 'Name' : kind === 'zone' ? 'Zone name' : 'Ruler name' });
}
function expectCanvas(kind: Kind, name: string) {
  const canvas = within(getCanvas());
  if (kind === 'ruler') expect(canvas.getByLabelText('Measurement result')).toHaveTextContent(name);
  else expect(canvas.getByText(kind === 'actor' ? name.toUpperCase() : name)).toBeInTheDocument();
}
function expectPanelName(kind: Kind, name: string) {
  if (kind === 'actor') {
    expect(within(screen.getByLabelText('Selected actor names')).getByText(name)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: `${name} initiative` })).toBeInTheDocument();
  } else if (kind === 'zone') expect(within(screen.getByLabelText('Zone status')).getByLabelText('Selected zone name')).toHaveTextContent(name);
}
function storedName(kind: Kind) {
  const state = store.getState().encounter.present;
  return kind === 'actor' ? state.actors.byId.a.name : kind === 'zone' ? state.zones.byId.z.name : state.rulers.byId[state.rulers.allIds[0]].name;
}

it.each(['actor', 'zone', 'ruler'] as const)('previews %s properties on canvas and supported panels, cancels on Escape, and commits once with undo/redo', async kind => {
  setup(kind); const before = store.getState().encounter.present, steps = store.getState().encounter.past.length;
  const original = storedName(kind), input = field(kind);
  fireEvent.change(input, { target: { value: 'Live preview' } }); expectCanvas(kind, 'Live preview'); expectPanelName(kind, 'Live preview');
  expect(store.getState().encounter.present).toBe(before); expect(store.getState().encounter.past).toHaveLength(steps);
  fireEvent.keyDown(input, { key: 'Escape' }); expectCanvas(kind, original); expectPanelName(kind, original);
  fireEvent.blur(input); expect(store.getState().encounter.present).toBe(before);
  act(() => input.focus()); fireEvent.change(input, { target: { value: 'Committed' } });
  fireEvent.keyDown(input, { key: 'Enter' }); await waitFor(() => expect(storedName(kind)).toBe('Committed')); expectCanvas(kind, 'Committed'); expectPanelName(kind, 'Committed');
  expect(storedName(kind)).toBe('Committed'); expect(store.getState().interaction.namePreview).toBeNull();
  expect(store.getState().encounter.past).toHaveLength(steps + 1);
  act(() => store.dispatch(undoEncounterChange())); expect(storedName(kind)).toBe(original); expectCanvas(kind, original); expectPanelName(kind, original);
  act(() => store.dispatch(redoEncounterChange())); expectCanvas(kind, 'Committed'); expectPanelName(kind, 'Committed');
});
it.each(['actor', 'zone', 'ruler'] as const)('previews and cancels the %s rename dialog without changing history', kind => {
  setup(kind); const before = store.getState().encounter.present, steps = store.getState().encounter.past.length;
  fireEvent.keyDown(window, { key: 'n' });
  const dialog = within(screen.getByRole('dialog', { name: kind === 'ruler' ? 'Name ruler' : kind === 'actor' ? 'Rename actors' : 'Rename zones' }));
  const input = dialog.getByRole('textbox'); fireEvent.change(input, { target: { value: 'Dialog preview' } });
  expectCanvas(kind, 'Dialog preview'); expectPanelName(kind, 'Dialog preview'); expect(store.getState().encounter.present).toBe(before);
  fireEvent.click(dialog.getByRole('button', { name: 'Cancel' }));
  expectCanvas(kind, storedName(kind)); expectPanelName(kind, storedName(kind)); expect(store.getState().interaction.namePreview).toBeNull();
  expect(store.getState().encounter.past).toHaveLength(steps);
});
it.each(['STRICT', 'ADVISORY'] as const)('previews every selected actor and commits the dialog once in %s', mode => {
  setup('actor', mode); act(() => store.dispatch(selectEntity({ entityType: 'actor', ids: ['a', 'b'] })));
  const before = store.getState().encounter.present;
  fireEvent.keyDown(window, { key: 'n' }); const input = within(screen.getByRole('dialog', { name: 'Rename actors' })).getByRole('textbox');
  fireEvent.change(input, { target: { value: 'Guards' } });
  expect(within(getCanvas()).getAllByText('GUARDS')).toHaveLength(2);
  expect(within(screen.getByLabelText('Selected actor names')).getAllByText('Guards')).toHaveLength(2);
  expect(screen.getAllByRole('textbox', { name: 'Guards initiative' })).toHaveLength(2); expect(store.getState().encounter.present).toBe(before);
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(store.getState().encounter.present.actors.byId.a.name).toBe('Guards'); expect(store.getState().encounter.present.actors.byId.b.name).toBe('Guards');
  expect(store.getState().encounter.past).toHaveLength(1);
  act(() => store.dispatch(undoEncounterChange())); expect(store.getState().encounter.present).toEqual(before);
  act(() => store.dispatch(redoEncounterChange())); expect(within(getCanvas()).getAllByText('GUARDS')).toHaveLength(2);
});
it('previews a ruler geometry draft without changing it, then joins committed typing to the draft', () => {
  setup('ruler'); const state = store.getState().encounter.present, id = state.rulers.allIds[0], steps = store.getState().encounter.past.length;
  act(() => store.dispatch(editLockedRuler(id))); const draft = store.getState().interaction.editingRuler;
  fireEvent.change(field('ruler'), { target: { value: 'Preview draft' } }); expectCanvas('ruler', 'Preview draft');
  expect(store.getState().interaction.editingRuler).toBe(draft);
  fireEvent.keyDown(field('ruler'), { key: 'Escape' }); expectCanvas('ruler', 'Ruler before');
  fireEvent.change(field('ruler'), { target: { value: 'Pending draft' } }); fireEvent.blur(field('ruler'));
  expect(store.getState().interaction.editingRuler?.name).toBe('Pending draft'); expectCanvas('ruler', 'Pending draft');
  expect(store.getState().encounter.present).toBe(state); expect(store.getState().encounter.past).toHaveLength(steps);
  fireEvent.keyDown(window, { key: 'Escape' }); expectCanvas('ruler', 'Ruler before');
});
it('previews the radial ruler name dialog and restores it on Escape', () => {
  setup('ruler'); const before = store.getState().encounter.present;
  fireEvent.contextMenu(document.querySelector('[data-ruler-id] > g')!, { clientX: 128, clientY: 128 });
  fireEvent.click(screen.getByRole('menuitem', { name: 'Name ruler' }));
  const input = within(screen.getByRole('dialog', { name: 'Name ruler' })).getByRole('textbox');
  fireEvent.change(input, { target: { value: 'Radial preview' } }); expectCanvas('ruler', 'Radial preview');
  fireEvent.keyDown(input, { key: 'Escape' }); expectCanvas('ruler', 'Ruler before');
  expect(store.getState().encounter.present).toBe(before); expect(store.getState().interaction.namePreview).toBeNull();
});
it('clears previews on selection changes and snapshot loads', () => {
  setup('actor'); fireEvent.change(field('actor'), { target: { value: 'Discard selection' } });
  act(() => store.dispatch(selectEntity({ entityType: 'zone', ids: ['z'] })));
  expectCanvas('actor', 'Actor before'); expect(store.getState().interaction.namePreview).toBeNull();
  fireEvent.change(field('zone'), { target: { value: 'Discard load' } });
  act(() => store.dispatch(loadEncounterState(store.getState().encounter.present)));
  expectCanvas('zone', 'Zone before'); expect(store.getState().interaction.namePreview).toBeNull();
});

it.each(['actor', 'zone'] as const)('shares %s name previews with the Status popout and actor Initiative popout', kind => {
  setup(kind);
  const frames = [document.createElement('iframe'), document.createElement('iframe')];
  frames.forEach(frame => document.body.append(frame));
  const statusWindow = frames[0].contentWindow!, initiativeWindow = frames[1].contentWindow!;
  vi.spyOn(statusWindow, 'focus').mockImplementation(() => {});
  vi.spyOn(initiativeWindow, 'focus').mockImplementation(() => {});
  vi.spyOn(statusWindow, 'close').mockImplementation(() => {});
  vi.spyOn(initiativeWindow, 'close').mockImplementation(() => {});
  vi.spyOn(window, 'open').mockReturnValueOnce(statusWindow).mockReturnValueOnce(initiativeWindow);
  try {
    fireEvent.click(screen.getByRole('button', { name: 'Open Status window' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open Initiative window' }));
    const before = store.getState().encounter.present;
    fireEvent.change(field(kind), { target: { value: 'Shared preview' } });
    const status = within(statusWindow.document.body);
    if (kind === 'actor') {
      expect(within(status.getByLabelText('Selected actor names')).getByText('Shared preview')).toBeInTheDocument();
      expect(within(initiativeWindow.document.body).getByRole('textbox', { name: 'Shared preview initiative' })).toBeInTheDocument();
    } else expect(status.getByLabelText('Selected zone name')).toHaveTextContent('Shared preview');
    expect(store.getState().encounter.present).toBe(before);
    fireEvent.keyDown(field(kind), { key: 'Escape' });
    if (kind === 'actor') {
      expect(within(status.getByLabelText('Selected actor names')).getByText('Actor before')).toBeInTheDocument();
      expect(within(initiativeWindow.document.body).getByRole('textbox', { name: 'Actor before initiative' })).toBeInTheDocument();
    } else expect(status.getByLabelText('Selected zone name')).toHaveTextContent('Zone before');
    fireEvent.click(status.getByRole('button', { name: 'Close Status window' }));
    fireEvent.click(within(initiativeWindow.document.body).getByRole('button', { name: 'Close Initiative window' }));
  } finally { vi.restoreAllMocks(); frames.forEach(frame => frame.remove()); }
});
