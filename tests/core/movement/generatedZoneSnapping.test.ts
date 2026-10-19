import { zoneBoundsCorners } from '@core/movement/snappedZoneBounds';
import { snapZoneResizePolygon } from '@ui/canvas/zones/snapZoneResizePolygon';
import { nearestGridVertex } from '@core/movement/gridTopology';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { createZone } from '@entities/zone/zoneMutations';
import { createShapePolygon } from '@entities/zone/zoneShapeGeometry';
import { getZoneLocalPolygon, rotatePoint } from '@entities/zone/zoneRotation';
import { snapZonePolygon, zoneSnappingValid } from '@core/movement/zoneVertexSnapping';
import { changeMovementRules } from '@core/movement/changeMovementRules';
import { prepareValidatedEncounterChange } from '@core/validation/validatedEncounterChange';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { createEncounterHistoryState } from '@core/history/types';
import reducer, { commitEncounterChange, undoEncounterChange, redoEncounterChange } from '@store/encounterSlice';

it.each(['square', 'hex-flat', 'hex-pointy', 'isometric'] as const)('preserves generated outlines and snaps all four bounds corners on compatible %s grids', type => {
  const state = createEncounterState({ id: type, name: type });
  state.grid = { ...state.grid, type, rotation: 17, origin: { x: 30, y: 40 },
    warp: { type: 'bilinear', x: [0, 1.2, 0, 0], y: [0, 0, 1.2, 0] } };
  state.movementRules.snapZoneVertices = true;
  for (const shape of ['rectangle', 'circle', 'hexagon'] as const) {
    const rotation = state.grid.rotation + (type === 'hex-pointy' ? 30 : 0);
    const zone = createZone(state, { id: 'z', shape, polygon: createShapePolygon(shape, { x: 160, y: 160 }, { x: 480, y: 420 }) }).zones.byId.z;
    zone.rotation = rotation;
    zone.polygon = zone.polygon.map(point => rotatePoint(point, rotation, { x: 320, y: 290 }));
    const snapped = { ...zone, polygon: snapZonePolygon(state, zone) };
    expect(zoneSnappingValid(state, snapped)).toBe(true);
    zoneBoundsCorners(snapped).forEach(point => {
      expect(Math.hypot(point.x - nearestGridVertex(state, point).x, point.y - nearestGridVertex(state, point).y)).toBeLessThan(1e-5);
    });
    const local = getZoneLocalPolygon(snapped);
    const xs = local.map(p => p.x), ys = local.map(p => p.y);
    const expected = createShapePolygon(shape, { x: Math.min(...xs), y: Math.min(...ys) }, { x: Math.max(...xs), y: Math.max(...ys) });
    local.forEach((point, index) => {
      expect(point.x).toBeCloseTo(expected[index].x, 6);
      expect(point.y).toBeCloseTo(expected[index].y, 6);
    });
    expect(snapped.rotation).toBe(rotation);
    snapZonePolygon(state, snapped).forEach((point, index) => {
      expect(point.x).toBeCloseTo(snapped.polygon[index].x, 6);
      expect(point.y).toBeCloseTo(snapped.polygon[index].y, 6);
    });
  }
});

it.each(['STRICT', 'ADVISORY'] as const)('enables shape-preserving snapping atomically with undo/redo in %s', mode => {
  const state = createZone(createEncounterState({ id: mode, name: mode }), { id: 'z', shape: 'rectangle',
    polygon: createShapePolygon('rectangle', { x: 170, y: 160 }, { x: 470, y: 410 }) });
  state.validationState.mode = mode;
  state.grid = { ...state.grid, type: 'isometric', rotation: 0 };
  const next = changeMovementRules(state, { snapZoneVertices: true }, {});
  const prepared = prepareValidatedEncounterChange({ currentEncounter: state, nextEncounter: next,
    action: createEncounterActionRecord('movement.updateRules') });
  expect(prepared.blocked).toBe(false);
  const polygon = prepared.nextEncounter.zones.byId.z.polygon;
  expect(polygon[0].y).toBeCloseTo(polygon[1].y);
  expect(polygon[1].x).toBeCloseTo(polygon[2].x);
  expect(polygon[2].y).toBeCloseTo(polygon[3].y);
  expect(polygon[3].x).toBeCloseTo(polygon[0].x);
  let history = reducer(createEncounterHistoryState(state), commitEncounterChange({ action: prepared.action, nextEncounter: prepared.nextEncounter }));
  history = reducer(history, undoEncounterChange()); expect(history.present).toEqual(state);
  history = reducer(history, redoEncounterChange()); expect(history.present).toEqual(prepared.nextEncounter);
});


it('keeps four distinct rectangular corners when the input already has grid-induced skew', () => {
  const state = createEncounterState({ id: 'skew', name: 'Skew' });
  state.grid.type = 'isometric';
  state.movementRules.snapZoneVertices = true;
  const polygon = createShapePolygon('rectangle', { x: 170, y: 160 }, { x: 470, y: 410 })
    .map(point => nearestGridVertex(state, point));
  const snapped = snapZonePolygon(state, { shape: 'rectangle', polygon });
  expect(new Set(snapped.map(point => `${point.x},${point.y}`)).size).toBe(4);
  expect(snapped[0].y).toBeCloseTo(snapped[1].y);
  expect(snapped[1].x).toBeCloseTo(snapped[2].x);
  expect(snapped[2].y).toBeCloseTo(snapped[3].y);
  expect(snapped[3].x).toBeCloseTo(snapped[0].x);
});


it.each(['rectangle', 'circle', 'hexagon'] as const)('resizes %s bounds to four grid vertices without moving the opposite control', shape => {
  const state = createEncounterState({ id: shape, name: shape });
  state.grid.type = 'isometric';
  state.movementRules.snapZoneVertices = true;
  const zone = createZone(state, { id: 'z', shape, polygon: createShapePolygon(shape,
    { x: 128, y: 128 }, { x: 416, y: 304 }) }).zones.byId.z;
  const polygon = snapZoneResizePolygon(state, zone, shape === 'rectangle' ? 2 : 3);
  const corners = zoneBoundsCorners({ ...zone, polygon });
  expect(corners[0].x).toBeCloseTo(128);
  expect(corners[0].y).toBeCloseTo(128);
  corners.forEach(point => expect(Math.hypot(point.x - nearestGridVertex(state, point).x,
    point.y - nearestGridVertex(state, point).y)).toBeLessThan(1e-5));
  expect(corners[0].y).toBeCloseTo(corners[1].y);
  expect(corners[1].x).toBeCloseTo(corners[2].x);
  expect(corners[2].y).toBeCloseTo(corners[3].y);
  expect(corners[3].x).toBeCloseTo(corners[0].x);
});

it.each(['OFF', 'ADVISORY', 'ASSISTED', 'STRICT'] as const)('rejects a shape/rotation that cannot snap all controls in %s', mode => {
  const state = createEncounterState({ id: mode, name: mode });
  state.validationState.mode = mode;
  const original = createZone(state, { id: 'z', shape: 'rectangle', polygon: createShapePolygon('rectangle',
    { x: 160, y: 160 }, { x: 480, y: 420 }) });
  original.zones.byId.z.rotation = 31;
  original.zones.byId.z.polygon = original.zones.byId.z.polygon.map(point => rotatePoint(point, 31, { x: 320, y: 290 }));
  const next = changeMovementRules(original, { snapZoneVertices: true }, {});
  const prepared = prepareValidatedEncounterChange({ currentEncounter: original, nextEncounter: next,
    action: createEncounterActionRecord('movement.updateRules') });
  expect(prepared.blocked).toBe(true);
  expect(prepared.validationResult.messages).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'zone.unsnappedVertices' })]));
  expect(original.movementRules.snapZoneVertices).toBe(false);
});
