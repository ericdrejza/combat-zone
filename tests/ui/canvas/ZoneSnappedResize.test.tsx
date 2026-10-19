import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { createZone } from '@entities/zone/zoneMutations';
import { createShapePolygon } from '@entities/zone/zoneShapeGeometry';
import { snapZonePolygon } from '@core/movement/zoneVertexSnapping';
import { zoneBoundsCorners } from '@core/movement/snappedZoneBounds';
import { nearestGridVertex } from '@core/movement/gridTopology';
import { selectEntity, setActiveTool } from '@interaction/interactionState';
import { loadEncounterState, undoEncounterChange, redoEncounterChange } from '@store/encounterSlice';
import { store } from '@store/store';
import { getCanvas, mockCanvasBounds, renderApp } from '@tests/ui/renderApp';
import * as runtimeValidation from '@core/validation/runtimeEncounterChange';
import * as canvasMotion from '@ui/canvas/canvasMotion';

afterEach(() => vi.restoreAllMocks());

it.each(['rectangle', 'circle', 'hexagon'] as const)('resizes %s with four snapped bounds corners and exact undo/redo', async shape => {
  renderApp();
  let state = createZone(createEncounterState({ id: shape, name: shape }), { id: 'z', name: 'Snapped', shape,
    polygon: createShapePolygon(shape, { x: 128, y: 128 }, { x: 384, y: 288 }) });
  state.grid.type = 'isometric';
  state.movementRules.snapZoneVertices = true;
  state.zones.byId.z.polygon = snapZonePolygon(state, state.zones.byId.z);
  act(() => {
    store.dispatch(loadEncounterState(state)); store.dispatch(setActiveTool('zone'));
    store.dispatch(selectEntity({ entityType: 'zone', ids: ['z'] }));
  });
  const canvas = getCanvas(); mockCanvasBounds(canvas);
  const originalCorners = zoneBoundsCorners(state.zones.byId.z);
  const pointer = originalCorners[2];
  const handle = screen.getByLabelText(`Snapped vertex ${shape === 'rectangle' ? 3 : 4}`);
  fireEvent.mouseDown(handle, { button: 0, clientX: pointer.x, clientY: pointer.y });
  // This diagonal lands on a grid vertex, but its independent adjacent corners do not.
  fireEvent.mouseMove(canvas, { clientX: pointer.x + 96, clientY: pointer.y + 48 });
  const preview = screen.getByLabelText('Snapped').getAttribute('points');
  fireEvent.mouseUp(canvas);
  await waitFor(() => expect(store.getState().encounter.past).toHaveLength(1));
  const next = store.getState().encounter.present;
  const corners = zoneBoundsCorners(next.zones.byId.z);
  expect(corners[0].x).toBeCloseTo(originalCorners[0].x);
  expect(corners[0].y).toBeCloseTo(originalCorners[0].y);
  for (const point of corners) {
    const vertex = nearestGridVertex(next, point);
    expect(point.x).toBeCloseTo(vertex.x, 6); expect(point.y).toBeCloseTo(vertex.y, 6);
  }
  expect(corners[0].y).toBeCloseTo(corners[1].y);
  expect(corners[1].x).toBeCloseTo(corners[2].x);
  expect(corners[2].y).toBeCloseTo(corners[3].y);
  expect(corners[3].x).toBeCloseTo(corners[0].x);
  expect(next.zones.byId.z.polygon).not.toEqual(state.zones.byId.z.polygon);
  expect(screen.getByLabelText('Snapped').getAttribute('points')).toBe(preview);
  act(() => store.dispatch(undoEncounterChange())); expect(store.getState().encounter.present).toEqual(state);
  act(() => store.dispatch(redoEncounterChange())); expect(store.getState().encounter.present).toEqual(next);
});

it.each(['STRICT', 'ADVISORY'] as const)('settles to a nearby grid-compatible rotation with exact undo/redo in %s', async mode => {
  renderApp();
  const state = createZone(createEncounterState({ id: mode, name: mode }), { id: 'z', name: 'Snapped', shape: 'rectangle',
    polygon: createShapePolygon('rectangle', { x: 128, y: 128 }, { x: 384, y: 256 }) });
  state.validationState.mode = mode; state.movementRules.snapZoneVertices = true;
  act(() => {
    store.dispatch(loadEncounterState(state)); store.dispatch(setActiveTool('zone'));
    store.dispatch(selectEntity({ entityType: 'zone', ids: ['z'] }));
  });
  mockCanvasBounds(getCanvas());
  const handle = screen.getByRole('button', { name: 'Rotate Snapped' });
  fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 256, clientY: 96 });
  const angle = 31 * Math.PI / 180;
  fireEvent.pointerMove(handle, { pointerId: 1, clientX: 256 + Math.sin(angle) * 96, clientY: 192 - Math.cos(angle) * 96 });
  fireEvent.pointerUp(handle, { pointerId: 1 });
  await waitFor(() => expect(store.getState().encounter.past).toHaveLength(1));
  const next = store.getState().encounter.present;
  const rotation = next.zones.byId.z.rotation!;
  expect(rotation).toBeCloseTo(Math.atan2(1, 2) * 180 / Math.PI);
  expect(screen.getByLabelText('Zone rotation')).toHaveTextContent(`${Math.round(rotation)}°`);
  zoneBoundsCorners(next.zones.byId.z).forEach(point => {
    const snapped = nearestGridVertex(next, point);
    expect(point.x).toBeCloseTo(snapped.x, 6); expect(point.y).toBeCloseTo(snapped.y, 6);
  });
  act(() => store.dispatch(undoEncounterChange())); expect(store.getState().encounter.present).toEqual(state);
  act(() => store.dispatch(redoEncounterChange())); expect(store.getState().encounter.present).toEqual(next);
});

it.each([-45, -44.7])('settles the one-by-three rectangle released at %s degrees with a changed aspect ratio', async degrees => {
  renderApp();
  const state = createZone(createEncounterState({ id: 'diagonal', name: 'Diagonal' }), {
    id: 'z', name: 'Snapped', shape: 'rectangle',
    polygon: createShapePolygon('rectangle', { x: 64, y: 0 }, { x: 128, y: 192 })
  });
  state.movementRules.snapZoneVertices = true;
  act(() => {
    store.dispatch(loadEncounterState(state)); store.dispatch(setActiveTool('zone'));
    store.dispatch(selectEntity({ entityType: 'zone', ids: ['z'] }));
  });
  mockCanvasBounds(getCanvas());
  const handle = screen.getByRole('button', { name: 'Rotate Snapped' });
  fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 96, clientY: -32 });
  const radians = degrees * Math.PI / 180;
  fireEvent.pointerMove(handle, { pointerId: 1, clientX: 96 + 128 * Math.sin(radians), clientY: 96 - 128 * Math.cos(radians) });
  fireEvent.pointerUp(handle, { pointerId: 1 });
  await waitFor(() => expect(store.getState().encounter.past).toHaveLength(1));
  const next = store.getState().encounter.present;
  expect(next.zones.byId.z.rotation).toBeCloseTo(-45);
  const expected = [{ x: 0, y: 64 }, { x: 64, y: 0 }, { x: 192, y: 128 }, { x: 128, y: 192 }];
  next.zones.byId.z.polygon.forEach((point, i) => {
    expect(point.x).toBeCloseTo(expected[i].x, 6);
    expect(point.y).toBeCloseTo(expected[i].y, 6);
  });
  act(() => store.dispatch(undoEncounterChange())); expect(store.getState().encounter.present).toEqual(state);
  act(() => store.dispatch(redoEncounterChange())); expect(store.getState().encounter.present).toEqual(next);
});

it('settles the snapped polygon and handle together while validation is pending', async () => {
  renderApp();
  const state = createZone(createEncounterState({ id: 'pending', name: 'Pending' }), {
    id: 'z', name: 'Snapped', shape: 'rectangle',
    polygon: createShapePolygon('rectangle', { x: 192, y: 128 }, { x: 256, y: 320 })
  });
  state.movementRules.snapZoneVertices = true;
  act(() => {
    store.dispatch(loadEncounterState(state)); store.dispatch(setActiveTool('zone'));
    store.dispatch(selectEntity({ entityType: 'zone', ids: ['z'] }));
  });
  mockCanvasBounds(getCanvas());
  const transition = vi.spyOn(canvasMotion, 'getCanvasTransition');
  const prepare = runtimeValidation.prepareValidatedEncounterChangeForRuntime;
  let release!: () => Promise<void>;
  vi.spyOn(runtimeValidation, 'prepareValidatedEncounterChangeForRuntime').mockImplementation(input => {
    const result = prepare(input);
    return new Promise<Awaited<typeof result>>(resolve => { release = async () => resolve(await result); });
  });
  const handle = screen.getByRole('button', { name: 'Rotate Snapped' });
  fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 224, clientY: 96 });
  const angle = -44.7 * Math.PI / 180;
  fireEvent.pointerMove(handle, { pointerId: 1, clientX: 224 + Math.sin(angle) * 128, clientY: 224 - Math.cos(angle) * 128 });
  expect(transition.mock.calls.at(-1)?.[0]).toBe(true);
  transition.mockClear();
  fireEvent.pointerUp(handle, { pointerId: 1 });
  expect(release).toBeDefined();
  expect(store.getState().encounter.present).toEqual(state);
  expect(screen.getByLabelText('Zone rotation')).toHaveTextContent('-45°');
  // Zone body, resize controls, and rotation handle all leave direct manipulation.
  expect(transition.mock.calls.length).toBeGreaterThanOrEqual(3);
  expect(transition.mock.calls.every(([immediate]) => immediate === false)).toBe(true);
  const preview = screen.getByLabelText('Snapped').getAttribute('points');
  await act(release);
  await waitFor(() => expect(store.getState().encounter.past).toHaveLength(1));
  expect(screen.getByLabelText('Snapped').getAttribute('points')).toBe(preview);
  expect(store.getState().encounter.present.zones.byId.z.rotation).toBeCloseTo(-45);
});

it('uses the snapped angle and outline when moving before rotation validation finishes', async () => {
  renderApp();
  const state = createZone(createEncounterState({ id: 'ordered', name: 'Ordered' }), {
    id: 'z', name: 'Snapped', shape: 'rectangle',
    polygon: createShapePolygon('rectangle', { x: 192, y: 128 }, { x: 256, y: 320 })
  });
  state.movementRules.snapZoneVertices = true;
  act(() => {
    store.dispatch(loadEncounterState(state)); store.dispatch(setActiveTool('zone'));
    store.dispatch(selectEntity({ entityType: 'zone', ids: ['z'] }));
  });
  const canvas = getCanvas(); mockCanvasBounds(canvas);
  const prepare = runtimeValidation.prepareValidatedEncounterChangeForRuntime;
  let release!: () => Promise<void>;
  vi.spyOn(runtimeValidation, 'prepareValidatedEncounterChangeForRuntime').mockImplementation(input => {
    const result = prepare(input);
    if (input.action.payload.rotation === undefined) return result;
    return new Promise<Awaited<typeof result>>(resolve => { release = async () => resolve(await result); });
  });
  const handle = screen.getByRole('button', { name: 'Rotate Snapped' });
  fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 224, clientY: 96 });
  const angle = -44.7 * Math.PI / 180;
  fireEvent.pointerMove(handle, { pointerId: 1, clientX: 224 + Math.sin(angle) * 128, clientY: 224 - Math.cos(angle) * 128 });
  fireEvent.pointerUp(handle, { pointerId: 1 });
  fireEvent.mouseDown(screen.getByLabelText('Snapped'), { button: 0, clientX: 224, clientY: 224 });
  fireEvent.mouseMove(canvas, { clientX: 288, clientY: 224 });
  fireEvent.mouseUp(canvas);
  await act(release);
  await waitFor(() => expect(store.getState().encounter.past).toHaveLength(2));
  const moved = store.getState().encounter.present.zones.byId.z;
  expect(moved.rotation).toBeCloseTo(-45);
  act(() => store.dispatch(undoEncounterChange()));
  const rotated = store.getState().encounter.present.zones.byId.z;
  expect(rotated.rotation).toBeCloseTo(-45);
  moved.polygon.forEach((point, i) => {
    expect(point.x).toBeCloseTo(rotated.polygon[i].x + 64, 6);
    expect(point.y).toBeCloseTo(rotated.polygon[i].y, 6);
  });
  act(() => store.dispatch(undoEncounterChange())); expect(store.getState().encounter.present).toEqual(state);
});
