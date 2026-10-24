import { movementRulesFor } from '@tests/core/movement/ruleFixtures';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderApp, getCanvas, mockCanvasBounds } from '@tests/ui/renderApp';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { createActor } from '@entities/actor/actorMutations';
import { createZone } from '@entities/zone/zoneMutations';
import { loadEncounterState, undoEncounterChange, redoEncounterChange } from '@store/encounterSlice';
import { store } from '@store/store';
import { selectEntity, setActiveTool } from '@interaction/interactionState';
import { dataTransfer, dropOnCanvas } from '@tests/ui/panels/zoneless_actors/ZonelessActorPanel.test_support';
import { ZONELESS_ACTOR_DRAG_TYPE } from '@ui/panels/zoneless_actors/zonelessActorDrag';
import { ACTOR_CREATION_DRAG_TYPE } from '@ui/toolbar/actor/actorCreationDrag';

function setup(strategy: 'grid' | 'free' = 'grid') {
  renderApp();
  let state = createZone(createEncounterState({ id: 'spatial', name: 'Spatial' }), { id: 'z', polygon: [{ x: 10, y: 10 }, { x: 500, y: 10 }, { x: 500, y: 500 }, { x: 10, y: 500 }] });
  state = createActor(state, { id: 'a', name: 'Alpha', currentZoneId: 'z' });
  state = createActor(state, { id: 'b', name: 'Bravo', currentZoneId: 'z', size: 'large' });
  state = createActor(state, { id: 'c', name: 'Charlie', currentZoneId: 'zoneless' });
  state.movementRules = movementRulesFor(strategy); state.grid.visible = true;
  state.actors.byId.a.spatialPosition = { x: 160, y: 160 };
  state.actors.byId.b.spatialPosition = { x: 320, y: 320 };
  act(() => { store.dispatch(loadEncounterState(state)); store.dispatch(setActiveTool('actor')); });
  mockCanvasBounds(getCanvas());
  return state;
}
const drag = (dx: number, dy: number, target: HTMLElement = getCanvas()) => {
  fireEvent.mouseDown(screen.getByLabelText('Alpha'), { button: 0, clientX: 160, clientY: 160 });
  fireEvent.mouseMove(getCanvas(), { clientX: 160 + dx, clientY: 160 + dy });
  fireEvent.mouseUp(target, { clientX: 160 + dx, clientY: 160 + dy });
};

describe('spatial actor canvas workflows', () => {
  it.each(['OFF', 'ADVISORY', 'STRICT'] as const)('removes pivots with right-click and continues dragging with one undoable %s commit', async mode => {
    const initial = setup('free');
    const state = { ...initial, validationState: { ...initial.validationState, mode } };
    act(() => { store.dispatch(loadEncounterState(state)); store.dispatch(setActiveTool('actor')); });
    const canvas = getCanvas();
    fireEvent.mouseDown(screen.getByLabelText('Alpha'), { button: 0, clientX: 160, clientY: 160 });
    fireEvent.mouseMove(canvas, { clientX: 200, clientY: 160 });
    fireEvent.keyDown(window, { key: 'Shift' });
    fireEvent.mouseMove(canvas, { clientX: 200, clientY: 220 });
    fireEvent.keyDown(window, { code: 'Space' });
    for (let i = 0; i < 3; i++) {
      fireEvent.mouseDown(canvas, { button: 2, buttons: 3, clientX: 200, clientY: 220 });
      fireEvent.contextMenu(canvas, { button: 2, clientX: 200, clientY: 220 });
      fireEvent.mouseUp(canvas, { button: 2, buttons: 1, clientX: 200, clientY: 220 });
      expect(screen.getByLabelText('Actor movement preview')).toBeInTheDocument();
      expect(store.getState().encounter.present).toEqual(state);
      expect(store.getState().encounter.past).toHaveLength(0);
    }
    fireEvent.mouseMove(canvas, { clientX: 250, clientY: 260 });
    fireEvent.keyDown(window, { key: 'Shift' });
    fireEvent.mouseMove(canvas, { clientX: 280, clientY: 260 });
    fireEvent.mouseUp(canvas, { button: 0, clientX: 280, clientY: 260 });
    await waitFor(() => expect(store.getState().encounter.present.actors.byId.a.spatialPosition).toEqual({ x: 280, y: 260 }));
    expect(store.getState().encounter.past).toHaveLength(1);
    const moved = store.getState().encounter.present;
    act(() => store.dispatch(undoEncounterChange()));
    expect(store.getState().encounter.present).toEqual(state);
    act(() => store.dispatch(redoEncounterChange()));
    expect(store.getState().encounter.present).toEqual(moved);
  });

  it('retains the first pointer movement when drag start and movement arrive before a React render', async () => {
    setup('free');
    const canvas = getCanvas();
    act(() => {
      fireEvent.mouseDown(screen.getByLabelText('Alpha'), { button: 0, clientX: 160, clientY: 160 });
      fireEvent.mouseMove(canvas, { clientX: 200, clientY: 180 });
    });
    fireEvent.keyDown(window, { key: 'Shift' });
    fireEvent.keyUp(window, { key: 'Shift' });
    fireEvent.mouseUp(canvas, { clientX: 200, clientY: 180 });
    await waitFor(() => expect(store.getState().encounter.present.actors.byId.a.spatialPosition).toEqual({ x: 200, y: 180 }));
    expect(store.getState().encounter.past).toHaveLength(1);
  });

  it('moves a mixed-size group with one offset and commit, with exact undo/redo', async () => {
    const state = setup();
    act(() => store.dispatch(selectEntity({ entityType: 'actor', ids: ['a', 'b', 'c'] })));
    drag(70, 0);
    await waitFor(() => expect(store.getState().encounter.present.actors.byId.a.spatialPosition).toEqual({ x: 224, y: 160 }));
    expect(store.getState().encounter.present.actors.byId.b.spatialPosition).toEqual({ x: 384, y: 320 });
    expect(store.getState().encounter.present.actors.byId.c.spatialPosition).toBeUndefined();
    expect(store.getState().encounter.past).toHaveLength(1);
    act(() => store.dispatch(undoEncounterChange())); expect(store.getState().encounter.present).toEqual(state);
    act(() => store.dispatch(redoEncounterChange())); expect(store.getState().encounter.present.actors.byId.b.spatialPosition).toEqual({ x: 384, y: 320 });
  });
  it('moves freely and rejects out-of-bounds group drops atomically', async () => {
    setup('free'); drag(23, 17);
    await waitFor(() => expect(store.getState().encounter.present.actors.byId.a.spatialPosition).toEqual({ x: 183, y: 177 }));
    act(() => store.dispatch(selectEntity({ entityType: 'actor', ids: ['a', 'b'] })));
    const before = store.getState().encounter.present;
    drag(-250, 0);
    await waitFor(() => expect(store.getState().encounterLog.entries.some(entry => entry.actionType === 'actor.moveSpatial' && entry.kind === 'validation-block')).toBe(true));
    expect(store.getState().encounter.present).toBe(before);
  });
  it('moves canvas actors into the panel and clears their Zone assignment', async () => {
    setup();
    drag(100, 100, screen.getByRole('complementary', { name: 'Zoneless actors' }));
    await waitFor(() => expect(store.getState().encounter.present.actors.byId.a.spatialPosition).toBeUndefined());
    expect(store.getState().encounter.present.actors.byId.a.currentZoneId).toBe('zoneless');
    const transfer = dataTransfer(); transfer.setData(ZONELESS_ACTOR_DRAG_TYPE, 'a');
    dropOnCanvas(getCanvas(), transfer, 200, 200);
    await waitFor(() => expect(store.getState().encounter.present.actors.byId.a.spatialPosition).toEqual({ x: 224, y: 224 }));
    expect(store.getState().encounter.present.actors.byId.a.currentZoneId).toBe('z');
  });
  it('creates and snaps a new actor on a canvas without any target Zone', async () => {
    setup();
    const transfer = dataTransfer(); transfer.setData(ACTOR_CREATION_DRAG_TYPE, JSON.stringify({ name: 'New', shape: 'circle', size: 'medium', layoutGroup: 'hero' }));
    dropOnCanvas(getCanvas(), transfer, 700, 400);
    await waitFor(() => expect(store.getState().encounter.present.actors.allIds).toHaveLength(4));
    const actor = Object.values(store.getState().encounter.present.actors.byId).find(a => a.name === 'New')!;
    expect(actor.currentZoneId).toBe('zoneless'); expect(actor.spatialPosition).toEqual({ x: 672, y: 416 });
  });
});
