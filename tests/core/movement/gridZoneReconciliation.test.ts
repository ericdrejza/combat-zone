import { createEncounterState } from '@core/encounter/createEncounterState';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { createEncounterHistoryState } from '@core/history/types';
import { gridToWorld } from '@core/movement/gridGeometry';
import { resolveGridGeometry } from '@core/movement/gridScale';
import { cellVertices } from '@core/movement/gridTopology';
import { applyGridAlignment, updateGridConfiguration } from '@core/movement/updateGridConfiguration';
import { reconcileZoneVertices, zoneSnappingValid } from '@core/movement/zoneVertexSnapping';
import { prepareValidatedEncounterChange } from '@core/validation/validatedEncounterChange';
import { createZone } from '@entities/zone/zoneMutations';
import reducer, { commitEncounterChange, redoEncounterChange, undoEncounterChange } from '@store/encounterSlice';
import { createShapePolygon } from '@ui/canvas/zones/zoneShapeGeometry';

function fixture(shape: 'polygon' | 'rectangle' | 'circle' | 'hexagon' = 'polygon') {
  const state = createZone(createEncounterState({ id: 'grid-zones', name: 'Grid Zones' }), {
    id: 'z', shape, polygon: shape === 'polygon' ? [
      { x: 128, y: 128 }, { x: 384, y: 128 }, { x: 384, y: 384 }, { x: 128, y: 384 }
    ] : createShapePolygon(shape, { x: 128, y: 128 }, { x: 384, y: 384 })
  });
  state.movementRules.snapZoneVertices = true;
  return state;
}

describe('grid edits with existing snapped Zones', () => {
  it.each(['polygon', 'rectangle', 'circle', 'hexagon'] as const)('reconciles %s alignment before its fit check and restores it through history', shape => {
    const state = fixture(shape);
    const next = applyGridAlignment(state, { ...resolveGridGeometry(state.grid), origin: { x: 12, y: 12 } });
    expect(next).not.toBe(state);
    expect(next.zones.byId.z.polygon).not.toEqual(state.zones.byId.z.polygon);
    expect(zoneSnappingValid(next, next.zones.byId.z)).toBe(true);
    const prepared = prepareValidatedEncounterChange({ currentEncounter: state, nextEncounter: next,
      action: createEncounterActionRecord('grid.calibrate') });
    expect(prepared.blocked).toBe(false);
    let history = reducer(createEncounterHistoryState(state), commitEncounterChange({ action: prepared.action, nextEncounter: prepared.nextEncounter }));
    expect(history.past).toHaveLength(1);
    history = reducer(history, undoEncounterChange()); expect(history.present).toEqual(state);
    history = reducer(history, redoEncounterChange()); expect(history.present).toEqual(prepared.nextEncounter);
  });

  it.each(['hex-flat', 'hex-pointy'] as const)('reconciles existing %s vertices when switching to square', type => {
    for (const shape of ['polygon', 'rectangle', 'hexagon'] as const) {
      let state = fixture(shape); state.grid.type = type;
      state = reconcileZoneVertices(state);
      const next = updateGridConfiguration(state, { ...state.grid, type: 'square' });
      const prepared = prepareValidatedEncounterChange({ currentEncounter: state, nextEncounter: next,
        action: createEncounterActionRecord('grid.update') });
      expect(prepared.blocked).toBe(false);
      expect(zoneSnappingValid(prepared.nextEncounter, prepared.nextEncounter.zones.byId.z)).toBe(true);
    }
  });

  it.each(['ADVISORY', 'STRICT'] as const)('merges neighboring polygon corners when changing from hex to square in %s', mode => {
    let state = createEncounterState({ id: 'hex-cell', name: 'Hex Cell' });
    state.grid = { ...state.grid, type: 'hex-flat', origin: { x: 250, y: 250 } };
    state.movementRules.snapZoneVertices = true;
    state.validationState.mode = mode;
    const grid = resolveGridGeometry(state.grid);
    state = createZone(state, { id: 'z', shape: 'polygon', polygon: cellVertices(grid, gridToWorld(grid, { x: 0, y: 0 })) });
    expect(zoneSnappingValid(state, state.zones.byId.z)).toBe(true);
    const before = structuredClone(state);
    const next = updateGridConfiguration(state, { ...state.grid, type: 'square', origin: { x: 0, y: 0 } });
    const prepared = prepareValidatedEncounterChange({ currentEncounter: state, nextEncounter: next,
      action: createEncounterActionRecord('grid.update') });
    expect(prepared.blocked).toBe(false);
    expect(prepared.nextEncounter.zones.byId.z.polygon).toHaveLength(3);
    expect(zoneSnappingValid(prepared.nextEncounter, prepared.nextEncounter.zones.byId.z)).toBe(true);
    expect(state).toEqual(before);
  });
});
