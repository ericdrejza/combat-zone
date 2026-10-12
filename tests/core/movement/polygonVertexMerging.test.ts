import { createEncounterState } from '@core/encounter/createEncounterState';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { createEncounterHistoryState } from '@core/history/types';
import { changeMovementRules } from '@core/movement/changeMovementRules';
import { reconcileZoneVertices, snapZonePolygon } from '@core/movement/zoneVertexSnapping';
import { prepareValidatedEncounterChange } from '@core/validation/validatedEncounterChange';
import { createZone } from '@entities/zone/zoneMutations';
import reducer, { commitEncounterChange, redoEncounterChange, undoEncounterChange } from '@store/encounterSlice';

const original = [
  { x: 70, y: 70 }, { x: 77.5, y: 74 }, { x: 85, y: 78 },
  { x: 250, y: 70 }, { x: 250, y: 250 }, { x: 70, y: 250 }
];
const snapped = [{ x: 64, y: 64 }, { x: 256, y: 64 }, { x: 256, y: 256 }, { x: 64, y: 256 }];

describe('merging snapped Polygon vertices', () => {
  it.each(['OFF', 'ADVISORY', 'ASSISTED', 'STRICT'] as const)('merges a collapsed edge and its samples in one history entry in %s', mode => {
    const state = createZone(createEncounterState({ id: mode, name: mode }), { id: 'z', shape: 'polygon', polygon: original });
    state.validationState.mode = mode;
    const next = changeMovementRules(state, { snapZoneVertices: true }, {});
    const prepared = prepareValidatedEncounterChange({ currentEncounter: state, nextEncounter: next,
      action: createEncounterActionRecord('movement.updateRules') });
    expect(prepared.blocked).toBe(false);
    expect(prepared.nextEncounter.zones.byId.z.polygon).toEqual(snapped);
    expect(state.zones.byId.z.polygon).toEqual(original);
    let history = reducer(createEncounterHistoryState(state), commitEncounterChange({ action: prepared.action, nextEncounter: prepared.nextEncounter }));
    expect(history.past).toHaveLength(1);
    history = reducer(history, undoEncounterChange()); expect(history.present).toEqual(state);
    history = reducer(history, redoEncounterChange()); expect(history.present).toEqual(prepared.nextEncounter);
  });

  it('merges the closing pair without duplicating the first corner', () => {
    const state = createEncounterState({ id: 'closing', name: 'Closing' });
    state.movementRules.snapZoneVertices = true;
    const polygon = [...original.slice(2), ...original.slice(0, 2)];
    expect(snapZonePolygon(state, { shape: 'polygon', polygon })).toEqual(snapped);
  });

  it('retains a merge even when only the vertex count changes', () => {
    const state = createZone(createEncounterState({ id: 'length', name: 'Length' }), {
      id: 'z', shape: 'polygon', polygon: [...snapped, snapped[0]]
    });
    state.movementRules.snapZoneVertices = true;
    const next = reconcileZoneVertices(state);
    expect(next).not.toBe(state);
    expect(next.zones.byId.z.polygon).toEqual(snapped);
    expect(state.zones.byId.z.polygon).toHaveLength(5);
    expect(reconcileZoneVertices(next)).toBe(next);
  });

  it.each(['ADVISORY', 'STRICT'] as const)('still rejects a polygon that collapses below three corners in %s', mode => {
    const state = createZone(createEncounterState({ id: mode, name: mode }), { id: 'z', shape: 'polygon', polygon: [
      { x: 70, y: 70 }, { x: 85, y: 78 }, { x: 85, y: 90 }, { x: 70, y: 90 }
    ] });
    state.validationState.mode = mode;
    const next = changeMovementRules(state, { snapZoneVertices: true }, {});
    expect(next.zones.byId.z.polygon).toHaveLength(1);
    const prepared = prepareValidatedEncounterChange({ currentEncounter: state, nextEncounter: next,
      action: createEncounterActionRecord('movement.updateRules') });
    expect(prepared.blocked).toBe(true);
    expect(prepared.validationResult.messages.some(message => message.code === 'zone.invalidSnappedGeometry')).toBe(true);
    expect(state.movementRules.snapZoneVertices).toBe(false);
  });

  it.each(['ADVISORY', 'STRICT'] as const)('still rejects nonconsecutive corners that collide and create a doubled-back edge in %s', mode => {
    const state = createZone(createEncounterState({ id: mode, name: mode }), { id: 'z', shape: 'polygon', polygon: [
      { x: 64, y: 64 }, { x: 256, y: 64 }, { x: 256, y: 256 }, { x: 150, y: 256 },
      { x: 150, y: 150 }, { x: 110, y: 150 }, { x: 110, y: 256 }, { x: 64, y: 256 }
    ] });
    state.validationState.mode = mode;
    const prepared = prepareValidatedEncounterChange({ currentEncounter: state,
      nextEncounter: changeMovementRules(state, { snapZoneVertices: true }, {}),
      action: createEncounterActionRecord('movement.updateRules') });
    expect(prepared.blocked).toBe(true);
    expect(prepared.validationResult.messages.some(message => message.code === 'zone.invalidSnappedGeometry')).toBe(true);
  });
});
