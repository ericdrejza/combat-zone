import { act, fireEvent, screen, waitFor } from '@testing-library/react';

import { createEncounterState } from '@core/encounter/createEncounterState';
import { createZone } from '@entities/zone/zoneMutations';
import { setActiveTool } from '@interaction/interactionState';
import { loadEncounterState } from '@store/encounterSlice';
import { store } from '@store/store';
import { getCanvas, mockCanvasBounds, renderApp } from '@tests/ui/renderApp';
import * as canvasMotion from '@ui/canvas/canvasMotion';
import * as motionPreference from '@ui/motion_preferences/MotionPreferenceProvider';
import * as runtimeValidation from '@core/validation/runtimeEncounterChange';
import type { PreparedValidatedEncounterChange } from '@core/validation/validatedEncounterChange';
import { handleZoneMouseUp } from '@ui/canvas/handlers/zoneMouseUp';
import type { MouseUpHandlerInput } from '@ui/canvas/handlers/mouseUpTypes';

it.each([false, true])('releases Zone drop movement to the actor transition (reduced motion: %s)', async animationsDisabled => {
  vi.spyOn(motionPreference, 'useMotionPreference').mockReturnValue({
    animationsDisabled,
    enableAnimations: () => undefined,
    systemPrefersReducedMotion: animationsDisabled
  });
  const transition = vi.spyOn(canvasMotion, 'getCanvasTransition');
  renderApp();
  let state = createEncounterState({ id: 'zone-drop', name: 'Drop' });
  state.movementRules.snapZoneVertices = true;
  state = createZone(state, { id: 'z', name: 'Moving Zone', polygon: [
    { x: 64, y: 64 }, { x: 192, y: 64 },
    { x: 192, y: 192 }, { x: 64, y: 192 }
  ] });
  act(() => {
    store.dispatch(loadEncounterState(state));
    store.dispatch(setActiveTool('zone'));
  });
  const canvas = getCanvas();
  mockCanvasBounds(canvas);
  transition.mockClear();
  fireEvent.mouseDown(screen.getByLabelText('Moving Zone'), {
    button: 0, clientX: 96, clientY: 96
  });
  fireEvent.mouseMove(canvas, { clientX: 146, clientY: 146 });
  expect(transition).toHaveBeenLastCalledWith(true, animationsDisabled);
  expect(transition.mock.results.at(-1)?.value).toBe(canvasMotion.DIRECT_MANIPULATION_TRANSITION);

  transition.mockClear();
  fireEvent.mouseUp(canvas);
  await waitFor(() => expect(store.getState().encounter.past).toHaveLength(1));
  expect(transition).toHaveBeenLastCalledWith(false, animationsDisabled);
  expect(transition.mock.results.at(-1)?.value).toBe(animationsDisabled
    ? canvasMotion.DIRECT_MANIPULATION_TRANSITION
    : canvasMotion.CANVAS_SPRING_TRANSITION);
  expect(store.getState().encounter.present.zones.byId.z.polygon).toEqual(
    state.zones.byId.z.polygon.map(point => ({ x: point.x + 64, y: point.y + 64 }))
  );
});

it('previews the snap target without committing before asynchronous validation accepts it', async () => {
  renderApp();
  const state = createZone(createEncounterState({ id: 'async-drop', name: 'Async' }), {
    id: 'z', polygon: [{ x: 64, y: 64 }, { x: 192, y: 64 }, { x: 192, y: 192 }, { x: 64, y: 192 }]
  });
  act(() => store.dispatch(loadEncounterState(state)));
  const polygon = state.zones.byId.z.polygon.map(point => ({ x: point.x + 64, y: point.y }));
  const prepare = runtimeValidation.prepareValidatedEncounterChangeForRuntime;
  let release!: (value: PreparedValidatedEncounterChange) => void;
  const pending = new Promise<PreparedValidatedEncounterChange>(resolve => { release = resolve; });
  let result!: ReturnType<typeof prepare>;
  vi.spyOn(runtimeValidation, 'prepareValidatedEncounterChangeForRuntime').mockImplementation(input => {
    result = prepare(input);
    return pending;
  });
  const setZoneDrag = vi.fn();
  const zoneDrag = {
    zoneId: 'z', originalPolygon: state.zones.byId.z.polygon,
    start: { x: 0, y: 0 }, current: { x: 50, y: 0 }, hasMoved: true, phase: 'dragging' as const
  };
  act(() => handleZoneMouseUp({
    encounter: state, dispatch: store.dispatch, zoneDrag, zoneGestureRevisionRef: { current: 0 },
    getDisplayedPolygon: () => polygon, setZoneDrag, actorRenderPlacements: []
  } as unknown as MouseUpHandlerInput));
  expect(setZoneDrag).toHaveBeenCalledWith({ ...zoneDrag, phase: 'validating', previewPolygon: polygon });
  expect(store.getState().encounter.past).toHaveLength(0);
  await act(async () => { release(await result); await pending; });
  expect(setZoneDrag).toHaveBeenLastCalledWith(null);
  expect(store.getState().encounter.present.zones.byId.z.polygon).toEqual(polygon);
  expect(store.getState().encounter.past).toHaveLength(1);
});

it('clears a drop that snaps back to its origin without waiting for animation completion', () => {
  const state = createZone(createEncounterState({ id: 'no-op-drop', name: 'Test' }), {
    id: 'z', polygon: [{ x: 64, y: 64 }, { x: 192, y: 64 }, { x: 192, y: 192 }, { x: 64, y: 192 }]
  });
  const setZoneDrag = vi.fn();
  handleZoneMouseUp({ encounter: state, zoneGestureRevisionRef: { current: 1 }, setZoneDrag,
    zoneDrag: { zoneId: 'z', originalPolygon: state.zones.byId.z.polygon, phase: 'dragging', hasMoved: true,
      start: { x: 0, y: 0 }, current: { x: 3, y: 0 } },
    getDisplayedPolygon: () => state.zones.byId.z.polygon
  } as unknown as MouseUpHandlerInput);
  expect(setZoneDrag).toHaveBeenCalledWith(null);
});

afterEach(() => vi.restoreAllMocks());
