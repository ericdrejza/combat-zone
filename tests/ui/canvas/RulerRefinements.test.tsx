import { selectLockedRulers } from '@interaction/rulerState';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderApp, getCanvas, mockCanvasBounds } from '@tests/ui/renderApp';
import { store } from '@store/store';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { createZone } from '@entities/zone/zoneMutations';
import { loadEncounterState, undoEncounterChange, redoEncounterChange } from '@store/encounterSlice';
import { selectEntity, setActiveTool } from '@interaction/interactionState';
import { CANVAS_PREFERENCES_KEY, readCanvasPreferences, saveCanvasPreferences } from '@ui/canvas_preferences/canvasPreferenceStorage';

function setup() {
  renderApp();
  const state = createEncounterState({ id: 'fixes', name: 'Fixes' }); state.movementRules.snapToGrid = true;
  act(() => { store.dispatch(loadEncounterState(state)); store.dispatch(setActiveTool('select')); });
  mockCanvasBounds(getCanvas());
}
const point = (x: number, y: number) => fireEvent.pointerDown(screen.getByLabelText('Ruler drawing surface'), { button: 0, clientX: x, clientY: y, pointerId: 1 });
afterEach(() => localStorage.removeItem(CANVAS_PREFERENCES_KEY));
it('uses D and scoped number shortcuts, yielding to text fields', () => {
  setup(); fireEvent.keyDown(window, { key: 'd' });
  expect(store.getState().interaction.activeToolId).toBe('ruler');
  for (const [key, shape] of [['1', 'path'], ['2', 'circle'], ['3', 'cone'], ['4', 'rectangle'], ['5', 'line']]) {
    fireEvent.keyDown(window, { key }); expect(store.getState().interaction.rulerOptions.shape).toBe(shape);
  }
  const before = readCanvasPreferences().showActorMovementDistance;
  fireEvent.keyDown(window, { key: '9' }); expect(readCanvasPreferences().showActorMovementDistance).toBe(!before);
  point(100, 100); point(200, 200); fireEvent.keyDown(window, { key: ' ', code: 'Space' });
  expect(selectLockedRulers(store.getState())).toHaveLength(1);
  fireEvent.keyDown(window, { key: '0' }); expect(selectLockedRulers(store.getState())).toHaveLength(0);
  fireEvent.keyDown(window, { key: '3' });
  const angle = screen.getByRole('spinbutton', { name: 'Cone angle' });
  fireEvent.keyDown(angle, { key: '1' }); expect(store.getState().interaction.rulerOptions.shape).toBe('cone');
});
it('commits angle drafts on Enter, blurs the field and adjusts the angle with Shift+wheel', () => {
  setup(); fireEvent.keyDown(window, { key: 'd' }); fireEvent.keyDown(window, { key: '3' });
  const angle = screen.getByRole('spinbutton', { name: 'Cone angle' });
  act(() => angle.focus()); fireEvent.change(angle, { target: { value: '45' } });
  expect(store.getState().interaction.rulerOptions.angle).toBeUndefined();
  fireEvent.keyDown(angle, { key: 'Enter' }); expect(angle).not.toHaveFocus();
  expect(store.getState().interaction.rulerOptions.angle).toBe(45);
  point(160, 160); point(352, 160);
  expect(screen.getByLabelText('Measurement result')).toHaveTextContent('45°');
  fireEvent.wheel(screen.getByLabelText('Ruler drawing surface'), { shiftKey: true, deltaY: -100 });
  expect(store.getState().interaction.rulerOptions.angle).toBe(46);
  expect(screen.getByLabelText('Measurement result')).toHaveTextContent('46°');
});
it('hides calculated area by default and responds to the Canvas preference', () => {
  setup(); fireEvent.keyDown(window, { key: 'd' }); fireEvent.keyDown(window, { key: '2' });
  point(128, 128); point(192, 128);
  expect(screen.getByLabelText('Measurement result')).not.toHaveTextContent('ft²');
  act(() => saveCanvasPreferences({ ...readCanvasPreferences(), showRulerArea: true }));
  expect(screen.getByLabelText('Measurement result')).toHaveTextContent('ft²');
  expect(screen.queryByRole('spinbutton', { name: 'Ruler range' })).not.toBeInTheDocument();
});
it.each(['STRICT', 'ADVISORY'] as const)('renames a selected zone with R and preserves exact history in %s', async mode => {
  setup();
  const state = createZone(createEncounterState({ id: 'zone', name: 'Zone rename' }), { id: 'z', name: 'Before', polygon: [{ x: 64, y: 64 }, { x: 320, y: 64 }, { x: 320, y: 320 }, { x: 64, y: 320 }] });
  state.validationState.mode = mode;
  act(() => { store.dispatch(loadEncounterState(state)); store.dispatch(setActiveTool('zone')); store.dispatch(selectEntity({ entityType: 'zone', ids: ['z'] })); });
  expect(screen.getByRole('textbox', { name: 'Zone name' })).toHaveValue('Before');
  fireEvent.keyDown(window, { key: 'r' });
  fireEvent.change(screen.getByRole('textbox', { name: 'New zone name' }), { target: { value: 'After' } });
  fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
  await waitFor(() => expect(store.getState().encounter.present.zones.byId.z.name).toBe('After'));
  expect(screen.getByRole('textbox', { name: 'Zone name' })).toHaveValue('After');
  expect(store.getState().interaction.selection.selectedIds).toEqual(['z']);
  fireEvent.blur(screen.getByRole('textbox', { name: 'Zone name' }));
  expect(store.getState().encounter.past).toHaveLength(1);
  act(() => store.dispatch(undoEncounterChange())); expect(store.getState().encounter.present).toEqual(state);
  expect(screen.getByRole('textbox', { name: 'Zone name' })).toHaveValue('Before');
  act(() => store.dispatch(redoEncounterChange())); expect(store.getState().encounter.present.zones.byId.z.name).toBe('After');
  expect(screen.getByRole('textbox', { name: 'Zone name' })).toHaveValue('After');
});
