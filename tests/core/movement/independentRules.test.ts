import { createEncounterState } from '@core/encounter/createEncounterState';
import { createActor } from '@entities/actor/actorMutations';
import { createZone } from '@entities/zone/zoneMutations';
import { createEngagement } from '@entities/engagement/engagementMutations';
import { changeMovementRules } from '@core/movement/changeMovementRules';
import { placeSpatialActors } from '@core/movement/movementStrategies';
import { packGridZone } from '@core/movement/gridZonePacking';
import { actorAnchorCells, anchorKey } from '@core/movement/gridTopology';
import { snapToGrid } from '@core/movement/gridGeometry';
import { resolveGridGeometry } from '@core/movement/gridScale';
import { SpatialValidator } from '@core/movement/spatialValidator';
import { prepareValidatedEncounterChange } from '@core/validation/validatedEncounterChange';
import { createEncounterHistoryState } from '@core/history/types';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import reducer, { commitEncounterChange, undoEncounterChange, redoEncounterChange } from '@store/encounterSlice';

const polygon = [{ x: 0, y: 0 }, { x: 320, y: 0 }, { x: 320, y: 320 }, { x: 0, y: 320 }];
function fixture() {
  let state = createZone(createEncounterState({ id: 'rules', name: 'Rules' }), { id: 'z', polygon });
  state = createActor(state, { id: 'a', currentZoneId: 'z' });
  return createActor(state, { id: 'b', currentZoneId: 'z' });
}

describe('independent actor and Zone rules', () => {
  it('packs snapped actors within Zones without sharing anchors', () => {
    const state = fixture(); state.movementRules.snapToGrid = true;
    const packing = packGridZone(state, 'z');
    expect(packing.fits).toBe(true);
    expect(new Set(packing.placements.map(p => anchorKey(p.point))).size).toBe(2);
    for (const placement of packing.placements) expect(snapToGrid(resolveGridGeometry(state.grid), placement.point, state.actors.byId[placement.actorId].size)).toEqual(placement.point);
  });
  it('uses identical-anchor occupancy rather than intersecting footprints', () => {
    let state = fixture(); state.movementRules = { ...state.movementRules, zoneLocked: false, snapToGrid: true };
    state = placeSpatialActors(state, { a: { x: 96, y: 96 }, b: { x: 96, y: 96 } });
    expect(state.actors.byId.a.spatialPosition).toEqual({ x: 96, y: 96 });
    expect(state.actors.byId.b.spatialPosition).toEqual({ x: 96, y: 32 });
    expect(SpatialValidator.validate({ type: 'actor.moveSpatial', payload: {} }, { state, mode: 'OFF' }).blocked).toBe(false);
  });
  it('rejects a whole group move when no open canvas anchor exists', () => {
    let state = fixture(); state.canvasSize = { width: 64, height: 64 };
    state.movementRules = { ...state.movementRules, zoneLocked: false, snapToGrid: true };
    state.actors.byId.a.spatialPosition = { x: 32, y: 32 };
    expect(placeSpatialActors(state, { b: { x: 32, y: 32 } })).toBe(state);
  });
  it('disabling Overlap relocates or unplaces tokens in one reversible action', () => {
    const state = fixture(); state.canvasSize = { width: 64, height: 64 };
    state.movementRules = { ...state.movementRules, zoneLocked: false, snapToGrid: true, allowOverlap: true };
    state.actors.byId.a.spatialPosition = state.actors.byId.b.spatialPosition = { x: 32, y: 32 };
    const next = changeMovementRules(state, { allowOverlap: false }, {});
    expect(next.actors.byId.a.spatialPosition).toBeDefined(); expect(next.actors.byId.b.spatialPosition).toBeUndefined();
    let history = reducer(createEncounterHistoryState(state), commitEncounterChange({ action: createEncounterActionRecord('movement.updateRules'), nextEncounter: next }));
    history = reducer(history, undoEncounterChange()); expect(history.present).toEqual(state);
    history = reducer(history, redoEncounterChange()); expect(history.present).toEqual(next);
  });
  it('locks without Overlap and turns Trim off when actor snapping is disabled', () => {
    const state = fixture(); state.movementRules = { ...state.movementRules, zoneLocked: false, snapToGrid: true, allowOverlap: true, trimTokens: true };
    const next = changeMovementRules(state, { zoneLocked: true, snapToGrid: false }, {});
    expect(next.movementRules).toMatchObject({ zoneLocked: true, allowOverlap: false, trimTokens: false });
  });
  it('dissolves a group that cannot fit while preserving individually fitting members', () => {
    let state = fixture(); state.zones.byId.z.polygon = [{ x: 0, y: 0 }, { x: 64, y: 0 }, { x: 64, y: 64 }, { x: 0, y: 64 }];
    state = createEngagement(state, { id: 'g', parentZoneId: 'z', participantIds: ['a', 'b'] });
    state.movementRules = { ...state.movementRules, zoneLocked: false, snapToGrid: true };
    const next = changeMovementRules(state, { zoneLocked: true }, {});
    expect(next.engagements.allIds).toEqual([]);
    expect(next.actors.allIds.filter(id => next.actors.byId[id].currentZoneId === 'z')).toHaveLength(1);
  });
  it.each(['OFF', 'ADVISORY', 'ASSISTED', 'STRICT'] as const)('enforces occupancy and full canvas fit in %s', mode => {
    const state = fixture(); state.movementRules = { ...state.movementRules, zoneLocked: false, snapToGrid: true }; state.validationState.mode = mode;
    state.actors.byId.a.spatialPosition = state.actors.byId.b.spatialPosition = { x: 32, y: 32 };
    expect(prepareValidatedEncounterChange({ currentEncounter: state, nextEncounter: state, action: createEncounterActionRecord('actor.moveSpatial') }).blocked).toBe(true);
  });
  it.each(['square', 'hex-flat', 'hex-pointy'] as const)('shares expected xLarge cell neighborhoods for %s', type => {
    const state = fixture(); state.grid.type = type;
    const point = snapToGrid(resolveGridGeometry(state.grid), { x: 192, y: 192 }, 'xLarge');
    expect(actorAnchorCells(state, point, 'xLarge')).toHaveLength(type === 'square' ? 9 : 7);
  });
});
