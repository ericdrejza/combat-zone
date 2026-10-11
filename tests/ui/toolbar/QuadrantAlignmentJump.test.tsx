import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderApp, getCanvas, mockCanvasBounds } from '@tests/ui/renderApp';
import { store } from '@store/store';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { loadEncounterState } from '@store/encounterSlice';
import { addGridCalibrationPoint, removeGridCalibrationPoint } from '@interaction/interactionState';

it.each(['Square', 'Isometric', 'Hex flat'])('jumps to each next %s quadrant without changing zoom, samples, or history', async type => {
  renderApp(); mockCanvasBounds(getCanvas());
  const state = createEncounterState({ id: 'jump', name: 'Jump' });
  act(() => store.dispatch(loadEncounterState(state)));
  const viewport = screen.getByLabelText('Canvas viewport');
  Object.defineProperties(viewport, { clientWidth: { configurable: true, value: 400 }, clientHeight: { configurable: true, value: 300 } });
  fireEvent.click(screen.getByRole('button', { name: 'Grid' }));
  fireEvent.click(screen.getByRole('button', { name: 'Align grid to background' }));
  fireEvent.click(screen.getByRole('button', { name: type }));
  fireEvent.click(screen.getByRole('button', { name: 'Four-quadrant alignment' }));
  fireEvent.click(screen.getByRole('button', { name: 'Temporary maximum zoom' }));
  await waitFor(() => expect(viewport).toHaveAttribute('data-canvas-zoom', '4'));
  // Let the zoom command's scheduled scroll settle before testing navigation.
  await act(async () => { await new Promise(resolve => requestAnimationFrame(resolve)); });
  fireEvent.click(screen.getByRole('button', { name: 'Jump to top left quadrant' }));
  expect(viewport.scrollLeft).toBe(0); expect(viewport.scrollTop).toBe(0);
  const cellPoints = type === 'Hex flat' ? 3 : 4;
  const maxX = state.canvasSize.width * 4 - 400, maxY = state.canvasSize.height * 4 - 300;
  for (const [index, quadrant] of ['top right', 'bottom right', 'bottom left'].entries()) {
    for (let i = 0; i < cellPoints; i++) act(() => store.dispatch(addGridCalibrationPoint({ x: 100 + i * 10, y: 100 + index * 100 })));
    const before = store.getState().interaction.gridCalibrationPoints;
    fireEvent.click(screen.getByRole('button', { name: `Jump to ${quadrant} quadrant` }));
    expect(viewport.scrollLeft).toBe(index === 2 ? 0 : maxX);
    expect(viewport.scrollTop).toBe(index === 0 ? 0 : maxY);
    expect(viewport).toHaveAttribute('data-canvas-zoom', '4');
    expect(store.getState().interaction.gridCalibrationPoints).toEqual(before);
  }
  for (let i = 0; i < cellPoints; i++) act(() => store.dispatch(addGridCalibrationPoint({ x: 100 + i * 10, y: 400 })));
  expect(screen.queryByRole('button', { name: /Jump to/ })).not.toBeInTheDocument();
  act(() => store.dispatch(removeGridCalibrationPoint()));
  expect(screen.getByRole('button', { name: 'Jump to bottom left quadrant' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Reset points' }));
  expect(screen.getByRole('button', { name: 'Jump to top left quadrant' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(viewport).toHaveAttribute('data-canvas-zoom', '1');
  expect(store.getState().encounter.present).toEqual(state);
  expect(store.getState().encounter.past).toHaveLength(0);
});
