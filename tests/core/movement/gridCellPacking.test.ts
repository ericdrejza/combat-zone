import { assignGridCells } from '@core/movement/gridCellPacking';
import { packGridZone } from '@core/movement/gridZonePacking';
import { actorAnchorCells, anchorKey } from '@core/movement/gridTopology';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { createZone } from '@entities/zone/zoneMutations';
import { createActor } from '@entities/actor/actorMutations';
import { SpatialValidator } from '@core/movement/spatialValidator';
import { changeMovementRules } from '@core/movement/changeMovementRules';
import { createEncounterHistoryState } from '@core/history/types';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import reducer, { commitEncounterChange, undoEncounterChange, redoEncounterChange } from '@store/encounterSlice';

it('backtracks across entire cell sets when the preferred multi-cell placement blocks another actor', () => {
  const preferred = { x: 1, y: 1 }, alternative = { x: 2, y: 2 };
  const result = assignGridCells([
    [{ point: preferred, cells: ['a', 'b'] }, { point: alternative, cells: ['c', 'd'] }],
    [{ point: { x: 3, y: 3 }, cells: ['b', 'e'] }, { point: { x: 4, y: 4 }, cells: ['b', 'f'] }]
  ]);
  expect(result?.get(0)).toEqual(alternative);
  expect(result?.get(1)).toEqual({ x: 3, y: 3 });
});

it.each(['square', 'hex-flat', 'hex-pointy'] as const)('reserves every Large/xLarge cell in rotated %s Zones', type => {
  let state = createZone(createEncounterState({ id: type, name: type }), {
    id: 'z', polygon: [{ x: 0, y: 0 }, { x: 768, y: 0 }, { x: 768, y: 576 }, { x: 0, y: 576 }]
  });
  state.grid = { ...state.grid, type, rotation: 17 };
  for (const [index, size] of ['xLarge', 'large', 'large', 'medium', 'small'].entries()) {
    state = createActor(state, { id: `${index}`, size: size as 'xLarge' | 'large' | 'medium' | 'small', currentZoneId: 'z' });
  }
  const next = changeMovementRules(state, { snapToGrid: true }, {});
  expect(next.actors.allIds.every(id => next.actors.byId[id].currentZoneId === 'z')).toBe(true);
  const result = packGridZone(next, 'z');
  expect(result.fits).toBe(true);
  const occupied = new Set<string>();
  for (const placement of result.placements) {
    const cells = actorAnchorCells(next, placement.point, next.actors.byId[placement.actorId].size);
    expect(cells.length).toBeGreaterThan(0);
    for (const cell of cells) { const key = anchorKey(cell.center); expect(occupied.has(key)).toBe(false); occupied.add(key); }
  }
  let history = reducer(createEncounterHistoryState(state), commitEncounterChange({ action: createEncounterActionRecord('movement.updateRules'), nextEncounter: next }));
  history = reducer(history, undoEncounterChange()); expect(history.present).toEqual(state);
  history = reducer(history, redoEncounterChange()); expect(history.present).toEqual(next);
});

it.each(['ADVISORY', 'STRICT'] as const)('rejects insufficient cell capacity in %s', mode => {
  let state = createZone(createEncounterState({ id: mode, name: mode }), { id: 'z', polygon: [
    { x: 0, y: 0 }, { x: 192, y: 0 }, { x: 192, y: 192 }, { x: 0, y: 192 }
  ] });
  state = createActor(state, { id: 'big', size: 'xLarge', currentZoneId: 'z' });
  state = createActor(state, { id: 'large', size: 'large', currentZoneId: 'z' });
  state.movementRules.snapToGrid = true;
  state.validationState.mode = mode;
  expect(packGridZone(state, 'z').fits).toBe(false);
  expect(SpatialValidator.validate({ type: 'actor.move', payload: {} }, { state, mode }).messages)
    .toEqual(expect.arrayContaining([expect.objectContaining({ code: 'layout.gridZoneNoSpace' })]));
});
