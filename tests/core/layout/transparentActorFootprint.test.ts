import { createEncounterState } from '@core/encounter/createEncounterState';
import { createActor } from '@entities/actor/actorMutations';
import { toNestingActor } from '@core/layout/actorFootprints';
import { getFootprint } from '@core/layout/polygonGeometry';
import { footprintFitsPolygon } from '@core/layout/engagementPackingCandidates';
import { engagementFootprintsAreSeparate, engagementSegmentClearsFootprint } from '@core/layout/engagementFootprintGeometry';

it('uses the complete square box for unframed actor packing and Zone fit', () => {
  const state = createActor(createEncounterState({ id: 'transparent', name: 'Transparent' }), { currentZoneId: 'zoneless', id: 'a', shape: 'transparent' });
  const nesting = toNestingActor(state.actors.byId.a);
  expect(nesting.shape).toBe('rectangle');
  expect(getFootprint(nesting, { x: 50, y: 50 }, 0, 16)).toEqual([
    { x: 20, y: 20 }, { x: 80, y: 20 }, { x: 80, y: 80 }, { x: 20, y: 80 }
  ]);
  const triangle = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 100 }];
  expect(footprintFitsPolygon({ x: 40, y: 40 }, 12, triangle, 0, 'circle')).toBe(true);
  expect(footprintFitsPolygon({ x: 40, y: 40 }, 12, triangle, 0, 'transparent')).toBe(false);
});

it('reserves square corners against other tokens and engagement connectors', () => {
  const transparent = { point: { x: 50, y: 50 }, radius: 30, shape: 'transparent' as const };
  const circle = { point: { x: 78, y: 78 }, radius: 5, shape: 'circle' as const };
  expect(engagementFootprintsAreSeparate(transparent, circle, 0)).toBe(false);
  expect(engagementFootprintsAreSeparate(circle, transparent, 0)).toBe(false);
  expect(engagementSegmentClearsFootprint({ x: 78, y: 20 }, { x: 78, y: 80 }, transparent, 0)).toBe(false);
});
