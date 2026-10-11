import { createEncounterState } from '@core/encounter/createEncounterState';
import { createZone } from '@entities/zone/zoneMutations';
import { traceCellRoute, validTracedPolygon } from '@core/movement/cellTracer';

it('detects thin obstacles crossing an edge away from its midpoint and takes a valid detour', () => {
  const state = createZone(createEncounterState({ id: 'thin', name: 'Thin' }), { id: 'obstacle', shape: 'polygon', polygon: [{ x: 8, y: 50 }, { x: 60, y: 20 }, { x: 20, y: 78 }] });
  const start = { x: 0, y: 64 }, goal = { x: 64, y: 64 };
  expect(traceCellRoute(state, start, goal, [start], 'reject')).toBeNull();
  const detour = traceCellRoute(state, start, goal, [start], 'detour');
  expect(detour).not.toBeNull();
  expect(detour!.length).toBeGreaterThan(2);
  expect(detour![0]).toEqual(start);
  expect(detour!.at(-1)).toEqual(goal);
});

it('rejects a closing outline with nonadjacent sides touching or doubling back', () => {
  const state = createEncounterState({ id: 'touch', name: 'Touch' });
  expect(validTracedPolygon(state, [{ x: 0, y: 0 }, { x: 128, y: 0 }, { x: 128, y: 128 }, { x: 64, y: 0 }, { x: 0, y: 128 }])).toBe(false);
});
