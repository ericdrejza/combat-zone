import { createEncounterState } from '@core/encounter/createEncounterState';
import { createActor } from '@entities/actor/actorMutations';
import { preferredGridZonePositions } from '@core/movement/preferredGridZonePositions';
import { canvasAnchors, pointDistance, pointOrder } from '@core/movement/gridTopology';
import { footprintFits } from '@core/movement/gridGeometry';

it.each(['square', 'hex-pointy', 'hex-flat', 'isometric'] as const)('matches exhaustive nearest anchors for translated and rotated %s grids', type => {
  for (const rotation of [0, 17, 90, 225]) {
    for (const size of ['small', 'medium', 'large', 'xLarge'] as const) {
      const state = createActor(createEncounterState({ id: 'nearest', name: 'Nearest' }), { id: 'actor', size, currentZoneId: 'zoneless' });
      state.grid = { ...state.grid, type, rotation, origin: { x: 21, y: -13 } };
      const actor = state.actors.byId.actor;
      for (const goal of [{ x: 384, y: 256 }, { x: 32, y: 32 }]) {
        const fits = (_actor: typeof actor, point: { x: number; y: number }) => footprintFits(point, 90, state.canvasSize);
        const expected = canvasAnchors(state, size).filter(point => fits(actor, point))
          .sort((a, b) => pointDistance(a, goal) - pointDistance(b, goal) || pointOrder(a, b))[0];
        const preferred = preferredGridZonePositions(state, [actor], () => goal, fits);
        if (pointDistance(expected, goal) > 128) expect(preferred).toBeNull();
        else expect(preferred?.get(0)).toEqual(expected);
      }
    }
  }
});

it('defers conflicting choices, distant fitting anchors, and warped grids to the exhaustive solver', () => {
  let state = createActor(createEncounterState({ id: 'fallback', name: 'Fallback' }), { id: 'first', currentZoneId: 'zoneless' });
  state = createActor(state, { id: 'second', currentZoneId: 'zoneless' });
  const actors = state.actors.allIds.map(id => state.actors.byId[id]);
  const goal = () => ({ x: 320, y: 320 });
  expect(preferredGridZonePositions(state, actors, goal, () => true)).toBeNull();
  expect(preferredGridZonePositions(state, actors.slice(0, 1), goal, (_actor, point) => point.x > 800)).toBeNull();
  state.grid.warp = { type: 'bilinear', x: [0, 1, 0, 0], y: [0, 0, 1, 0] };
  expect(preferredGridZonePositions(state, actors.slice(0, 1), goal, () => true)).toBeNull();
});
