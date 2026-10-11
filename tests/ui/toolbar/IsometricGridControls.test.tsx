import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { setActiveTool } from '@interaction/interactionState';
import { loadEncounterState, undoEncounterChange, redoEncounterChange } from '@store/encounterSlice';
import { store } from '@store/store';
import { getCanvas, mockCanvasBounds, renderApp } from '@tests/ui/renderApp';
import { setPersistenceWritable } from '@store/persistenceWriteGuardMiddleware';

function setup() {
  renderApp();
  const state = createEncounterState({ id: 'iso-controls', name: 'Iso controls' });
  state.grid.visible = true;
  act(() => { store.dispatch(loadEncounterState(state)); store.dispatch(setActiveTool('grid')); });
  mockCanvasBounds(getCanvas());
  return state;
}

it('changes Properties type immediately and restores it through history', async () => {
  const state = setup();
  fireEvent.change(screen.getByRole('combobox', { name: 'Grid type' }), { target: { value: 'isometric' } });
  await waitFor(() => expect(store.getState().encounter.present.grid.type).toBe('isometric'));
  const changed = store.getState().encounter.present;
  expect(store.getState().encounter.past).toHaveLength(1);
  expect(screen.getByLabelText('Grid overlay')).toBeInTheDocument();
  act(() => store.dispatch(undoEncounterChange())); expect(store.getState().encounter.present).toEqual(state);
  act(() => store.dispatch(redoEncounterChange())); expect(store.getState().encounter.present).toEqual(changed);
});

it('requires Apply in Settings and discards a cancelled isometric draft', async () => {
  const state = setup();
  fireEvent.click(screen.getByRole('button', { name: 'Grid settings' }));
  let dialog = within(screen.getByRole('dialog', { name: 'Grid settings' }));
  fireEvent.change(dialog.getByRole('combobox', { name: 'Grid type' }), { target: { value: 'isometric' } });
  expect(store.getState().encounter.present).toEqual(state);
  fireEvent.click(dialog.getByRole('button', { name: 'Cancel' }));
  expect(store.getState().interaction.gridPreview).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Grid settings' }));
  dialog = within(screen.getByRole('dialog', { name: 'Grid settings' }));
  fireEvent.change(dialog.getByRole('combobox', { name: 'Grid type' }), { target: { value: 'isometric' } });
  fireEvent.click(dialog.getByRole('button', { name: 'Apply' }));
  await waitFor(() => expect(store.getState().encounter.present.grid.type).toBe('isometric'));
  expect(store.getState().encounter.past).toHaveLength(1);
});

it('places Isometric last in alignment and collects four vertices before applying', async () => {
  const state = setup();
  fireEvent.click(screen.getByRole('button', { name: 'Align grid to background' }));
  const types = within(screen.getByRole('group', { name: 'Alignment grid type' })).getAllByRole('button');
  expect(types.map(button => button.textContent)).toEqual(['Square', 'Hex flat', 'Hex pointy', 'Isometric']);
  fireEvent.click(types.at(-1)!);
  const canvas = getCanvas();
  for (const [x, y] of [[128, 96], [160, 112], [128, 128]]) fireEvent.click(canvas, { clientX: x, clientY: y });
  expect(screen.getByRole('button', { name: 'Apply alignment' })).toBeDisabled();
  fireEvent.click(canvas, { clientX: 96, clientY: 112 });
  expect(screen.getByRole('button', { name: 'Apply alignment' })).toBeEnabled();
  expect(store.getState().encounter.present).toEqual(state);
  fireEvent.click(screen.getByRole('button', { name: 'Apply alignment' }));
  await waitFor(() => expect(store.getState().interaction.gridCalibrationActive).toBe(false));
  expect(store.getState().encounter.present.grid.type).toBe('isometric');
  expect(store.getState().encounter.past).toHaveLength(1);
});

it('blocks isometric changes at the read-only boundary', async () => {
  const state = setup();
  act(() => setPersistenceWritable(false));
  fireEvent.change(screen.getByRole('combobox', { name: 'Grid type' }), { target: { value: 'isometric' } });
  await act(async () => {});
  expect(store.getState().encounter.present).toEqual(state);
});

afterEach(() => setPersistenceWritable(true));

it('previews isometric angle, requires Apply, and restores it through undo/redo', async () => {
  setup();
  fireEvent.click(screen.getByRole('button', { name: 'Grid settings' }));
  const dialog = within(screen.getByRole('dialog', { name: 'Grid settings' }));
  fireEvent.change(dialog.getByRole('combobox', { name: 'Grid type' }), { target: { value: 'isometric' } });
  const input = dialog.getByRole('spinbutton', { name: 'Isometric angle (degrees)' });
  fireEvent.change(input, { target: { value: '30' } });
  expect(store.getState().interaction.gridPreview?.isometricAngle).toBe(30);
  expect(store.getState().encounter.present.grid.isometricAngle).toBeUndefined();
  fireEvent.change(input, { target: { value: '46' } });
  expect(dialog.getByRole('button', { name: 'Apply' })).toBeDisabled();
  fireEvent.change(input, { target: { value: '30' } });
  fireEvent.click(dialog.getByRole('button', { name: 'Apply' }));
  await waitFor(() => expect(store.getState().encounter.present.grid.isometricAngle).toBe(30));
  act(() => store.dispatch(undoEncounterChange())); expect(store.getState().encounter.present.grid.isometricAngle).toBeUndefined();
  act(() => store.dispatch(redoEncounterChange())); expect(store.getState().encounter.present.grid.isometricAngle).toBe(30);
});
