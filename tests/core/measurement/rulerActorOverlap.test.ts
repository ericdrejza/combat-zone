import { createEncounterState } from '@core/encounter/createEncounterState';
import type { EncounterState } from '@core/encounter/types';
import type { LayoutPoint } from '@core/layout/types';
import { actorOverlapsRuler, rulerOverlapAreas } from '@core/measurement/rulerActorOverlap';
import type { RulerOptions } from '@core/measurement/types';
import type { Actor } from '@entities/actor/types';

const actor: Actor = { id: 'target', name: 'Target', actorType: 'creature', layoutGroup: 'enemy', size: 'medium', shape: 'circle', currentZoneId: 'zoneless', statusEffects: [], metadata: {} };
const state = () => { const value = createEncounterState({ id: 'overlap', name: 'Overlap' }); value.movementRules.snapToGrid = false; return value; };
function footprint(point: LayoutPoint, radius: number, shape: Actor['shape']) {
  const offsets = shape === 'circle' ? Array.from({ length: 128 }, (_, i) => ({ x: radius * Math.cos(i * Math.PI / 64), y: radius * Math.sin(i * Math.PI / 64) }))
    : [{ x: -radius, y: -radius }, { x: radius, y: -radius }, { x: radius, y: radius }, { x: -radius, y: radius }];
  return offsets.map(p => ({ x: p.x + point.x, y: p.y + point.y }));
}
function overlaps(encounter: EncounterState, options: RulerOptions, points: LayoutPoint[], position: LayoutPoint, target = actor, radius = 30) {
  return actorOverlapsRuler(encounter, target, position, footprint(position, radius, target.shape), rulerOverlapAreas(encounter, points, options, 'one', 'corners-or-center'));
}

it('uses exact continuous circle intersection even when the actor center is outside, excluding tangency', () => {
  const encounter = state(), points = [{ x: 128, y: 128 }, { x: 192, y: 128 }];
  expect(overlaps(encounter, { shape: 'circle' }, points, { x: 221.99999, y: 128 })).toBe(true);
  expect(overlaps(encounter, { shape: 'circle' }, points, { x: 222, y: 128 })).toBe(false);
  expect(overlaps(encounter, { shape: 'circle' }, points, { x: 223, y: 128 })).toBe(false);
});
it.each(['rectangle', 'transparent'] as const)('uses the whole %s token footprint for unsnapped area intersections', shape => {
  const encounter = state(), points = [{ x: 128, y: 128 }, { x: 192, y: 192 }], target = { ...actor, shape };
  expect(overlaps(encounter, { shape: 'rectangle' }, points, { x: 220, y: 220 }, target)).toBe(true);
  expect(overlaps(encounter, { shape: 'rectangle' }, points, { x: 224, y: 224 }, target)).toBe(false);
});
it('uses actual cone-sector overlap without extending the cone behind its source', () => {
  const encounter = state(), options = { shape: 'cone' as const, angle: 60 }, points = [{ x: 128, y: 128 }, { x: 256, y: 128 }];
  expect(overlaps(encounter, options, points, { x: 256, y: 128 })).toBe(true);
  expect(overlaps(encounter, options, points, { x: 200, y: 190 })).toBe(true);
  expect(overlaps(encounter, options, points, { x: 90, y: 128 })).toBe(false);
  expect(overlaps(encounter, options, points, { x: 200, y: 240 })).toBe(false);
});
it.each(['circle', 'rectangle'] as const)('only highlights %s actors touched by a path line, including its turns', shape => {
  const encounter = state(), points = [{ x: 128, y: 128 }, { x: 256, y: 128 }, { x: 256, y: 256 }], target = { ...actor, shape };
  expect(overlaps(encounter, { shape: 'path' }, points, { x: 192, y: 128 }, target, 10)).toBe(true);
  expect(overlaps(encounter, { shape: 'path' }, points, { x: 192, y: 139 }, target, 10)).toBe(false);
  expect(overlaps(encounter, { shape: 'path' }, points, { x: 256, y: 224 }, target, 10)).toBe(true);
  expect(overlaps(encounter, { shape: 'path' }, points, { x: 192, y: 192 }, target, 10)).toBe(false);
});
it('compares snapped occupied cells, including large actors whose center is outside the highlighted cells', () => {
  const encounter = state(); encounter.movementRules.snapToGrid = true;
  const points = [{ x: 128, y: 128 }, { x: 192, y: 128 }];
  expect(overlaps(encounter, { shape: 'circle' }, points, { x: 160, y: 160 })).toBe(true);
  expect(overlaps(encounter, { shape: 'circle' }, points, { x: 164, y: 165 })).toBe(true);
  expect(overlaps(encounter, { shape: 'circle' }, points, { x: 224, y: 224 })).toBe(false);
  expect(overlaps(encounter, { shape: 'circle' }, points, { x: 192, y: 192 }, { ...actor, size: 'large' })).toBe(true);
});
it.each(['square', 'isometric', 'hex-flat', 'hex-pointy'] as const)('matches actor cells and ruler highlighted cells on %s grids', type => {
  const encounter = state(); encounter.movementRules.snapToGrid = true; encounter.grid.type = type; encounter.grid.rotation = 13;
  const areas = rulerOverlapAreas(encounter, [{ x: 320, y: 320 }, { x: 512, y: 320 }], { shape: 'circle' }, 'one', 'corners-or-center');
  expect(areas[0].cells.length).toBeGreaterThan(0);
  for (const vertices of areas[0].cells) {
    const center = { x: vertices.reduce((sum, p) => sum + p.x, 0) / vertices.length, y: vertices.reduce((sum, p) => sum + p.y, 0) / vertices.length };
    expect(actorOverlapsRuler(encounter, actor, center, footprint(center, 30, 'circle'), areas)).toBe(true);
  }
});
it('has no overlap region until a second point exists', () => {
  expect(rulerOverlapAreas(state(), [{ x: 128, y: 128 }], { shape: 'circle' }, 'one', 'center')).toEqual([]);
});
