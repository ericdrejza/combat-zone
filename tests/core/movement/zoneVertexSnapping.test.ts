import { cellVertices } from '@core/movement/gridTopology';
import { gridToWorld } from '@core/movement/gridGeometry';
import { resolveGridGeometry } from '@core/movement/gridScale';
import { translateSnappedZone } from '@core/movement/zoneVertexSnapping';
import { updateZonePolygon } from '@entities/zone/zoneMutations';
import { createEncounterHistoryState } from '@core/history/types';
import reducer, { commitEncounterChange, undoEncounterChange, redoEncounterChange } from '@store/encounterSlice';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { createZone } from '@entities/zone/zoneMutations';
import { changeMovementRules } from '@core/movement/changeMovementRules';
import { reconcileZoneVertices, snapZonePolygon, zoneSnappingValid } from '@core/movement/zoneVertexSnapping';
import { prepareValidatedEncounterChange } from '@core/validation/validatedEncounterChange';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { createShapePolygon } from '@ui/canvas/zones/zoneShapeGeometry';
import { nearestGridVertex } from '@core/movement/gridTopology';
import { SpatialValidator } from '@core/movement/spatialValidator';

describe('independent Zone vertex snapping', () => {
  it('snaps existing polygons independently of actor snapping and lock', () => {
    const state = createZone(createEncounterState({ id: 'vertices', name: 'Vertices' }), { id: 'z', shape: 'polygon', polygon: [{ x: 70, y: 70 }, { x: 250, y: 70 }, { x: 250, y: 250 }, { x: 70, y: 250 }] });
    const next = changeMovementRules(state, { snapZoneVertices: true, zoneLocked: false }, {});
    expect(next.movementRules.snapToGrid).toBe(false);
    expect(next.zones.byId.z.polygon).toEqual([{ x: 64, y: 64 }, { x: 256, y: 64 }, { x: 256, y: 256 }, { x: 64, y: 256 }]);
    expect(state.zones.byId.z.polygon[0]).toEqual({ x: 70, y: 70 });
  });
  it.each(['rectangle', 'circle', 'hexagon'] as const)('preserves generated %s outlines while snapping drawing controls', shape => {
    const state = createEncounterState({ id: shape, name: shape }); state.movementRules.snapZoneVertices = true;
    const polygon = createShapePolygon(shape, { x: 70, y: 70 }, { x: 250, y: 250 });
    const expected = createShapePolygon(shape, { x: 64, y: 64 }, { x: 256, y: 256 });
    const actual = snapZonePolygon(state, { shape, polygon });
    expect(actual).toHaveLength(expected.length);
    actual.forEach((point, i) => { expect(point.x).toBeCloseTo(expected[i].x, 8); expect(point.y).toBeCloseTo(expected[i].y, 8); });
  });
  it('reconciles grid changes and rejects direct unsnapped commits', () => {
    let state = createZone(createEncounterState({ id: 'grid', name: 'Grid' }), { id: 'z', shape: 'polygon', polygon: [{ x: 64, y: 64 }, { x: 256, y: 64 }, { x: 256, y: 256 }, { x: 64, y: 256 }] });
    state.movementRules.snapZoneVertices = true;
    state = { ...state, grid: { ...state.grid, origin: { x: 12, y: 12 } } };
    expect(SpatialValidator.validate({ type: 'grid.update', payload: {} }, { state, mode: 'OFF' }).blocked).toBe(true);
    const next = reconcileZoneVertices(state);
    expect(zoneSnappingValid(next, next.zones.byId.z)).toBe(true);
    expect(prepareValidatedEncounterChange({ currentEncounter: state, nextEncounter: state, action: createEncounterActionRecord('grid.update') }).blocked).toBe(false);
  });
  it.each(['hex-flat', 'hex-pointy'] as const)('snaps polygon corners to actual rotated %s vertices', type => {
    const state = createEncounterState({ id: type, name: type }); state.grid.type = type; state.grid.rotation = 15; state.movementRules.snapZoneVertices = true;
    const points = [{ x: 100, y: 100 }, { x: 300, y: 100 }, { x: 300, y: 300 }];
    expect(snapZonePolygon(state, { shape: 'polygon', polygon: points })).toEqual(points.map(point => nearestGridVertex(state, point)));
  });
});

it.each(['OFF', 'ADVISORY', 'ASSISTED', 'STRICT'] as const)('rejects collapsed snapped polygons atomically in %s', mode => {
  const state = createZone(createEncounterState({ id: 'collapse', name: 'Collapse' }), { id: 'z', shape: 'polygon', polygon: [{ x: 1, y: 1 }, { x: 25, y: 1 }, { x: 25, y: 25 }, { x: 1, y: 25 }] });
  state.validationState.mode = mode;
  const next = changeMovementRules(state, { snapZoneVertices: true }, {});
  const prepared = prepareValidatedEncounterChange({ currentEncounter: state, nextEncounter: next, action: createEncounterActionRecord('movement.updateRules') });
  expect(prepared.blocked).toBe(true);
  expect(prepared.validationResult.messages.some(message => message.code === 'zone.invalidSnappedGeometry')).toBe(true);
  expect(state.movementRules.snapZoneVertices).toBe(false);
  expect(state.zones.byId.z.polygon[1]).toEqual({ x: 25, y: 1 });
});

it.each(['square', 'hex-flat', 'hex-pointy'] as const)('moves a rotated %s Zone by one lattice vector without changing any edge', type => {
  let state = createEncounterState({ id: `move-${type}`, name: type });
  state.grid = { ...state.grid, type, rotation: 17, origin: { x: 320, y: 256 } };
  state.movementRules.snapZoneVertices = true;
  const grid = resolveGridGeometry(state.grid);
  const polygon = cellVertices(grid, gridToWorld(grid, type === 'square' ? { x: 32, y: 32 } : { x: 0, y: 0 }));
  state = createZone(state, { id: 'z', polygon, shape: 'polygon' });
  const translated = translateSnappedZone(state, state.zones.byId.z, { x: 45, y: 55 });
  const delta = { x: translated[0].x - polygon[0].x, y: translated[0].y - polygon[0].y };
  expect(Math.hypot(delta.x, delta.y)).toBeGreaterThan(0);
  translated.forEach((point, i) => {
    expect(point.x - polygon[i].x).toBeCloseTo(delta.x, 8);
    expect(point.y - polygon[i].y).toBeCloseTo(delta.y, 8);
  });
  expect(zoneSnappingValid(state, { ...state.zones.byId.z, polygon: translated })).toBe(true);
  const next = updateZonePolygon(state, 'z', translated);
  const prepared = prepareValidatedEncounterChange({ currentEncounter: state, nextEncounter: next, action: createEncounterActionRecord('zone.move', { zoneId: 'z', polygon: translated }) });
  expect(prepared.blocked).toBe(false);
  expect(prepared.nextEncounter.zones.byId.z.polygon).toEqual(translated);
  let history = reducer(createEncounterHistoryState(state), commitEncounterChange({ action: prepared.action, nextEncounter: prepared.nextEncounter }));
  history = reducer(history, undoEncounterChange()); expect(history.present).toEqual(state);
  history = reducer(history, redoEncounterChange()); expect(history.present).toEqual(prepared.nextEncounter);
});
