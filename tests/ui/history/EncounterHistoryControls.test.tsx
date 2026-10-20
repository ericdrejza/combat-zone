import { selectLockedRulers } from '@interaction/rulerState';
import { setRulerDraft, lockRulerDraft } from '@interaction/interactionState';
import { setPersistenceWritable } from '@store/persistenceWriteGuardMiddleware';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useContext, type ReactNode } from 'react';
import { Provider } from 'react-redux';
import { beginEncounterOperation } from '@core/history/encounterOperations';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { commitEncounterChange } from '@store/encounterSlice';
import { store } from '@store/store';
import { resetAppStore } from '@tests/ui/renderApp';
import { EncounterHistoryControls } from '@ui/history/EncounterHistoryControls';
import { EncounterHistoryKeyboard } from '@ui/history/EncounterHistoryKeyboard';
import { useEncounterOperation } from '@ui/history/useEncounterOperation';
import { KeybindProvider, KEYBIND_STORAGE_KEY } from '@ui/keybinds/KeybindProvider';
import { PersistenceContext } from '@ui/persistence/PersistenceContext';

beforeEach(() => { resetAppStore(); localStorage.removeItem(KEYBIND_STORAGE_KEY); });
afterEach(() => { localStorage.removeItem(KEYBIND_STORAGE_KEY); setPersistenceWritable(true); });
function ReadOnly({ children }: { children: ReactNode }) {
  const current = useContext(PersistenceContext);
  return <PersistenceContext.Provider value={{ ...current, readOnly: true }}>{children}</PersistenceContext.Provider>;
}
function mount(readOnly = false) {
  const content = <><EncounterHistoryControls /><EncounterHistoryKeyboard /><input aria-label="Name" /><div contentEditable aria-label="Notes" /></>;
  return render(<Provider store={store}><KeybindProvider>{readOnly ? <ReadOnly>{content}</ReadOnly> : content}</KeybindProvider></Provider>);
}
function rename(name: string) {
  act(() => { store.dispatch(commitEncounterChange({ action: createEncounterActionRecord('encounter.rename'), nextEncounter: { ...store.getState().encounter.present, name } })); });
}
it('reflects available snapshots and replays exact state with buttons', () => {
  mount();
  const before = store.getState().encounter.present;
  expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled();
  rename('Changed');
  const after = store.getState().encounter.present;
  fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
  expect(store.getState().encounter.present).toEqual(before);
  expect(screen.getByRole('button', { name: 'Redo' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Redo' }));
  expect(store.getState().encounter.present).toEqual(after);
  expect(screen.getByRole('button', { name: 'Undo' })).toHaveAttribute('title', 'Undo (Ctrl/Cmd + Z)');
});
it('supports Ctrl/Cmd chords, ignores repeats, and preserves native editing and modal workflows', () => {
  mount(); rename('First'); rename('Second');
  fireEvent.keyDown(window, { key: 'z', ctrlKey: true, repeat: true });
  expect(store.getState().encounter.present.name).toBe('Second');
  fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
  expect(store.getState().encounter.present.name).toBe('First');
  fireEvent.keyDown(window, { key: 'z', metaKey: true, shiftKey: true });
  expect(store.getState().encounter.present.name).toBe('Second');
  const event = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true });
  screen.getByRole('textbox', { name: 'Name' }).dispatchEvent(event);
  expect(event.defaultPrevented).toBe(false);
  fireEvent.keyDown(screen.getByLabelText('Notes'), { key: 'z', ctrlKey: true });
  const dialog = document.createElement('div'); dialog.setAttribute('aria-modal', 'true'); document.body.append(dialog);
  fireEvent.keyDown(window, { key: 'z', metaKey: true }); dialog.remove();
  expect(store.getState().encounter.present.name).toBe('Second');
});
it('uses persisted custom bindings', () => {
  localStorage.setItem(KEYBIND_STORAGE_KEY, JSON.stringify({ 'history.undo': 'alt+u', 'history.redo': 'alt+y' }));
  mount(); rename('Changed');
  fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
  expect(store.getState().encounter.present.name).toBe('Changed');
  fireEvent.keyDown(window, { key: 'u', altKey: true });
  fireEvent.keyDown(window, { key: 'y', altKey: true });
  expect(store.getState().encounter.present.name).toBe('Changed');
  expect(screen.getByRole('button', { name: 'Undo' })).toHaveAttribute('title', 'Undo (Alt + U)');
});
it('disables controls and shortcuts while busy or read-only', () => {
  const view = mount(); rename('Changed');
  let release!: () => void; act(() => { release = beginEncounterOperation(); });
  expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
  expect(store.getState().encounter.present.name).toBe('Changed');
  act(() => release());
  expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
  view.unmount(); mount(true);
  expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
  expect(store.getState().encounter.present.name).toBe('Changed');
});
it('releases a local draft on cancellation or unmount', () => {
  function Draft({ active }: { active: boolean }) { useEncounterOperation(active); return null; }
  const view = render(<Provider store={store}><EncounterHistoryControls /><Draft active /></Provider>);
  rename('Changed');
  expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  view.rerender(<Provider store={store}><EncounterHistoryControls /><Draft active={false} /></Provider>);
  expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
  view.rerender(<Provider store={store}><EncounterHistoryControls /><Draft active /></Provider>);
  view.unmount(); mount();
  expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
});

it('blocks native transfers until drop or cancellation', () => {
  mount(); rename('Changed');
  fireEvent.dragStart(screen.getByRole('textbox', { name: 'Name' }));
  expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  fireEvent.drop(window);
  expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
  fireEvent.dragStart(window); fireEvent.dragEnd(window);
  expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
});

it('blocks persisted ruler replay in read-only mode', () => {
  mount(true);
  act(() => {
    store.dispatch(setRulerDraft({ points: [{ x: 100, y: 100 }, { x: 200, y: 200 }], complete: true }));
    store.dispatch(lockRulerDraft());
    setPersistenceWritable(false);
  });
  const present = store.getState().encounter.present, artifact = selectLockedRulers(store.getState())[0];
  expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
  expect(selectLockedRulers(store.getState())).toEqual([artifact]);
  expect(store.getState().encounter.present).toBe(present);
});
