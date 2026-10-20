import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderApp } from '@tests/ui/renderApp';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { store } from '@store/store';
import { loadEncounterState, undoEncounterChange, redoEncounterChange } from '@store/encounterSlice';
import { setActiveTool } from '@interaction/interactionState';

it('commits every grid style without moving actors or resizing the canvas and supports exact history', async () => {
  renderApp(); const initial = createEncounterState({ id: 'styles', name: 'Styles' });
  act(() => { store.dispatch(loadEncounterState(initial)); store.dispatch(setActiveTool('grid')); });
  for (const style of ['dashed', 'dotted', 'crosshair', 'solid']) {
    fireEvent.change(screen.getByRole('combobox', { name: 'Grid line style' }), { target: { value: style } });
    await waitFor(() => expect(store.getState().encounter.present.grid.lineStyle).toBe(style));
  }
  expect(store.getState().encounter.present.canvasSize).toEqual(initial.canvasSize);
  expect(store.getState().encounter.present.actors).toEqual(initial.actors);
  const final = store.getState().encounter.present;
  act(() => store.dispatch(undoEncounterChange())); expect(store.getState().encounter.present.grid.lineStyle).toBe('crosshair');
  act(() => store.dispatch(redoEncounterChange())); expect(store.getState().encounter.present).toEqual(final);
});
