import { createEncounterState } from '@core/encounter/createEncounterState';
import { coneAngleHandle, draggedConeAngle } from '@core/measurement/coneAngleHandle';
import { measureArea } from '@core/measurement/areaGeometry';
import { resolveGridGeometry } from '@core/movement/gridScale';
import { gridToWorld } from '@core/movement/gridGeometry';

it.each(['square', 'isometric', 'hex-flat', 'hex-pointy'] as const)('places the handle at the actual left arc corner on %s grids', type => {
  const encounter = createEncounterState({ id: 'cone', name: 'Cone' }); encounter.grid.type = type; encounter.grid.rotation = 17;
  for (const snap of [false, true]) {
    encounter.movementRules.snapToGrid = snap;
    const points = [{ x: 256, y: 256 }, { x: 448, y: 300 }], options = { shape: 'cone' as const, angle: 70 };
    const handle = coneAngleHandle(encounter, points, options)!;
    const outline = measureArea(encounter, points[0], points[1], options).outlines[0];
    expect(outline.some(point => Math.hypot(point.x - handle.point.x, point.y - handle.point.y) < 1e-6)).toBe(true);
  }
});
it('maps corner motion toward and away from the midpoint to narrower and wider angles', () => {
  const encounter = createEncounterState({ id: 'cone', name: 'Cone' }); encounter.movementRules.snapToGrid = false;
  const geometry = coneAngleHandle(encounter, [{ x: 128, y: 128 }, { x: 256, y: 128 }], { shape: 'cone', angle: 90 })!;
  const pointAt = (degrees: number, length = 128) => ({ x: 128 + length * Math.cos(degrees * Math.PI / 180), y: 128 + length * Math.sin(degrees * Math.PI / 180) });
  expect(draggedConeAngle(encounter, geometry, geometry.point, pointAt(-15))).toBe(30);
  expect(draggedConeAngle(encounter, geometry, geometry.point, pointAt(-60))).toBe(120);
  expect(draggedConeAngle(encounter, geometry, geometry.point, pointAt(-45, 200))).toBe(90);
  expect(draggedConeAngle(encounter, geometry, geometry.point, pointAt(20))).toBe(1);
  expect(draggedConeAngle(encounter, geometry, geometry.point, pointAt(-120))).toBe(180);
  expect(draggedConeAngle(encounter, geometry, geometry.point, { x: 128, y: 128 })).toBe(90);
});
it('preserves angular grab offset and measures through grid projection/warp', () => {
  const encounter = createEncounterState({ id: 'cone', name: 'Cone' }); encounter.movementRules.snapToGrid = false;
  encounter.grid.type = 'isometric'; encounter.grid.rotation = 31;
  encounter.grid.warp = { type: 'bilinear', x: [0, 1, 0, 0.02], y: [0, 0, 1, 0.01] };
  const grid = resolveGridGeometry(encounter.grid), start = { x: 128, y: 128 };
  const pointAt = (degrees: number) => gridToWorld(grid, { x: start.x + 128 * Math.cos(degrees * Math.PI / 180), y: start.y + 128 * Math.sin(degrees * Math.PI / 180) });
  const geometry = coneAngleHandle(encounter, [gridToWorld(grid, start), pointAt(0)], { shape: 'cone', angle: 90 })!;
  expect(draggedConeAngle(encounter, geometry, pointAt(-43), pointAt(-13))).toBe(30);
});
it('does not expose an angle handle for unfinished, zero-length, or non-cone rulers', () => {
  const encounter = createEncounterState({ id: 'cone', name: 'Cone' }); encounter.movementRules.snapToGrid = false;
  const point = { x: 128, y: 128 };
  expect(coneAngleHandle(encounter, [point], { shape: 'cone' })).toBeNull();
  expect(coneAngleHandle(encounter, [point, point], { shape: 'cone' })).toBeNull();
  expect(coneAngleHandle(encounter, [point, { x: 256, y: 128 }], { shape: 'circle' })).toBeNull();
});
