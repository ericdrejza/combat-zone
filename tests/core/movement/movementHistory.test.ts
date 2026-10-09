import { createEncounterState } from '@core/encounter/createEncounterState';
import { resizeEncounterCanvas } from '@core/encounter/canvasSizeMutations';
import { createActor, deleteActor, duplicateActor, updateActorProperties } from '@entities/actor/actorMutations';
import { createZone } from '@entities/zone/zoneMutations';
import { createEngagement } from '@entities/engagement/engagementMutations';
import { changeMovementStrategy, placeSpatialActors, resnapSpatialActors, stepSpatialActors } from '@core/movement/movementStrategies';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { prepareValidatedEncounterChange } from '@core/validation/validatedEncounterChange';
import { createEncounterHistoryState } from '@core/history/types';
import reducer, { commitEncounterChange, undoEncounterChange, redoEncounterChange } from '@store/encounterSlice';
import { runValidationPipelineSync } from '@core/validation/pipeline';

function encounter() {
  let state = createZone(createEncounterState({ id: 'e', name: 'Map' }), { id: 'z', polygon: [{ x: 50, y: 50 }, { x: 550, y: 50 }, { x: 550, y: 550 }, { x: 50, y: 550 }] });
  state = createActor(state, { id: 'a', currentZoneId: 'z' });
  state = createActor(state, { id: 'b', currentZoneId: 'z', size: 'large' });
  state = createActor(state, { id: 'unplaced', currentZoneId: 'zoneless' });
  return createEngagement(state, { id: 'g', parentZoneId: 'z', participantIds: ['a', 'b'] });
}

describe('spatial history and validation', () => {
  it('preserves suspended relationships and restores every strategy snapshot', () => {
    const zone = encounter();
    const grid = changeMovementStrategy(zone, 'grid', { a: { x: 201, y: 201 }, b: { x: 330, y: 330 } });
    expect(grid.actors.byId.a.spatialPosition).toEqual({ x: 224, y: 224 });
    expect(grid.actors.byId.b.spatialPosition).toEqual({ x: 320, y: 320 });
    expect(grid.actors.byId.unplaced.spatialPosition).toBeUndefined();
    expect(grid.engagements).toEqual(zone.engagements); expect(grid.zones).toEqual(zone.zones);
    const states = [grid, placeSpatialActors(grid, { a: { x: 290, y: 220 }, b: { x: 390, y: 330 } })];
    states.push(changeMovementStrategy(states[1], 'free', {}));
    states.push(placeSpatialActors(states[2], { a: { x: 281, y: 199 } }));
    states.push(changeMovementStrategy(states[3], 'zone', {}));
    let history = createEncounterHistoryState(zone);
    for (const next of states) history = reducer(history, commitEncounterChange({ action: createEncounterActionRecord('test.spatial'), nextEncounter: next }));
    for (let i = states.length - 2; i >= -1; i--) {
      history = reducer(history, undoEncounterChange()); expect(history.present).toEqual(i >= 0 ? states[i] : zone);
    }
    for (const state of states) { history = reducer(history, redoEncounterChange()); expect(history.present).toEqual(state); }
    const again = changeMovementStrategy(states[4], 'free', { a: { x: 100, y: 100 } });
    expect(again.actors.byId.a.spatialPosition).toEqual({ x: 281, y: 199 });
  });
  it.each(['OFF', 'ADVISORY', 'ASSISTED', 'STRICT'] as const)('enforces bounds, permits overlap, and suspends Zone validators in %s', mode => {
    const state = changeMovementStrategy(encounter(), 'grid', {}); state.validationState.mode = mode;
    const next = placeSpatialActors(state, { a: { x: 160, y: 160 }, b: { x: 160, y: 160 } });
    const prepare = (nextEncounter: typeof state) => prepareValidatedEncounterChange({ currentEncounter: state, nextEncounter, action: createEncounterActionRecord('actor.moveSpatial', { actorIds: ['a', 'b'] }) });
    expect(prepare(next).blocked).toBe(false);
    expect(prepare(placeSpatialActors(state, { a: { x: -100, y: 160 } })).blocked).toBe(true);
    expect(prepare(next).nextEncounter.engagements).toEqual(state.engagements);
  });
  it('re-snaps grid edits and size changes, with canvas scaling preserving anchors', () => {
    const state = changeMovementStrategy(encounter(), 'grid', { a: { x: 200, y: 200 } });
    const edited = resnapSpatialActors({ ...state, grid: { ...state.grid, cellSize: 48, rotation: 15 } });
    expect(prepareValidatedEncounterChange({ currentEncounter: state, nextEncounter: edited, action: createEncounterActionRecord('grid.update') }).blocked).toBe(false);
    const sized = prepareValidatedEncounterChange({ currentEncounter: state, nextEncounter: updateActorProperties(state, 'a', { size: 'large' }), action: createEncounterActionRecord('actor.updateProperties', { actorIds: ['a'] }) });
    expect(sized.blocked).toBe(false); expect(sized.nextEncounter.actors.byId.a.spatialPosition).toEqual({ x: 192, y: 192 });
    const resized = resizeEncounterCanvas(state, { canvasSize: { width: 480, height: 320 }, zoneScale: 0.5 });
    expect(resized.grid.cellSize).toBe(32); expect(resized.actors.byId.a.spatialPosition).toEqual({ x: 112, y: 112 });
  });
  it('supports keyboard stepping, panel transfers, duplication and undoable deletion', () => {
    const state = changeMovementStrategy(encounter(), 'free', { a: { x: 200, y: 200 } });
    expect(stepSpatialActors(state, ['a'], { x: 1, y: 0 }).actors.byId.a.spatialPosition).toEqual({ x: 210, y: 200 });
    const removed = placeSpatialActors(state, { a: null });
    expect(removed.actors.byId.a.currentZoneId).toBe('z'); expect(removed.engagements).toEqual(state.engagements);
    expect(removed.actors.byId.a.spatialPosition).toBeUndefined();
    const copy = duplicateActor(state, 'a', 'copy'); expect(copy.actors.byId.copy.spatialPosition).toEqual({ x: 200, y: 200 });
    const history = reducer(createEncounterHistoryState(copy), commitEncounterChange({ action: createEncounterActionRecord('actor.delete'), nextEncounter: deleteActor(copy, 'a') }));
    expect(reducer(history, undoEncounterChange()).present).toEqual(copy);
  });
  it('validates restored Zone packing after a spatial size change', () => {
    let state = encounter();
    state.zones.byId.z = { ...state.zones.byId.z, polygon: [{ x: 50, y: 50 }, { x: 90, y: 50 }, { x: 90, y: 90 }, { x: 50, y: 90 }] };
    state = changeMovementStrategy(state, 'grid', {});
    state = updateActorProperties(state, 'a', { size: 'xLarge' });
    const next = changeMovementStrategy(state, 'zone', {});
    expect(prepareValidatedEncounterChange({ currentEncounter: state, nextEncounter: next, action: createEncounterActionRecord('movement.changeStrategy') }).blocked).toBe(true);
  });
  it('copies Free coordinates rather than retaining mutable rendering inputs', () => {
    const state = changeMovementStrategy(encounter(), 'free', {});
    const point = { x: 120, y: 140 };
    const next = placeSpatialActors(state, { a: point });
    point.x = 999;
    expect(next.actors.byId.a.spatialPosition).toEqual({ x: 120, y: 140 });
  });
  it('retains STRICT versus ADVISORY semantics for non-geometric restrictions', () => {
    const state = changeMovementStrategy(encounter(), 'free', {});
    const validators = [{ id: 'test.rule', validate: () => ({ valid: false, messages: [{ code: 'test', message: 'Restriction', severity: 'error' as const }] }) }];
    expect(runValidationPipelineSync({ state, action: { type: 'actor.moveSpatial', payload: {} }, validators, mode: 'STRICT' }).blocked).toBe(true);
    expect(runValidationPipelineSync({ state, action: { type: 'actor.moveSpatial', payload: {} }, validators, mode: 'ADVISORY' }).blocked).toBe(false);
  });
});
