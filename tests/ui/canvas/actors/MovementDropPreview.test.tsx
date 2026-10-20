import { act, waitFor } from '@testing-library/react';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { createActor } from '@entities/actor/actorMutations';
import { loadEncounterState } from '@store/encounterSlice';
import { store } from '@store/store';
import { resetAppStore } from '@tests/ui/renderApp';
import { handleSpatialActorMouseUp } from '@ui/canvas/handlers/spatialActorMouseUp';
import type { MouseUpHandlerInput } from '@ui/canvas/handlers/mouseUpTypes';
import type { ActorDragState } from '@ui/canvas/canvasInteractionTypes';

it('ends the movement preview before publishing a successful drop position', async () => {
  resetAppStore();
  const state = createActor(createEncounterState({ id: 'drop', name: 'Drop' }), { id: 'a', currentZoneId: 'zoneless' });
  state.movementRules.zoneLocked = false; state.movementRules.snapToGrid = true;
  state.actors.byId.a.spatialPosition = { x: 160, y: 160 }; state.actors.byId.a.movementLimit = 30;
  store.dispatch(loadEncounterState(state));
  let drag: ActorDragState | null = { actorId: 'a', actorIds: ['a'], start: { x: 160, y: 160 }, current: { x: 224, y: 160 }, phase: 'dragging', hasMoved: true };
  let phaseAtCommit: string | undefined;
  const unsubscribe = store.subscribe(() => { if (store.getState().encounter.present !== state) phaseAtCommit = drag?.phase; });
  act(() => handleSpatialActorMouseUp({ actorDrag: drag, encounter: state, dispatch: store.dispatch, activeToolId: store.getState().interaction.activeToolId,
    setActorDrag: next => { drag = typeof next === 'function' ? next(drag) : next; }
  } as MouseUpHandlerInput));
  await waitFor(() => expect(store.getState().encounter.present.actors.byId.a.spatialPosition).toEqual({ x: 224, y: 160 }));
  unsubscribe(); expect(phaseAtCommit).toBe('validating'); expect(drag?.phase).toBe('returning');
});
