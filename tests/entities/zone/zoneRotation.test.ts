import { createEngagement } from '@entities/engagement/engagementMutations';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { createZone } from '@entities/zone/zoneMutations';
import { convertZoneShape } from '@entities/zone/convertZoneShape';
import { createShapePolygon } from '@entities/zone/zoneShapeGeometry';
import { getZoneLocalPolygon, getZoneRotationCenter, normalizeRotation, rotatePoint, updateZoneGeometry } from '@entities/zone/zoneRotation';
import { getZoneResizeHandles, resizeZonePolygon } from '@ui/canvas/zones/zoneResizeGeometry';
import { snapZonePolygon, zoneSnappingValid } from '@core/movement/zoneVertexSnapping';
import { createActor } from '@entities/actor/actorMutations';
import { calculateActorPlacementGeometry } from '@ui/canvas/actors/actorPlacementGeometryCalculator';
import { prepareValidatedEncounterChange } from '@core/validation/validatedEncounterChange';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';

const center = { x: 300, y: 250 };
function stateFor(shape: 'rectangle' | 'circle' | 'hexagon' | 'polygon' = 'rectangle') {
  return createZone(createEncounterState({ id: 'rotated', name: 'Rotated' }), { id: 'z', shape,
    polygon: createShapePolygon(shape === 'polygon' ? 'rectangle' : shape, { x: 150, y: 150 }, { x: 450, y: 350 }) });
}
function assertPoints(actual: { x: number; y: number }[], expected: { x: number; y: number }[]) {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((point, i) => { expect(point.x).toBeCloseTo(expected[i].x); expect(point.y).toBeCloseTo(expected[i].y); });
}

it.each([[360, 0], [180, -180], [270, -90], [-450, -90], [725, 5]])('normalizes %s degrees', (angle, expected) => {
  expect(normalizeRotation(angle)).toBe(expected);
});

it.each(['rectangle', 'circle', 'hexagon', 'polygon'] as const)('retains a local frame for %s geometry', shape => {
  const original = stateFor(shape);
  const zone = original.zones.byId.z;
  const rotated = updateZoneGeometry(original, 'z', zone.polygon.map(point => rotatePoint(point, 37, center)), 37).zones.byId.z;
  expect(getZoneRotationCenter(rotated).x).toBeCloseTo(center.x);
  expect(getZoneRotationCenter(rotated).y).toBeCloseTo(center.y);
  assertPoints(getZoneLocalPolygon(rotated).map(point => rotatePoint(point, 37)), rotated.polygon);
  expect(original.zones.byId.z.rotation).toBe(0);
});

it.each(['rectangle', 'circle', 'hexagon'] as const)('resizes a rotated %s in its local frame', shape => {
  const zone = stateFor(shape).zones.byId.z;
  const rotation = -53;
  const rotated = { ...zone, rotation, polygon: zone.polygon.map(point => rotatePoint(point, rotation)) };
  const localHandle = getZoneResizeHandles(zone, zone.polygon)[2];
  const nextPoint = { x: localHandle.x + 45, y: localHandle.y + 30 };
  assertPoints(resizeZonePolygon(rotated, rotated.polygon, 2, rotatePoint(nextPoint, rotation)),
    resizeZonePolygon(zone, zone.polygon, 2, nextPoint).map(point => rotatePoint(point, rotation)));
});

it.each(['rectangle', 'circle', 'hexagon', 'polygon'] as const)('preserves rotation when converting to %s', shape => {
  const state = stateFor('polygon');
  const polygon = state.zones.byId.z.polygon.map(point => rotatePoint(point, 33, center));
  const rotated = updateZoneGeometry(state, 'z', polygon, 33);
  const converted = convertZoneShape(rotated, 'z', shape).zones.byId.z;
  expect(converted.rotation).toBe(33);
  expect(getZoneRotationCenter(converted).x).toBeCloseTo(center.x);
  expect(getZoneRotationCenter(converted).y).toBeCloseTo(center.y);
  if (shape === 'polygon') expect(converted.polygon).toEqual(polygon);
});

it.each(['rectangle', 'circle', 'hexagon', 'polygon'] as const)('snaps a rotated %s without resetting its angle', shape => {
  const state = stateFor(shape);
  state.movementRules.snapZoneVertices = true;
  const zone = state.zones.byId.z;
  const angle = shape === 'polygon' ? 35 : 45;
  const rotated = { ...zone, rotation: angle, polygon: zone.polygon.map(point => rotatePoint(point, angle, center)) };
  const snapped = { ...rotated, polygon: snapZonePolygon(state, rotated) };
  expect(zoneSnappingValid(state, snapped)).toBe(true);
  expect(snapped.rotation).toBe(angle);
  assertPoints(snapZonePolygon(state, snapped), snapped.polygon);
});

it.each(['FLEX', 'SEQUENTIAL', 'SPLIT_FLEX', 'SPLIT_SEQUENTIAL'] as const)('restores rotated %s actor packing from domain state', layoutStrategy => {
  let state = stateFor();
  state.zones.byId.z.layoutStrategy = layoutStrategy;
  state = createActor(state, { id: 'a', currentZoneId: 'z', layoutGroup: 'hero' });
  state = createActor(state, { id: 'b', currentZoneId: 'z', layoutGroup: 'enemy' });
  const before = calculateActorPlacementGeometry(state);
  const angle = 38;
  const polygon = state.zones.byId.z.polygon.map(point => rotatePoint(point, angle, center));
  const rotated = updateZoneGeometry(state, 'z', polygon, angle);
  const after = calculateActorPlacementGeometry(JSON.parse(JSON.stringify(rotated)));
  assertPoints(after.map(p => p.point), before.map(p => rotatePoint(p.point, angle, center)));
  expect(after.map(p => p.radius)).toEqual(before.map(p => p.radius));
  const validated = prepareValidatedEncounterChange({ currentEncounter: state, nextEncounter: rotated,
    action: createEncounterActionRecord('zone.reshape', { zoneId: 'z', polygon, rotation: angle }) });
  expect(validated.blocked).toBe(false);
  assertPoints(validated.nextEncounter.zones.byId.z.polygon, polygon);
});


it('rotates settled engagement centers together with participants', () => {
  let state = stateFor();
  state = createActor(state, { id: 'a', currentZoneId: 'z' });
  state = createActor(state, { id: 'b', currentZoneId: 'z' });
  state = createEngagement(state, { id: 'e', parentZoneId: 'z', participantIds: ['a', 'b'] });
  const before = calculateActorPlacementGeometry(state);
  const angle = 40;
  const rotated = updateZoneGeometry(state, 'z', state.zones.byId.z.polygon.map(point => rotatePoint(point, angle, center)), angle);
  const after = calculateActorPlacementGeometry(rotated);
  assertPoints(after.map(p => p.point), before.map(p => rotatePoint(p.point, angle, center)));
  assertPoints(after.map(p => p.engagementTokenPoint!), before.map(p => rotatePoint(p.engagementTokenPoint!, angle, center)));
});

it('keeps a rotated rectangle oriented when actor-fit validation enlarges it', () => {
  let state = stateFor();
  state = createActor(state, { id: 'a', currentZoneId: 'z' });
  const rotation = 31;
  const small = [{ x: 280, y: 230 }, { x: 320, y: 230 }, { x: 320, y: 270 }, { x: 280, y: 270 }]
    .map(point => rotatePoint(point, rotation, center));
  const candidate = updateZoneGeometry(state, 'z', small, rotation);
  const prepared = prepareValidatedEncounterChange({ currentEncounter: state, nextEncounter: candidate,
    action: createEncounterActionRecord('zone.reshape', { zoneId: 'z', polygon: small, rotation }) });
  expect(prepared.blocked).toBe(false);
  const zone = prepared.nextEncounter.zones.byId.z;
  expect(zone.rotation).toBe(rotation);
  const local = getZoneLocalPolygon(zone);
  expect(local[0].y).toBeCloseTo(local[1].y);
  expect(local[1].x).toBeCloseTo(local[2].x);
  expect(local[2].y).toBeCloseTo(local[3].y);
  expect(local[3].x).toBeCloseTo(local[0].x);
  expect(local[1].x - local[0].x).toBeGreaterThan(40);
});

it('composes a pending rotation with the next actor preview', async () => {
  const { renderHook } = await import('@testing-library/react');
  const { useZoneActorTranslation } = await import('@ui/canvas/useZoneActorTranslation');
  const { transformZoneActorPoint } = await import('@ui/canvas/actors/actorPlacementTranslation');
  const state = stateFor();
  const source = state.zones.byId.z.polygon.map(point => rotatePoint(point, 90, center));
  const final = state.zones.byId.z.polygon.map(point => rotatePoint(point, 120, center));
  const { result } = renderHook(() => useZoneActorTranslation(state, null, {
    zoneId: 'z', vertexIndex: -1, polygon: final, hasMoved: true, handleStart: { x: 300, y: 100 },
    rotation: 120, rotationSource: { rotation: 90, polygon: source, center }
  }));
  const point = { x: 230, y: 240 };
  assertPoints([transformZoneActorPoint(point, 'z', result.current)], [rotatePoint(point, 120, center)]);
});

it('recomputes locked grid placements instead of persisting off-grid rotated centers', async () => {
  const { snapToGrid } = await import('@core/movement/gridGeometry');
  const { resolveGridGeometry } = await import('@core/movement/gridScale');
  let state = stateFor();
  state.movementRules.snapToGrid = true;
  state = createActor(state, { id: 'a', currentZoneId: 'z' });
  state = createActor(state, { id: 'b', currentZoneId: 'z' });
  const angle = 28;
  const polygon = state.zones.byId.z.polygon.map(point => rotatePoint(point, angle, center));
  const candidate = updateZoneGeometry(state, 'z', polygon, angle);
  const prepared = prepareValidatedEncounterChange({ currentEncounter: state, nextEncounter: candidate,
    action: createEncounterActionRecord('zone.reshape', { zoneId: 'z', polygon, rotation: angle }) });
  expect(prepared.blocked).toBe(false);
  const placements = calculateActorPlacementGeometry(prepared.nextEncounter);
  expect(placements).toHaveLength(2);
  for (const placement of placements) {
    expect(placement.point).toEqual(snapToGrid(resolveGridGeometry(state.grid), placement.point, state.actors.byId[placement.actorId].size));
  }
});
