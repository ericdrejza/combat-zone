import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { createZone } from '@entities/zone/zoneMutations';
import { rotatePoint } from '@entities/zone/zoneRotation';
import { selectEntity, setActiveTool } from '@interaction/interactionState';
import { loadEncounterState, undoEncounterChange, redoEncounterChange } from '@store/encounterSlice';
import { store } from '@store/store';
import { getCanvas, mockCanvasBounds, renderApp } from '@tests/ui/renderApp';
import * as runtimeValidation from '@core/validation/runtimeEncounterChange';
import { prepareValidatedEncounterChange } from '@core/validation/validatedEncounterChange';

afterEach(() => vi.restoreAllMocks());

const polygon = [{ x: 200, y: 200 }, { x: 400, y: 200 }, { x: 400, y: 300 }, { x: 200, y: 300 }];
function setup() {
  renderApp();
  const state = createZone(createEncounterState({ id: 'rotation', name: 'Rotation' }), { id: 'z', name: 'Room', shape: 'rectangle', polygon });
  act(() => {
    store.dispatch(loadEncounterState(state));
    store.dispatch(setActiveTool('zone'));
    store.dispatch(selectEntity({ entityType: 'zone', ids: ['z'] }));
  });
  mockCanvasBounds(getCanvas());
  return { state, handle: screen.getByRole('button', { name: 'Rotate Room' }) };
}
function begin(handle: HTMLElement) {
  fireEvent.pointerDown(handle, { button: 0, pointerId: 1, pointerType: 'mouse', clientX: 300, clientY: 168 });
}
function move(handle: HTMLElement) {
  fireEvent.pointerMove(handle, { pointerId: 1, pointerType: 'mouse', clientX: 382, clientY: 250 });
}
function release(handle: HTMLElement) {
  fireEvent.pointerUp(handle, { pointerId: 1, pointerType: 'mouse', clientX: 382, clientY: 250 });
}

it('previews rotation and commits one action with exact undo and redo', async () => {
  const { state, handle } = setup();
  expect(screen.queryByLabelText('Zone rotation')).toBeNull();
  begin(handle);
  expect(screen.getByLabelText('Zone rotation')).toHaveTextContent('0°');
  move(handle);
  expect(screen.getByLabelText('Zone rotation')).toHaveTextContent('90°');
  expect(store.getState().encounter.present).toEqual(state);
  release(handle);
  await waitFor(() => expect(store.getState().encounter.past).toHaveLength(1));
  const next = store.getState().encounter.present;
  expect(next.zones.byId.z.rotation).toBeCloseTo(90);
  next.zones.byId.z.polygon.forEach((point, i) => {
    const expected = rotatePoint(polygon[i], 90, { x: 300, y: 250 });
    expect(point.x).toBeCloseTo(expected.x); expect(point.y).toBeCloseTo(expected.y);
  });
  act(() => store.dispatch(undoEncounterChange()));
  expect(store.getState().encounter.present).toEqual(state);
  act(() => store.dispatch(redoEncounterChange()));
  expect(store.getState().encounter.present).toEqual(next);
});

it.each(['Escape', 'pointercancel', 'lostpointercapture'])('cancels on %s without history', reason => {
  const { state, handle } = setup();
  begin(handle); move(handle);
  if (reason === 'Escape') fireEvent.keyDown(window, { key: 'Escape' });
  else fireEvent(handle, new PointerEvent(reason, { pointerId: 1, bubbles: true }));
  release(handle);
  expect(store.getState().encounter.present).toEqual(state);
  expect(store.getState().encounter.past).toHaveLength(0);
  expect(screen.queryByLabelText('Zone rotation')).toBeNull();
});

it('shows handles only with Zone tool selection and does not record an unchanged gesture', () => {
  const { handle } = setup();
  begin(handle); release(handle);
  expect(store.getState().encounter.past).toHaveLength(0);
  act(() => store.dispatch(setActiveTool('select')));
  expect(screen.queryByRole('button', { name: 'Rotate Room' })).toBeNull();
});

it.each(['STRICT', 'ADVISORY'] as const)('honors %s validation', async mode => {
  const { state, handle } = setup();
  act(() => store.dispatch(loadEncounterState({ ...state, validationState: { ...state.validationState, mode } })));
  vi.spyOn(runtimeValidation, 'prepareValidatedEncounterChangeForRuntime').mockImplementation(input =>
    prepareValidatedEncounterChange({ ...input, validators: [{ id: 'rotation.constraint', validate: () => ({ valid: false,
      messages: [{ code: 'rotation.constraint', severity: 'error', message: 'Rotation constraint' }] }) }] }));
  begin(handle); move(handle); release(handle);
  await waitFor(() => expect(screen.queryByLabelText('Zone rotation')?.textContent ?? '').toBe(mode === 'STRICT' ? '' : '90°'));
  expect(store.getState().encounter.past).toHaveLength(mode === 'STRICT' ? 0 : 1);
});

it('blocks pointer rotation at the writer boundary', async () => {
  const { setPersistenceWritable } = await import('@store/persistenceWriteGuardMiddleware');
  const { state, handle } = setup();
  setPersistenceWritable(false);
  try {
    begin(handle); move(handle); release(handle);
    expect(store.getState().encounter.present).toEqual(state);
    expect(store.getState().encounter.past).toHaveLength(0);
  } finally { setPersistenceWritable(true); }
});

it('uses canvas coordinates at different viewport sizes', async () => {
  const { handle } = setup();
  mockCanvasBounds(getCanvas(), { width: 1920, height: 1280 });
  fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 600, clientY: 336 });
  fireEvent.pointerMove(handle, { pointerId: 1, clientX: 764, clientY: 500 });
  fireEvent.pointerUp(handle, { pointerId: 1 });
  await waitFor(() => expect(store.getState().encounter.present.zones.byId.z.rotation).toBeCloseTo(90));
});

it('cancels an active rotation when the encounter changes', () => {
  const { handle } = setup();
  begin(handle); move(handle);
  const next = createZone(createEncounterState({ id: 'next', name: 'Next' }), { id: 'z', name: 'Room', polygon });
  act(() => store.dispatch(loadEncounterState(next)));
  release(handle);
  expect(store.getState().encounter.present).toEqual(next);
  expect(store.getState().encounter.past).toHaveLength(0);
});

it('orders a follow-up move after a released rotation awaiting validation', async () => {
  const { handle } = setup();
  const prepare = runtimeValidation.prepareValidatedEncounterChangeForRuntime;
  let resolve!: () => Promise<void>;
  vi.spyOn(runtimeValidation, 'prepareValidatedEncounterChangeForRuntime').mockImplementation(input => {
    const prepared = prepare(input);
    if (input.action.payload.rotation === undefined) return prepared;
    return new Promise<Awaited<typeof prepared>>(done => { resolve = async () => done(await prepared); });
  });
  begin(handle); move(handle); release(handle);
  await waitFor(() => expect(resolve).toBeDefined());
  fireEvent.mouseDown(screen.getByLabelText('Room'), { button: 0, clientX: 300, clientY: 250 });
  fireEvent.mouseMove(getCanvas(), { clientX: 340, clientY: 280 });
  fireEvent.mouseUp(getCanvas());
  await act(resolve);
  await waitFor(() => expect(store.getState().encounter.past).toHaveLength(2));
  expect(store.getState().encounter.present.zones.byId.z.rotation).toBeCloseTo(90);
  act(() => store.dispatch(undoEncounterChange()));
  expect(store.getState().encounter.present.zones.byId.z.rotation).toBeCloseTo(90);
  act(() => store.dispatch(undoEncounterChange()));
  expect(store.getState().encounter.present.zones.byId.z.rotation).toBe(0);
});

it('rejects rotation into a neighboring zone without changing history', () => {
  const { state, handle } = setup();
  const withNeighbor = createZone(state, { id: 'neighbor', polygon: [
    { x: 260, y: 160 }, { x: 330, y: 160 }, { x: 330, y: 190 }, { x: 260, y: 190 }
  ] });
  act(() => store.dispatch(loadEncounterState(withNeighbor)));
  begin(handle); move(handle); release(handle);
  expect(store.getState().encounter.present).toEqual(withNeighbor);
  expect(store.getState().encounter.past).toHaveLength(0);
});

it('leaves unlocked actors stationary and reevaluates membership atomically', async () => {
  const { createActor } = await import('@entities/actor/actorMutations');
  const { state, handle } = setup();
  const unlocked = createActor({ ...state, movementRules: { ...state.movementRules, zoneLocked: false } }, { id: 'a', currentZoneId: 'z' });
  unlocked.actors.byId.a.spatialPosition = { x: 220, y: 250 };
  act(() => store.dispatch(loadEncounterState(unlocked)));
  begin(handle); move(handle); release(handle);
  await waitFor(() => expect(store.getState().encounter.past).toHaveLength(1));
  expect(store.getState().encounter.present.actors.byId.a).toMatchObject({ spatialPosition: { x: 220, y: 250 }, currentZoneId: 'zoneless' });
  act(() => store.dispatch(undoEncounterChange()));
  expect(store.getState().encounter.present).toEqual(unlocked);
});

it.each([false, true])('moves the rotation stem with the dragged zone when vertex snapping is %s', async snapping => {
  const { reconcileZoneVertices } = await import('@core/movement/zoneVertexSnapping');
  const { state, handle } = setup();
  if (snapping) {
    const snapped = reconcileZoneVertices({ ...state, movementRules: { ...state.movementRules, snapZoneVertices: true } });
    act(() => store.dispatch(loadEncounterState(snapped)));
  }
  const stem = handle.closest('[data-zone-rotation-handle]')!.querySelector('line')!;
  const attributes = ['x1', 'x2', 'y1', 'y2'];
  const before = attributes.map(name => Number(stem.getAttribute(name)));
  const zone = screen.getByLabelText('Room');
  fireEvent.mouseDown(zone, { button: 0, clientX: 300, clientY: 250 });
  fireEvent.mouseMove(getCanvas(), { clientX: 340, clientY: 280 });
  attributes.forEach((name, index) => {
    expect(Number(stem.getAttribute(name))).toBeCloseTo(before[index] + (name.startsWith('x') ? 40 : 30));
  });
  expect(Number(handle.getAttribute('cx'))).toBeCloseTo((before[1] + 40));
  expect(Number(handle.getAttribute('cy'))).toBeCloseTo((before[3] + 30));
  fireEvent.mouseUp(getCanvas());
});
