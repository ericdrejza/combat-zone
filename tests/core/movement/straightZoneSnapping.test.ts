import { mergeConsecutivePolygonPoints } from '@core/layout/polygonCorners';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { createEncounterHistoryState } from '@core/history/types';
import type { LayoutPoint } from '@core/layout/types';
import { isSimplePolygon } from '@core/layout/polygonValidity';
import { changeMovementRules } from '@core/movement/changeMovementRules';
import { nearestGridVertex } from '@core/movement/gridTopology';
import { snapZonePolygon, zoneSnappingValid } from '@core/movement/zoneVertexSnapping';
import { prepareValidatedEncounterChange } from '@core/validation/validatedEncounterChange';
import { createZone } from '@entities/zone/zoneMutations';
import reducer, { commitEncounterChange, undoEncounterChange, redoEncounterChange } from '@store/encounterSlice';
import { createShapePolygon } from '@ui/canvas/zones/zoneShapeGeometry';
import { getZoneResizeHandles } from '@ui/canvas/zones/zoneResizeGeometry';

function subdivide(corners: LayoutPoint[]) {
  return corners.flatMap((start, index) => {
    const end = corners[(index + 1) % corners.length];
    return [0, 0.2, 0.5, 0.8].map(ratio => ({
      x: start.x + ratio * (end.x - start.x), y: start.y + ratio * (end.y - start.y)
    }));
  });
}

function expectPointsClose(actual: LayoutPoint[], expected: LayoutPoint[]) {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((point, index) => {
    expect(point.x).toBeCloseTo(expected[index].x, 8);
    expect(point.y).toBeCloseTo(expected[index].y, 8);
  });
}

describe('straight Zone corner snapping', () => {
  it.each(['square', 'hex-flat', 'hex-pointy'] as const)('snaps every polygon vertex on rotated, warped %s grids', type => {
    const state = createEncounterState({ id: type, name: type });
    state.grid = { ...state.grid, type, rotation: 17, origin: { x: 30, y: 40 },
      warp: { type: 'bilinear', x: [0, 1, 0, 0.0001], y: [0, 0, 1, 0.0001] } };
    state.movementRules.snapZoneVertices = true;
    const corners = createShapePolygon('hexagon', { x: 100, y: 100 }, { x: 420, y: 420 });
    const polygon = snapZonePolygon(state, { shape: 'polygon', polygon: subdivide(corners) });
    expectPointsClose(polygon, mergeConsecutivePolygonPoints(subdivide(corners).map(point => nearestGridVertex(state, point))));
    const next = createZone(state, { id: 'z', shape: 'polygon', polygon });
    expect(zoneSnappingValid(next, next.zones.byId.z)).toBe(true);
  });

  it.each(['rectangle', 'polygon'] as const)('applies the shape-specific vertex rule to subdivided %s outlines', shape => {
    const state = createEncounterState({ id: shape, name: shape });
    state.movementRules.snapZoneVertices = true;
    const corners = createShapePolygon(shape === 'rectangle' ? shape : 'hexagon', { x: 70, y: 70 }, { x: 310, y: 310 });
    const polygon = subdivide(corners);
    const expectedCorners = corners.map(point => nearestGridVertex(state, point));
    const actual = snapZonePolygon(state, { shape, polygon });
    const expected = shape === 'rectangle' ? subdivide(expectedCorners)
      : mergeConsecutivePolygonPoints(polygon.map(point => nearestGridVertex(state, point)));
    expectPointsClose(actual, expected);
    expect(isSimplePolygon(actual)).toBe(true);
    const next = createZone(state, { id: 'z', shape, polygon: actual });
    expect(zoneSnappingValid(next, next.zones.byId.z)).toBe(true);
    // Generated edge samples are rendering geometry; every custom Polygon vertex snaps.
    expect(actual.some(point => Math.hypot(point.x - nearestGridVertex(state, point).x,
      point.y - nearestGridVertex(state, point).y) > 1e-5)).toBe(shape === 'rectangle');
    expectPointsClose(snapZonePolygon(next, next.zones.byId.z), actual);
  });

  it.each(['ADVISORY', 'STRICT'] as const)('enables snapping for an existing subdivided hexagon atomically with undo/redo in %s', mode => {
    const corners = createShapePolygon('hexagon', { x: 70, y: 70 }, { x: 250, y: 250 });
    const state = createZone(createEncounterState({ id: mode, name: mode }), { id: 'z', shape: 'hexagon', polygon: subdivide(corners) });
    state.validationState.mode = mode;
    const before = structuredClone(state);
    const next = changeMovementRules(state, { snapZoneVertices: true }, {});
    const prepared = prepareValidatedEncounterChange({ currentEncounter: state, nextEncounter: next,
      action: createEncounterActionRecord('movement.updateRules') });
    expect(prepared.blocked).toBe(false);
    expect(prepared.validationResult.messages).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'zone.invalidSnappedGeometry' }),
      expect.objectContaining({ code: 'zone.unsnappedVertices' })
    ]));
    expectPointsClose(prepared.nextEncounter.zones.byId.z.polygon,
      subdivide(createShapePolygon('hexagon', { x: 64, y: 64 }, { x: 256, y: 256 })));
    // The resize corners snap; the six generated outline vertices need not do so.
    const zone = prepared.nextEncounter.zones.byId.z;
    const handles = getZoneResizeHandles(zone, zone.polygon);
    for (const index of [1, 3, 5, 7]) expectPointsClose([handles[index]], [nearestGridVertex(next, handles[index])]);
    expect(zone.polygon[0]).toEqual({ x: 256, y: 160 });
    expect(nearestGridVertex(next, zone.polygon[0])).not.toEqual(zone.polygon[0]);
    expect(zoneSnappingValid(prepared.nextEncounter, zone)).toBe(true);
    expect(state).toEqual(before);
    let history = reducer(createEncounterHistoryState(state), commitEncounterChange({ action: prepared.action, nextEncounter: prepared.nextEncounter }));
    expect(history.past).toHaveLength(1);
    history = reducer(history, undoEncounterChange()); expect(history.present).toEqual(state);
    history = reducer(history, redoEncounterChange()); expect(history.present).toEqual(prepared.nextEncounter);
  });
});
