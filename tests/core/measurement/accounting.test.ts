import { createEncounterState } from '@core/encounter/createEncounterState';
import { createActor, deleteActor, updateActorProperties } from '@entities/actor/actorMutations';
import { advanceInitiative, endInitiative, setCurrentInitiativeActor } from '@core/encounter/initiativeTurnMutations';
import { placeSpatialActors } from '@core/movement/movementStrategies';
import { resetMovementAccounting, reconcileMovementAccounting } from '@core/measurement/movementAccounting';
import { DEFAULT_MOVEMENT_PREFERENCES } from '@core/measurement/types';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { prepareValidatedEncounterChangeForRuntime } from '@core/validation/runtimeEncounterChange';
import { createEncounterHistoryState } from '@core/history/types';
import reducer, { commitEncounterChange, undoEncounterChange, redoEncounterChange } from '@store/encounterSlice';
import { MOVEMENT_PREFERENCES_KEY } from '@ui/combat_preferences/movementPreferenceStorage';

function fixture() {
  let state = createEncounterState({ id: 'movement', name: 'Movement' });
  state = createActor(state, { id: 'a', currentZoneId: 'zoneless' });
  state = createActor(state, { id: 'b', currentZoneId: 'zoneless' });
  state.movementRules = { ...state.movementRules, zoneLocked: false, snapToGrid: true, allowOverlap: true };
  state = placeSpatialActors(state, { a: { x: 160, y: 160 }, b: { x: 352, y: 160 } });
  state.initiativeTracker = { entries: [{ actorId: 'a' }, { actorId: 'b' }], currentActorId: 'a', currentRound: 1, movement: {} };
  return updateActorProperties(state, 'a', { movementLimit: 1 });
}
const prefs = { ...DEFAULT_MOVEMENT_PREFERENCES, trackMovement: true, diagonalCost: 'alternating' as const };
const action = createEncounterActionRecord('actor.moveSpatial', { actorIds: ['a'] });
afterEach(() => localStorage.removeItem(MOVEMENT_PREFERENCES_KEY));

describe('atomic advisory movement accounting', () => {
  it.each(['OFF', 'ADVISORY', 'ASSISTED', 'STRICT'] as const)('allows exceeding limits in %s and replays position plus totals exactly', async mode => {
    const before = fixture(); before.validationState.mode = mode;
    localStorage.setItem(MOVEMENT_PREFERENCES_KEY, JSON.stringify(prefs));
    const prepared = await prepareValidatedEncounterChangeForRuntime({ currentEncounter: before,
      nextEncounter: placeSpatialActors(before, { a: { x: 224, y: 224 } }), action });
    expect(prepared.blocked).toBe(false);
    expect(prepared.nextEncounter.initiativeTracker.movement?.a).toEqual({ distance: 5, diagonals: 1 });
    let history = reducer(createEncounterHistoryState(before), commitEncounterChange({ action: prepared.action, nextEncounter: prepared.nextEncounter }));
    const committed = history.present;
    history = reducer(history, undoEncounterChange()); expect(history.present).toEqual(before);
    history = reducer(history, redoEncounterChange()); expect(history.present).toEqual(committed);
  });
  it('does not charge blocked movement or alter the source snapshot', async () => {
    const before = fixture(), copy = structuredClone(before);
    localStorage.setItem(MOVEMENT_PREFERENCES_KEY, JSON.stringify(prefs));
    const prepared = await prepareValidatedEncounterChangeForRuntime({ currentEncounter: before,
      nextEncounter: placeSpatialActors(before, { a: { x: -32, y: -32 } }), action });
    expect(prepared.blocked).toBe(true); expect(before).toEqual(copy);
  });
  it('preserves parity across accepted moves and counts only the current actor', () => {
    const before = fixture();
    const one = reconcileMovementAccounting(before, placeSpatialActors(before, { a: { x: 224, y: 224 }, b: { x: 416, y: 224 } }), action, prefs);
    expect(one.initiativeTracker.movement).toEqual({ a: { distance: 5, diagonals: 1 } });
    const two = reconcileMovementAccounting(one, placeSpatialActors(one, { a: { x: 288, y: 288 } }), action, prefs);
    expect(two.initiativeTracker.movement?.a).toEqual({ distance: 15, diagonals: 2 });
  });
  it('accounts for explicit waypoints rather than shortcutting a route', () => {
    const before = fixture();
    const next = reconcileMovementAccounting(before, placeSpatialActors(before, { a: { x: 224, y: 160 } }),
      createEncounterActionRecord('actor.moveSpatial', { movementWaypoints: { a: [{ x: 160, y: 224 }, { x: 224, y: 224 }] } }), prefs);
    expect(next.initiativeTracker.movement?.a.distance).toBe(15);
  });
  it('resets per turn or per round and clears on initiative end', () => {
    const before = fixture(); before.initiativeTracker.movement = { a: { distance: 15, diagonals: 2 } };
    const nextTurn = advanceInitiative(before), turnAction = createEncounterActionRecord('initiative.advance');
    expect(reconcileMovementAccounting(before, nextTurn, turnAction, prefs).initiativeTracker.movement).toEqual({});
    const roundPrefs = { ...prefs, resetMovement: 'round' as const };
    const retained = reconcileMovementAccounting(before, nextTurn, turnAction, roundPrefs);
    expect(retained.initiativeTracker.movement).toEqual(before.initiativeTracker.movement);
    expect(reconcileMovementAccounting(retained, advanceInitiative(retained), turnAction, roundPrefs).initiativeTracker.movement).toEqual({});
    expect(reconcileMovementAccounting(before, endInitiative(before), turnAction, roundPrefs).initiativeTracker.movement).toEqual({});
    expect(reconcileMovementAccounting(before, setCurrentInitiativeActor(before, 'b'), turnAction, prefs).initiativeTracker.movement).toEqual({});
  });
  it('excludes placement, removals, geometry edits and disabled tracking', () => {
    const before = fixture(), next = placeSpatialActors(before, { a: { x: 224, y: 224 } });
    for (const type of ['actor.create', 'grid.update', 'actor.delete']) expect(reconcileMovementAccounting(before, next, createEncounterActionRecord(type), prefs).initiativeTracker.movement).toEqual({});
    expect(reconcileMovementAccounting(before, next, action, { ...prefs, trackMovement: false }).initiativeTracker.movement).toEqual({});
  });
  it('clears deleted actor references and resets scale changes, retaining totals on limit edits', () => {
    const before = fixture(); before.initiativeTracker.movement = { b: { distance: 10, diagonals: 0 } };
    expect(reconcileMovementAccounting(before, deleteActor(before, 'b'), createEncounterActionRecord('actor.delete'), prefs).initiativeTracker.movement).toEqual({});
    expect(reconcileMovementAccounting(before, { ...before, grid: { ...before.grid, distancePerCell: 10 } }, createEncounterActionRecord('grid.update'), prefs).initiativeTracker.movement).toEqual({});
    expect(reconcileMovementAccounting(before, updateActorProperties(before, 'a', { movementLimit: 20 }), createEncounterActionRecord('actor.updateProperties'), prefs).initiativeTracker.movement).toEqual(before.initiativeTracker.movement);
  });
});

it('replays accounting resets and limit edits, including removing a limit, exactly', () => {
  const before = fixture(); before.initiativeTracker.movement = { a: { distance: 10, diagonals: 1 } };
  const cleared = resetMovementAccounting(before);
  const limited = updateActorProperties(cleared, 'a', { movementLimit: 30 });
  const unlimited = updateActorProperties(limited, 'a', { movementLimit: null });
  expect(unlimited.actors.byId.a.movementLimit).toBeUndefined();
  expect(updateActorProperties(limited, 'a', { movementLimit: -1 })).toBe(limited);
  let history = createEncounterHistoryState(before);
  const snapshots = [cleared, limited, unlimited];
  for (const [i, nextEncounter] of snapshots.entries()) history = reducer(history, commitEncounterChange({
    action: createEncounterActionRecord(i === 0 ? 'movement.settings' : 'actor.updateProperties'), nextEncounter
  }));
  for (const expected of [limited, cleared, before]) { history = reducer(history, undoEncounterChange()); expect(history.present).toEqual(expected); }
  for (const expected of snapshots) { history = reducer(history, redoEncounterChange()); expect(history.present).toEqual(expected); }
});
