import { createEncounterHistoryState } from '@core/history/types';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import reducer, { commitEncounterChange, undoEncounterChange, redoEncounterChange } from '@store/encounterSlice';
import { changeMovementRules } from '@core/movement/changeMovementRules';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { createZone } from '@entities/zone/zoneMutations';
import { createActor } from '@entities/actor/actorMutations';
import { createEngagement } from '@entities/engagement/engagementMutations';
import { packGridZone } from '@core/movement/gridZonePacking';
import { ENGAGEMENT_TOKEN_RADIUS, ENGAGEMENT_MINIMUM_CLEARANCE } from '@core/layout/engagementGeometryConstants';
import { engagementFootprintsAreSeparate } from '@core/layout/engagementFootprintGeometry';
import { footprintFitsPolygon } from '@core/layout/engagementPackingCandidates';

it('respects group orientation and fits derived Engagement tokens around all snapped actors', () => {
  let state = createZone(createEncounterState({ id: 'groups', name: 'Groups' }), { id: 'z', polygon: [{ x: 0, y: 0 }, { x: 640, y: 0 }, { x: 640, y: 384 }, { x: 0, y: 384 }] });
  for (const id of ['a', 'b', 'c', 'd', 'loose']) state = createActor(state, { id, currentZoneId: 'z' });
  state = createEngagement(state, { id: 'vertical', parentZoneId: 'z', participantIds: ['a', 'b'], layoutStrategy: 'SEQUENTIAL', layoutOrientation: 'TOP_BOTTOM' });
  state = createEngagement(state, { id: 'horizontal', parentZoneId: 'z', participantIds: ['c', 'd'], layoutStrategy: 'SEQUENTIAL', layoutOrientation: 'LEFT_RIGHT' });
  state.movementRules.snapToGrid = true;
  const result = packGridZone(state, 'z');
  expect(result.fits).toBe(true);
  const byId = Object.fromEntries(result.placements.map(p => [p.actorId, p]));
  expect(Math.abs(byId.a.point.y - byId.b.point.y)).toBeGreaterThan(Math.abs(byId.a.point.x - byId.b.point.x));
  expect(Math.abs(byId.c.point.x - byId.d.point.x)).toBeGreaterThan(Math.abs(byId.c.point.y - byId.d.point.y));
  for (const id of ['a', 'c']) {
    const point = byId[id].engagementTokenPoint!;
    expect(footprintFitsPolygon(point, ENGAGEMENT_TOKEN_RADIUS, state.zones.byId.z.polygon, ENGAGEMENT_MINIMUM_CLEARANCE)).toBe(true);
    expect(result.placements.every(actor => engagementFootprintsAreSeparate({ point, radius: ENGAGEMENT_TOKEN_RADIUS }, actor, ENGAGEMENT_MINIMUM_CLEARANCE))).toBe(true);
  }
  expect(engagementFootprintsAreSeparate({ point: byId.a.engagementTokenPoint!, radius: ENGAGEMENT_TOKEN_RADIUS }, { point: byId.c.engagementTokenPoint!, radius: ENGAGEMENT_TOKEN_RADIUS }, ENGAGEMENT_MINIMUM_CLEARANCE)).toBe(true);
});


it('reconciles multiple cross-Zone groups without dissolving an earlier group on a later group’s draft', () => {
  let state = createZone(createEncounterState({ id: 'relock', name: 'Relock' }), { id: 'home', polygon: [{ x: 0, y: 0 }, { x: 640, y: 0 }, { x: 640, y: 384 }, { x: 0, y: 384 }] });
  state = createZone(state, { id: 'other', polygon: [{ x: 700, y: 0 }, { x: 940, y: 0 }, { x: 940, y: 384 }, { x: 700, y: 384 }] });
  state.movementRules = { ...state.movementRules, zoneLocked: false, snapToGrid: true };
  for (const id of ['a', 'b', 'c', 'd']) state = createActor(state, { id, currentZoneId: 'other' });
  state = createEngagement(state, { id: 'first', parentZoneId: 'home', participantIds: ['a', 'b'] });
  state = createEngagement(state, { id: 'second', parentZoneId: 'home', participantIds: ['c', 'd'] });
  const next = changeMovementRules(state, { zoneLocked: true }, {});
  expect(next.engagements.allIds).toEqual(['first', 'second']);
  expect(next.actors.allIds.every(id => next.actors.byId[id].currentZoneId === 'home')).toBe(true);
  expect(packGridZone(next, 'home').fits).toBe(true);
  let history = reducer(createEncounterHistoryState(state), commitEncounterChange({ action: createEncounterActionRecord('movement.updateRules'), nextEncounter: next }));
  history = reducer(history, undoEncounterChange()); expect(history.present).toEqual(state);
  history = reducer(history, redoEncounterChange()); expect(history.present).toEqual(next);
});


it('dissolves a group with no token room without unplacing its individually fitting actors', () => {
  let state = createZone(createEncounterState({ id: 'tight', name: 'Tight' }), { id: 'z', polygon: [{ x: 0, y: 0 }, { x: 128, y: 0 }, { x: 128, y: 64 }, { x: 0, y: 64 }] });
  state.movementRules = { ...state.movementRules, zoneLocked: false, snapToGrid: true };
  for (const id of ['a', 'b']) state = createActor(state, { id, currentZoneId: 'z' });
  state = createEngagement(state, { id: 'g', parentZoneId: 'z', participantIds: ['a', 'b'] });
  const next = changeMovementRules(state, { zoneLocked: true }, {});
  expect(next.engagements.allIds).toEqual([]);
  expect(next.actors.allIds.every(id => next.actors.byId[id].currentZoneId === 'z')).toBe(true);
  expect(packGridZone(next, 'z').fits).toBe(true);
});
