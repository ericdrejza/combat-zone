import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '@tests/ui/renderApp';
import { createActor } from '@entities/actor/actorMutations';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { commitEncounterChange, undoEncounterChange, redoEncounterChange } from '@store/encounterSlice';
import { selectEntity, setActiveTool } from '@interaction/interactionState';
import { store } from '@store/store';
import { setPersistenceWritable } from '@store/persistenceWriteGuardMiddleware';

function mockPopup() {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const popup = frame.contentWindow!;
  const close = vi.spyOn(popup, 'close').mockImplementation(() => {});
  const focus = vi.spyOn(popup, 'focus').mockImplementation(() => {});
  const open = vi.spyOn(window, 'open').mockReturnValue(popup);
  return { popup, close, open, focus };
}

function selectActor(mode: 'ADVISORY' | 'STRICT' = 'ADVISORY') {
  const state = createActor(store.getState().encounter.present, { id: 'a', name: 'Alpha', currentZoneId: 'zoneless' });
  state.validationState = { ...state.validationState, mode };
  state.actors.byId.a.hitPoints = { current: 10, maximum: 20 };
  act(() => {
    store.dispatch(commitEncounterChange({ action: createEncounterActionRecord('test.seed'), nextEncounter: state }));
    store.dispatch(setActiveTool('select'));
    store.dispatch(selectEntity({ entityType: 'actor', ids: ['a'] }));
  });
}

function openStatus(popup: Window) {
  fireEvent.click(screen.getByRole('button', { name: 'Open Status window' }));
  return popup.document.getElementById('status-root')!;
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  setPersistenceWritable(true);
  vi.restoreAllMocks();
  document.querySelectorAll('iframe').forEach((frame) => frame.remove());
});

it('opens Status from its header, focuses the existing window, and closes independently', () => {
  const { popup, open, focus, close } = mockPopup();
  renderApp();
  const root = openStatus(popup);
  expect(open).toHaveBeenCalledWith('', 'combat-zone-status', expect.stringContaining('popup'));
  expect(popup.document.title).toBe('Combat Zone Status');
  fireEvent.click(screen.getByRole('button', { name: 'Focus Status window' }));
  expect(focus).toHaveBeenCalledOnce();
  expect(open).toHaveBeenCalledOnce();
  expect(popup.document.getElementById('status-root')).toBe(root);
  expect(screen.getByRole('button', { name: 'Open Initiative window' })).toBeInTheDocument();
  fireEvent.click(within(root).getByRole('button', { name: 'Close Status window' }));
  expect(close).toHaveBeenCalledOnce();
  expect(screen.getByRole('button', { name: 'Open Status window' })).toHaveAttribute('aria-pressed', 'false');
});

it.each(['ADVISORY', 'STRICT'] as const)('shares selection, status edits, undo/redo and writer enforcement in %s mode', async (mode) => {
  const { popup } = mockPopup();
  renderApp();
  selectActor(mode);
  const root = openStatus(popup);
  const remote = within(root);
  expect(remote.getByLabelText('Selected actor names')).toHaveTextContent('Alpha');
  const before = store.getState().encounter.present;
  fireEvent.click(remote.getByRole('button', { name: 'Stunned' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Stunned' })).toHaveAttribute('aria-pressed', 'true'));
  const after = store.getState().encounter.present;
  act(() => store.dispatch(undoEncounterChange()));
  expect(store.getState().encounter.present).toEqual(before);
  expect(remote.getByRole('button', { name: 'Stunned' })).toHaveAttribute('aria-pressed', 'false');
  act(() => store.dispatch(redoEncounterChange()));
  expect(store.getState().encounter.present).toEqual(after);
  setPersistenceWritable(false);
  fireEvent.click(remote.getByRole('button', { name: 'Shield' }));
  await act(async () => {});
  expect(store.getState().encounter.present).toBe(after);
  act(() => store.dispatch(selectEntity({ entityType: 'actor', ids: [] })));
  expect(remote.queryByLabelText('Actor status')).not.toBeInTheDocument();
  expect(remote.getByLabelText('Encounter status')).toBeInTheDocument();
});

it('uses the popup document for resource-dialog focus and Movement stepping', async () => {
  const { popup } = mockPopup();
  renderApp();
  selectActor();
  const root = openStatus(popup);
  const remote = within(root);
  const edit = remote.getByRole('button', { name: 'Edit Hit points' });
  edit.focus();
  fireEvent.click(edit);
  const dialog = remote.getByRole('dialog', { name: 'Edit hit points' });
  const controls = Array.from(dialog.querySelectorAll<HTMLElement>('input:not(:disabled), select:not(:disabled), button:not(:disabled), [tabindex="0"]'));
  expect(popup.document.activeElement).toBe(controls[0]);
  controls[controls.length - 1]!.focus();
  fireEvent.keyDown(controls[controls.length - 1]!, { key: 'Tab' });
  expect(popup.document.activeElement).toBe(controls[0]);
  fireEvent.keyDown(controls[0], { key: 'Tab', shiftKey: true });
  expect(popup.document.activeElement).toBe(controls[controls.length - 1]);
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  expect(popup.document.activeElement).toBe(edit);
  const movement = remote.getByRole('spinbutton', { name: 'Movement limit' });
  fireEvent.change(movement, { target: { value: '12.5' } });
  movement.focus();
  fireEvent.click(remote.getByRole('button', { name: 'Increase movement limit' }));
  await waitFor(() => expect(store.getState().encounter.present.actors.byId.a.movementLimit).toBe(15));
  expect(remote.getByRole('spinbutton', { name: 'Movement limit' })).not.toBe(popup.document.activeElement);
});

it('shows touch-hold help in the popup document', () => {
  const { popup } = mockPopup();
  renderApp();
  selectActor();
  const root = openStatus(popup);
  vi.useFakeTimers();
  fireEvent(within(root).getByRole('button', { name: 'Shield' }), new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 1, pointerType: 'touch' }));
  act(() => vi.advanceTimersByTime(500));
  expect(within(popup.document.body).getByRole('tooltip')).toHaveTextContent('Shield');
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});

it('recovers after manual closure and closes with the parent application', () => {
  const { popup, close, open } = mockPopup();
  const app = renderApp();
  openStatus(popup);
  act(() => popup.dispatchEvent(new Event('beforeunload')));
  expect(screen.getByRole('button', { name: 'Open Status window' })).toBeInTheDocument();
  openStatus(popup);
  expect(open).toHaveBeenCalledTimes(2);
  app.unmount();
  expect(close).toHaveBeenCalledOnce();
});

it('reports popup blocking without changing encounter data', () => {
  vi.spyOn(window, 'open').mockReturnValue(null);
  const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
  renderApp();
  const before = store.getState().encounter.present;
  fireEvent.click(screen.getByRole('button', { name: 'Open Status window' }));
  expect(alert).toHaveBeenCalledWith(expect.stringContaining('popup was blocked'));
  expect(screen.getByRole('button', { name: 'Open Status window' })).toHaveAttribute('aria-pressed', 'false');
  expect(store.getState().encounter.present).toBe(before);
});
