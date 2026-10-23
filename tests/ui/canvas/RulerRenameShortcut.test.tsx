import { act, fireEvent, screen, within } from '@testing-library/react';
import { renderApp } from '@tests/ui/renderApp';
import { store } from '@store/store';
import { editLockedRuler, lockRulerDraft, setActiveTool, setRulerDraft, setRulerPropertiesTarget } from '@interaction/interactionState';
import { selectLockedRulers } from '@interaction/rulerState';
import { loadEncounterState, redoEncounterChange, undoEncounterChange } from '@store/encounterSlice';
import { DEFAULT_KEYBINDS, KEYBIND_STORAGE_KEY } from '@ui/keybinds';

beforeEach(() => localStorage.removeItem(KEYBIND_STORAGE_KEY));
afterEach(() => localStorage.removeItem(KEYBIND_STORAGE_KEY));

function setup() {
  renderApp();
  act(() => {
    store.dispatch(setActiveTool('ruler'));
    store.dispatch(setRulerDraft({ points: [{ x: 128, y: 128 }, { x: 256, y: 128 }], complete: false }));
    store.dispatch(lockRulerDraft());
  });
  const ruler = selectLockedRulers(store.getState())[0];
  act(() => store.dispatch(setRulerPropertiesTarget(ruler.id)));
  return ruler;
}

function rename(name: string) {
  fireEvent.keyDown(window, { key: 'n' });
  const dialog = within(screen.getByRole('dialog', { name: 'Name ruler' }));
  fireEvent.change(dialog.getByRole('textbox', { name: 'Ruler name' }), { target: { value: name } });
  fireEvent.click(dialog.getByRole('button', { name: 'Rename' }));
}

it.each(['STRICT', 'ADVISORY'] as const)('renames the targeted ruler with exact undo/redo in %s', mode => {
  const ruler = setup();
  const encounter = { ...store.getState().encounter.present, validationState: { ...store.getState().encounter.present.validationState, mode } };
  act(() => { store.dispatch(loadEncounterState(encounter)); store.dispatch(setRulerPropertiesTarget(ruler.id)); });
  rename('Blast');
  expect(selectLockedRulers(store.getState())[0]).toEqual({ ...ruler, name: 'Blast' });
  expect(store.getState().encounter.past).toHaveLength(1);
  act(() => store.dispatch(undoEncounterChange()));
  expect(store.getState().encounter.present).toEqual(encounter);
  act(() => store.dispatch(redoEncounterChange()));
  expect(selectLockedRulers(store.getState())[0].name).toBe('Blast');
});

it('joins an editing ruler rename to the draft and commits once on locking', () => {
  const ruler = setup();
  act(() => store.dispatch(editLockedRuler(ruler.id)));
  rename('Pending');
  expect(selectLockedRulers(store.getState())).toEqual([ruler]);
  expect(store.getState().interaction.editingRuler?.name).toBe('Pending');
  expect(store.getState().encounter.past).toHaveLength(1);
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(selectLockedRulers(store.getState())).toEqual([ruler]);
  act(() => store.dispatch(editLockedRuler(ruler.id)));
  rename('Committed');
  act(() => store.dispatch(lockRulerDraft()));
  expect(selectLockedRulers(store.getState())[0].name).toBe('Committed');
  expect(store.getState().encounter.past).toHaveLength(2);
  act(() => store.dispatch(undoEncounterChange()));
  expect(selectLockedRulers(store.getState())).toEqual([ruler]);
  act(() => store.dispatch(redoEncounterChange()));
  expect(selectLockedRulers(store.getState())[0].name).toBe('Committed');
});

it('cancels modal typing and yields shortcuts to the name input', () => {
  const ruler = setup();
  fireEvent.keyDown(window, { key: 'n' });
  const dialog = within(screen.getByRole('dialog', { name: 'Name ruler' }));
  const input = dialog.getByRole('textbox', { name: 'Ruler name' });
  fireEvent.change(input, { target: { value: 'Discard' } });
  fireEvent.keyDown(input, { key: 't' });
  expect(store.getState().interaction.activeToolId).toBe('ruler');
  fireEvent.keyDown(input, { key: 'Escape' });
  expect(screen.queryByRole('dialog', { name: 'Name ruler' })).not.toBeInTheDocument();
  expect(selectLockedRulers(store.getState())).toEqual([ruler]);
  expect(store.getState().encounter.past).toHaveLength(1);
});

it.each(['fresh', 'legacy'] as const)('activates R/T/B and reserves N for rename with %s preferences', source => {
  if (source === 'legacy') localStorage.setItem(KEYBIND_STORAGE_KEY, JSON.stringify({ ...DEFAULT_KEYBINDS, 'tool.ruler': 'd', 'actor.rename': 'r', 'tool.annotation': 'n' }));
  renderApp();
  fireEvent.keyDown(window, { key: 'n' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  for (const [key, tool] of [['r', 'ruler'], ['t', 'annotation'], ['b', 'background'], ['a', 'actor'], ['m', 'audio'], ['e', 'edge'], ['v', 'select'], ['z', 'zone']]) {
    fireEvent.keyDown(window, { key });
    expect(store.getState().interaction.activeToolId).toBe(tool);
  }
});

it('honors a saved Ruler shortcut override', () => {
  localStorage.setItem(KEYBIND_STORAGE_KEY, JSON.stringify({ 'tool.ruler': 'j' }));
  renderApp();
  act(() => store.dispatch(setActiveTool('select')));
  fireEvent.keyDown(window, { key: 'r' });
  expect(store.getState().interaction.activeToolId).toBe('select');
  fireEvent.keyDown(window, { key: 'j' });
  expect(store.getState().interaction.activeToolId).toBe('ruler');
});

it('upgrades persisted old defaults so N renames and R activates Ruler with a target present', () => {
  localStorage.setItem(KEYBIND_STORAGE_KEY, JSON.stringify({ ...DEFAULT_KEYBINDS, 'tool.ruler': 'd', 'actor.rename': 'r', 'tool.annotation': 'n' }));
  setup(); rename('Migrated');
  expect(selectLockedRulers(store.getState())[0].name).toBe('Migrated');
  act(() => store.dispatch(setActiveTool('select')));
  fireEvent.keyDown(window, { key: 'r' });
  expect(store.getState().interaction.activeToolId).toBe('ruler');
  expect(screen.queryByRole('dialog', { name: 'Name ruler' })).not.toBeInTheDocument();
});
