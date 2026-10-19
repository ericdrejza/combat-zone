import { createEncounterState } from '@core/encounter/createEncounterState';
import { snapZonePolygon, zoneSnappingValid } from '@core/movement/zoneVertexSnapping';
import { snapZoneRotation } from '@core/movement/snapZoneRotation';
import { zoneBoundsCorners } from '@core/movement/snappedZoneBounds';
import { createRectanglePolygon, createShapePolygon } from '@entities/zone/zoneShapeGeometry';
import { getZoneLocalPolygon, rotatePoint } from '@entities/zone/zoneRotation';
import { getPolygonBounds } from '@core/layout/polygonGeometry';

it('snaps the rotated one-by-three rectangle to a rectangular two-by-one diagonal grid footprint', () => {
  const state = createEncounterState({ id: 'diagonal', name: 'Diagonal' });
  state.movementRules.snapZoneVertices = true;
  const polygon = createRectanglePolygon({ x: 64, y: 0 }, { x: 128, y: 192 });
  const zone = { shape: 'rectangle' as const, rotation: -45,
    polygon: polygon.map(point => rotatePoint(point, -45, { x: 96, y: 96 })) };
  const snapped = snapZonePolygon(state, zone);
  const expected = [{ x: 0, y: 64 }, { x: 64, y: 0 }, { x: 192, y: 128 }, { x: 128, y: 192 }];
  snapped.forEach((point, i) => {
    expect(point.x).toBeCloseTo(expected[i].x, 6);
    expect(point.y).toBeCloseTo(expected[i].y, 6);
  });
  expect(zoneSnappingValid(state, { ...zone, polygon: snapped })).toBe(true);
});

it.each(['rectangle', 'circle', 'hexagon'] as const)('settles %s bounds and angle together without preserving aspect ratio', shape => {
  const state = createEncounterState({ id: shape, name: shape });
  state.movementRules.snapZoneVertices = true;
  const rotation = -44.7;
  const zone = { shape, rotation, polygon: createShapePolygon(shape, { x: 64, y: 0 }, { x: 128, y: 192 })
    .map(point => rotatePoint(point, rotation, { x: 96, y: 96 })) };
  const snapped = { ...zone, ...snapZoneRotation(state, zone) };
  expect(snapped.rotation).toBeCloseTo(-45);
  expect(zoneSnappingValid(state, snapped)).toBe(true);
  const local = getZoneLocalPolygon(snapped), bounds = getPolygonBounds(local);
  expect((bounds.maxX - bounds.minX) / (bounds.maxY - bounds.minY)).toBeCloseTo(1 / 2);
  const expected = createShapePolygon(shape, { x: bounds.minX, y: bounds.minY }, { x: bounds.maxX, y: bounds.maxY });
  local.forEach((point, i) => {
    expect(point.x).toBeCloseTo(expected[i].x, 6); expect(point.y).toBeCloseTo(expected[i].y, 6);
  });
  const repeated = snapZoneRotation(state, snapped);
  expect(repeated.rotation).toBeCloseTo(snapped.rotation);
  repeated.polygon.forEach((point, i) => {
    expect(point.x).toBeCloseTo(snapped.polygon[i].x, 6); expect(point.y).toBeCloseTo(snapped.polygon[i].y, 6);
  });
});

it.each(['square', 'isometric', 'hex-flat', 'hex-pointy'] as const)('finds rectangular bounds on a rotated %s grid', type => {
  const state = createEncounterState({ id: type, name: type });
  state.grid = { ...state.grid, type, rotation: 17, origin: { x: 400, y: 250 } };
  state.movementRules.snapZoneVertices = true;
  const rotation = 48;
  const zone = { shape: 'rectangle' as const, rotation, polygon: createRectanglePolygon({ x: 260, y: 170 }, { x: 540, y: 330 })
    .map(point => rotatePoint(point, rotation, { x: 400, y: 250 })) };
  const snapped = { ...zone, ...snapZoneRotation(state, zone) };
  expect(zoneSnappingValid(state, snapped)).toBe(true);
  const [a, b, , d] = zoneBoundsCorners(snapped);
  expect((b.x - a.x) * (d.x - a.x) + (b.y - a.y) * (d.y - a.y)).toBeCloseTo(0, 5);
  expect(Math.abs(snapped.rotation - rotation)).toBeLessThan(25);
});
