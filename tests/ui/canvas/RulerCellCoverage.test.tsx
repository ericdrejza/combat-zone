import { act, fireEvent, render, screen } from '@testing-library/react';
import { renderApp, getCanvas, mockCanvasBounds } from '@tests/ui/renderApp';
import { store } from '@store/store';
import { loadEncounterState } from '@store/encounterSlice';
import { setActiveTool } from '@interaction/interactionState';
import { RulerSettings } from '@ui/settings/RulerSettings';
import { CANVAS_PREFERENCES_KEY } from '@ui/canvas_preferences/canvasPreferenceStorage';

afterEach(() => localStorage.removeItem(CANVAS_PREFERENCES_KEY));
it('updates saved-artifact highlighting and area labels from all coverage settings without editing the encounter', () => {
  renderApp(); mockCanvasBounds(getCanvas());
  act(() => {
    const state = store.getState().encounter.present;
    store.dispatch(loadEncounterState({ ...state, movementRules: { ...state.movementRules, snapToGrid: true } }));
    store.dispatch(setActiveTool('ruler'));
  });
  fireEvent.click(screen.getByRole('button', { name: 'Cone ruler' }));
  const angle = screen.getByRole('spinbutton', { name: 'Cone angle' });
  fireEvent.change(angle, { target: { value: '10' } }); fireEvent.blur(angle);
  const surface = screen.getByLabelText('Ruler drawing surface');
  fireEvent.pointerDown(surface, { button: 0, pointerId: 1, clientX: 160, clientY: 160 });
  fireEvent.pointerDown(surface, { button: 0, pointerId: 1, clientX: 320, clientY: 160 });
  fireEvent.keyDown(window, { key: ' ', code: 'Space' });
  render(<RulerSettings />);
  const select = screen.getByRole('combobox', { name: 'Measurement cell coverage' });
  const saved = store.getState().encounter.present, outline = document.querySelector('[data-ruler-id] polyline')!.getAttribute('points');
  expect(select).toHaveValue('corners-or-center');
  fireEvent.click(screen.getByRole('switch', { name: 'Show calculated ruler area' }));
  for (const [value, cells] of [['center', 2], ['majority', 0], ['corners-and-origin', 1], ['corners-and-adjacent', 1], ['corners-or-center', 2]] as const) {
    fireEvent.change(select, { target: { value } });
    expect(document.querySelectorAll('[data-ruler-id] polygon')).toHaveLength(cells);
    expect(screen.getByLabelText('Measurement result')).toHaveTextContent(`${cells * 25} ft²`);
    expect(document.querySelector('[data-ruler-id] polyline')).toHaveAttribute('points', outline);
    expect(JSON.parse(localStorage.getItem(CANVAS_PREFERENCES_KEY)!)).toMatchObject({ rulerCellCoverage: value });
    expect(store.getState().encounter.present).toBe(saved);
    expect(store.getState().encounter.past).toHaveLength(1);
  }
});
