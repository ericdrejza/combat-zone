import { createEncounterState } from '@core/encounter/createEncounterState';
import { abbreviateDistanceUnit, formatDistance } from '@core/measurement/distanceUnits';
import { movementReachOutlines } from '@core/measurement/movementReach';
import { gridLineCenters } from '@core/measurement/gridLine';
import type { Actor } from '@entities/actor/types';

it.each([['millimeters', 'mm'], ['centimetres', 'cm'], ['meters', 'm'], ['kilometers', 'km'], ['inches', 'in'], ['feet', 'ft'], ['yards', 'yd'], ['miles', 'mi'], ['squares', 'squares']])('abbreviates %s as %s', (unit, abbreviation) => {
  expect(abbreviateDistanceUnit(unit)).toBe(abbreviation);
});
it('formats distance without spelling out units', () => expect(formatDistance(12.3456, 'feet')).toBe('12.35 ft'));
it('repeats the same reduced-slope grid line pattern from start to target', () => {
  const state = createEncounterState({ id: 'map', name: 'Map' });
  const points = gridLineCenters(state.grid, { x: 32, y: 32 }, { x: 416, y: 160 });
  expect(points).toHaveLength(7);
  const steps = points.slice(1).map((p, i) => ({ x: p.x - points[i].x, y: p.y - points[i].y }));
  expect(steps.slice(0, 3)).toEqual(steps.slice(3));
  expect(points.at(-1)).toEqual({ x: 416, y: 160 });
});
it('uses whole reachable cells for snapping and a radius otherwise', () => {
  const state = createEncounterState({ id: 'map', name: 'Map' });
  state.movementRules.zoneLocked = false; state.movementRules.snapToGrid = true;
  const actor = { size: 'medium', spatialPosition: { x: 224, y: 224 } } as Actor;
  const one = movementReachOutlines(state, actor, 5, 'one').flat();
  expect(Math.min(...one.map(p => p.x))).toBe(128);
  expect(Math.max(...one.map(p => p.x))).toBe(320);
  const disabled = movementReachOutlines(state, actor, 5, 'disabled').flat();
  // A diagonal corner cell is reachable with one-cost diagonals, but not disabled diagonals.
  expect(disabled).not.toEqual(one);
  state.movementRules.snapToGrid = false;
  const circle = movementReachOutlines(state, actor, 5, 'one').flat();
  expect(Math.max(...circle.map(p => p.x))).toBe(288);
  expect(Math.min(...circle.map(p => p.x))).toBe(160);
  expect(movementReachOutlines(state, actor, 0, 'one').flat().every(p => p.x === 224 && p.y === 224)).toBe(true);
});
