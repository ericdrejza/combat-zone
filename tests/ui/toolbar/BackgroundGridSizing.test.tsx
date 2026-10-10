import { resolveGridGeometry } from '@core/movement/gridScale';
import { act, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { createActor } from '@entities/actor/actorMutations';
import { completeGridEdges } from '@core/movement/gridEdgeCompletion';
import { getGridCoverage } from '@core/movement/gridCoverage';
import { loadEncounterState } from '@store/encounterSlice';
import { store } from '@store/store';
import { renderApp } from '@tests/ui/renderApp';
import { getBackgroundFitCanvasSize } from '@ui/toolbar/background/backgroundSizing';

it.each(['grid', 'free'] as const)('sizes background coverage independently of the padded %s canvas through every control', async movementStrategy => {
  const user = userEvent.setup(); renderApp();
  const viewport = screen.getByLabelText('Canvas viewport');
  Object.defineProperties(viewport, { clientWidth: { configurable: true, value: 600 }, clientHeight: { configurable: true, value: 400 } });
  fireEvent(window, new Event('resize'));
  let state = createActor(createEncounterState({ id: 'grid-sizing', name: 'Grid sizing' }), { id: 'a', currentZoneId: 'zoneless' });
  state.movementStrategy = movementStrategy; state.grid.cellSize = 100; state.grid.visible = true;
  state.canvasSize = { width: 610, height: 410 };
  state.backgroundImage = { source: { kind: 'url', url: 'https://example.com/grid.png' }, name: 'Grid', width: 610, height: 410, mediaType: 'image/png' };
  state.actors.byId.a.spatialPosition = { x: 160, y: 160 };
  state = completeGridEdges(state);
  act(() => store.dispatch(loadEncounterState(state)));
  await user.click(screen.getByRole('button', { name: 'Background' }));
  await user.click(screen.getByRole('button', { name: 'Expand' }));
  expect(getGridCoverage(store.getState().encounter.present)).toMatchObject({ width: 671, height: 451 });
  expect(store.getState().encounter.present.canvasSize).toEqual({ width: 704, height: 512 });
  await user.click(screen.getByRole('button', { name: 'Shrink' }));
  expect(getGridCoverage(store.getState().encounter.present)).toMatchObject({ width: 604, height: 406 });
  for (const [name, mode] of [['Fit', 'fit'], ['Fit width', 'fit-width'], ['Fit height', 'fit-height']] as const) {
    const zoom = Number(viewport.getAttribute('data-canvas-zoom'));
    const expected = getBackgroundFitCanvasSize(state.backgroundImage!, { width: 600 / zoom, height: 400 / zoom }, mode);
    const before = store.getState().encounter.present, beforeCoverage = getGridCoverage(before);
    await user.click(screen.getByRole('radio', { name }));
    expect(getGridCoverage(store.getState().encounter.present)).toMatchObject(expected);
    expect(screen.getByRole('radio', { name })).toHaveAttribute('aria-checked', 'true');
    expect(resolveGridGeometry(store.getState().encounter.present.grid)).toEqual(resolveGridGeometry(state.grid));
    expect(store.getState().encounter.present.grid.cellSize).toBeCloseTo(before.grid.cellSize / Math.min(expected.width / beforeCoverage.width, expected.height / beforeCoverage.height));
    expect(store.getState().encounter.present.actors.byId.a.spatialPosition).toEqual({ x: 160, y: 160 });
  }
});
