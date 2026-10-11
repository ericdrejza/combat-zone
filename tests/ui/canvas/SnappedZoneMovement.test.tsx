import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { createZone } from '@entities/zone/zoneMutations';
import { translateSnappedZone, zoneSnappingValid } from '@core/movement/zoneVertexSnapping';
import { gridToWorld } from '@core/movement/gridGeometry';
import { resolveGridGeometry } from '@core/movement/gridScale';
import { setActiveTool } from '@interaction/interactionState';
import { store } from '@store/store';
import { loadEncounterState, undoEncounterChange, redoEncounterChange } from '@store/encounterSlice';
import { getCanvas, mockCanvasBounds, renderApp } from '@tests/ui/renderApp';
import { handleZoneMouseUp } from '@ui/canvas/handlers/zoneMouseUp';
import type { MouseUpHandlerInput } from '@ui/canvas/handlers/mouseUpTypes';

it('commits one rigid snapped Zone movement and restores it through history', async () => {
  renderApp();
  let state = createEncounterState({ id: 'rigid', name: 'Rigid' });
  state.movementRules.snapZoneVertices = true;
  state = createZone(state, { id: 'z', name: 'Snapped', shape: 'polygon', polygon: [
    { x: 64, y: 64 }, { x: 192, y: 64 }, { x: 192, y: 128 }, { x: 128, y: 192 }, { x: 64, y: 128 }
  ] });
  act(() => { store.dispatch(loadEncounterState(state)); store.dispatch(setActiveTool('zone')); });
  const canvas = getCanvas(); mockCanvasBounds(canvas);
  fireEvent.mouseDown(screen.getByLabelText('Snapped'), { button: 0, clientX: 96, clientY: 96 });
  fireEvent.mouseMove(canvas, { clientX: 146, clientY: 146 });
  fireEvent.mouseUp(canvas);
  await waitFor(() => expect(store.getState().encounter.past).toHaveLength(1));
  const moved = store.getState().encounter.present;
  expect(moved.zones.byId.z.polygon).toEqual(state.zones.byId.z.polygon.map(point => ({ x: point.x + 64, y: point.y + 64 })));
  act(() => store.dispatch(undoEncounterChange())); expect(store.getState().encounter.present).toEqual(state);
  act(() => store.dispatch(redoEncounterChange())); expect(store.getState().encounter.present).toEqual(moved);
});

it('rejects a rigid warped-grid translation whose other vertices cannot remain snapped', () => {
  renderApp();
  let state = createEncounterState({ id: 'warped-rigid', name: 'Warped' });
  state.grid = { ...state.grid, warp: { type: 'bilinear', x: [0, 1, 0, 0.04], y: [0, 0, 1, 0] } };
  state.movementRules.snapZoneVertices = true;
  const grid = resolveGridGeometry(state.grid);
  state = createZone(state, { id: 'z', shape: 'polygon', polygon: [
    { x: 64, y: 64 }, { x: 192, y: 64 }, { x: 192, y: 192 }, { x: 64, y: 192 }
  ].map(point => gridToWorld(grid, point)) });
  const zone = state.zones.byId.z;
  expect(zoneSnappingValid(state, zone)).toBe(true);
  const polygon = translateSnappedZone(state, zone, { x: 64, y: 0 });
  polygon.forEach((point, i) => {
    expect(point.x - zone.polygon[i].x).toBeCloseTo(polygon[0].x - zone.polygon[0].x, 8);
    expect(point.y - zone.polygon[i].y).toBeCloseTo(polygon[0].y - zone.polygon[0].y, 8);
  });
  expect(zoneSnappingValid(state, { ...zone, polygon })).toBe(false);
  act(() => store.dispatch(loadEncounterState(state)));
  const clearDrag = vi.fn();
  act(() => handleZoneMouseUp({ encounter: state, dispatch: store.dispatch,
    zoneDrag: { zoneId: 'z', originalPolygon: zone.polygon, current: { x: 64, y: 0 }, start: { x: 0, y: 0 }, hasMoved: true, phase: 'dragging' },
    getDisplayedPolygon: () => polygon, setZoneDrag: clearDrag
  } as unknown as MouseUpHandlerInput));
  expect(store.getState().encounter.present).toEqual(state);
  expect(store.getState().encounter.past).toHaveLength(0);
  expect(clearDrag).toHaveBeenCalledWith(null);
});


it('does not add history when a small snapped drag returns to the original lattice position', async () => {
  renderApp();
  let state = createEncounterState({ id: 'small-rigid', name: 'Small' });
  state.movementRules.snapZoneVertices = true;
  state = createZone(state, { id: 'z', name: 'Small snapped', polygon: [
    { x: 64, y: 64 }, { x: 192, y: 64 }, { x: 192, y: 192 }, { x: 64, y: 192 }
  ] });
  act(() => { store.dispatch(loadEncounterState(state)); store.dispatch(setActiveTool('zone')); });
  const canvas = getCanvas(); mockCanvasBounds(canvas);
  fireEvent.mouseDown(screen.getByLabelText('Small snapped'), { button: 0, clientX: 96, clientY: 96 });
  fireEvent.mouseMove(canvas, { clientX: 106, clientY: 106 });
  fireEvent.mouseUp(canvas);
  await act(async () => {});
  expect(store.getState().encounter.present).toEqual(state);
  expect(store.getState().encounter.past).toHaveLength(0);
});
