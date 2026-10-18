import { act, fireEvent, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ActorStatusValidator } from '@entities/actor/actorStatusValidator';
import { createActor } from '@entities/actor/actorMutations';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import * as runtime from '@core/validation/runtimeEncounterChange';
import type { PreparedValidatedEncounterChange } from '@core/validation/validatedEncounterChange';
import { commitEncounterChange, undoEncounterChange, redoEncounterChange } from '@store/encounterSlice';
import { store } from '@store/store';
import { useZoneActorTranslation } from '@ui/canvas/useZoneActorTranslation';
import { transformZoneActorPoint } from '@ui/canvas/actors/actorPlacementTranslation';
import { createRectangleZone, getCanvas, mockCanvasBounds, renderApp, selectZoneTool } from '@tests/ui/renderApp';

async function setup() {
  const user = userEvent.setup(); renderApp(); const canvas = getCanvas(); mockCanvasBounds(canvas);
  await selectZoneTool(user); createRectangleZone(canvas); const zone = await screen.findByLabelText('Zone 1');
  const id = zone.getAttribute('data-entity-id')!;
  act(() => store.dispatch(commitEncounterChange({ action: createEncounterActionRecord('test.seedActor'),
    nextEncounter: createActor(store.getState().encounter.present, { id: 'actor', name: 'Moving Actor', currentZoneId: id }) })));
  fireEvent.mouseDown(zone, { button: 0, clientX: 100, clientY: 100 });
  fireEvent.mouseMove(canvas, { clientX: 140, clientY: 120 }); fireEvent.mouseUp(canvas);
  const moved = store.getState().encounter.present.zones.byId[id].polygon;
  return { canvas, zone, id, moved, history: store.getState().encounter.past.length };
}

function deferResize() {
  const prepare = runtime.prepareValidatedEncounterChangeForRuntime;
  let release!: () => Promise<void>;
  vi.spyOn(runtime, 'prepareValidatedEncounterChangeForRuntime').mockImplementation(input => {
    const prepared = prepare(input);
    if (input.action.type !== 'zone.reshape') return prepared;
    return new Promise<PreparedValidatedEncounterChange>(resolve => { release = async () => resolve(await prepared); });
  });
  return () => release();
}

describe('move, resize, move ownership', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([true, false])('retains the resized shape when validation resolves %s before the next release', async resolveBeforeRelease => {
    const { canvas, zone, id, moved, history } = await setup();
    const release = deferResize();
    fireEvent.mouseDown(screen.getByLabelText('Zone 1 vertex 2'), { button: 0, clientX: 220, clientY: 100 });
    fireEvent.mouseMove(canvas, { clientX: 280, clientY: 80 }); fireEvent.mouseUp(canvas);
    const resized = [{ x: 120, y: 80 }, { x: 280, y: 80 }, { x: 280, y: 180 }, { x: 120, y: 180 }];
    fireEvent.mouseDown(zone, { button: 0, clientX: 150, clientY: 120 });
    fireEvent.mouseMove(canvas, { clientX: 190, clientY: 150 });
    if (resolveBeforeRelease) await act(release);
    fireEvent.mouseUp(canvas);
    if (!resolveBeforeRelease) await act(release);
    await waitFor(() => expect(store.getState().encounter.past).toHaveLength(history + 2));
    const final = resized.map(p => ({ x: p.x + 40, y: p.y + 30 }));
    expect(store.getState().encounter.present.zones.byId[id].polygon).toEqual(final);
    expect(store.getState().encounter.present.actors.byId.actor.currentZoneId).toBe(id);
    act(() => store.dispatch(undoEncounterChange()));
    expect(store.getState().encounter.present.zones.byId[id].polygon).toEqual(resized);
    act(() => store.dispatch(undoEncounterChange()));
    expect(store.getState().encounter.present.zones.byId[id].polygon).toEqual(moved);
    act(() => { store.dispatch(redoEncounterChange()); store.dispatch(redoEncounterChange()); });
    expect(store.getState().encounter.present.zones.byId[id].polygon).toEqual(final);
  });

  it('orders consecutive pending resizes before the following move', async () => {
    const { canvas, zone, id, history } = await setup();
    const release = deferResize();
    fireEvent.mouseDown(screen.getByLabelText('Zone 1 vertex 2'), { button: 0, clientX: 220, clientY: 100 });
    fireEvent.mouseMove(canvas, { clientX: 280, clientY: 80 }); fireEvent.mouseUp(canvas);
    fireEvent.mouseDown(screen.getByLabelText('Zone 1 vertex 2'), { button: 0, clientX: 280, clientY: 80 });
    fireEvent.mouseMove(canvas, { clientX: 300, clientY: 60 }); fireEvent.mouseUp(canvas);
    fireEvent.mouseDown(zone, { button: 0, clientX: 150, clientY: 120 });
    fireEvent.mouseMove(canvas, { clientX: 190, clientY: 150 }); fireEvent.mouseUp(canvas);
    await act(release);
    expect(store.getState().encounter.past).toHaveLength(history + 1);
    await act(release);
    await waitFor(() => expect(store.getState().encounter.past).toHaveLength(history + 3));
    expect(store.getState().encounter.present.zones.byId[id].polygon).toEqual([
      { x: 160, y: 90 }, { x: 340, y: 90 }, { x: 340, y: 210 }, { x: 160, y: 210 }
    ]);
  });

  it('returns an invalid follow-up move to the accepted resized geometry', async () => {
    const { canvas, zone, id, history } = await setup();
    const release = deferResize();
    fireEvent.mouseDown(screen.getByLabelText('Zone 1 vertex 2'), { button: 0, clientX: 220, clientY: 100 });
    fireEvent.mouseMove(canvas, { clientX: 280, clientY: 80 }); fireEvent.mouseUp(canvas);
    fireEvent.mouseDown(zone, { button: 0, clientX: 150, clientY: 120 });
    fireEvent.mouseMove(canvas, { clientX: -200, clientY: -200 }); fireEvent.mouseUp(canvas);
    await act(release);
    await waitFor(() => expect(store.getState().encounter.past).toHaveLength(history + 1));
    expect(store.getState().encounter.present.zones.byId[id].polygon).toEqual([
      { x: 120, y: 80 }, { x: 280, y: 80 }, { x: 280, y: 180 }, { x: 120, y: 180 }
    ]);
  });

  it.each([['STRICT', true], ['ADVISORY', false]] as const)('preserves %s validation when a move follows a pending resize', async (mode, blocked) => {
    const { canvas, zone, id, moved } = await setup();
    act(() => {
      const encounter = store.getState().encounter.present;
      store.dispatch(commitEncounterChange({ action: createEncounterActionRecord('test.validationMode'), nextEncounter: {
        ...encounter, validationState: { ...encounter.validationState, mode }
      } }));
    });
    const history = store.getState().encounter.past.length;
    const validate = ActorStatusValidator.validate;
    vi.spyOn(ActorStatusValidator, 'validate').mockImplementation((action, context) => action.type === 'zone.reshape'
      ? { valid: false, messages: [{ code: 'test.resizePolicy', message: 'Resize policy violation', severity: 'error' }] }
      : validate(action, context));
    const release = deferResize();
    fireEvent.mouseDown(screen.getByLabelText('Zone 1 vertex 2'), { button: 0, clientX: 220, clientY: 100 });
    fireEvent.mouseMove(canvas, { clientX: 280, clientY: 80 }); fireEvent.mouseUp(canvas);
    fireEvent.mouseDown(zone, { button: 0, clientX: 150, clientY: 120 });
    fireEvent.mouseMove(canvas, { clientX: 190, clientY: 150 }); fireEvent.mouseUp(canvas);
    await act(release);
    await waitFor(() => expect(store.getState().encounter.past).toHaveLength(history + (blocked ? 1 : 2)));
    const base = blocked ? moved : [{ x: 120, y: 80 }, { x: 280, y: 80 }, { x: 280, y: 180 }, { x: 120, y: 180 }];
    expect(store.getState().encounter.present.zones.byId[id].polygon).toEqual(base.map(p => ({ x: p.x + 40, y: p.y + 30 })));
  });

  it('combines the pending resize and new movement in the Actor preview', async () => {
    const { id, moved } = await setup();
    const encounter = store.getState().encounter.present;
    const resized = [{ x: 120, y: 80 }, { x: 280, y: 80 }, { x: 280, y: 180 }, { x: 120, y: 180 }];
    const { result } = renderHook(() => useZoneActorTranslation(encounter, {
      zoneId: id, sourcePolygon: moved, originalPolygon: resized, start: { x: 0, y: 0 }, current: { x: 40, y: 30 }, hasMoved: true, phase: 'dragging'
    }));
    expect(transformZoneActorPoint({ x: 170, y: 140 }, id, result.current)).toEqual({ x: 240, y: 160 });
  });
});
