import { describe, expect, it } from 'vitest';

import { createEncounterState } from '@core/encounter/createEncounterState';
import type { EncounterState } from '@core/encounter/types';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import type { EntityCollection } from '@core/state/entityCollection';
import { createEngagement, engageSelectedActors, joinEngagement, leaveEngagements, mergeEngagements, moveActorsPreservingCompleteEngagements } from '@entities/engagement/engagementMutations';
import reducer, { commitEncounterChange, redoEncounterChange, undoEncounterChange } from '@store/encounterSlice';

function collection<TEntity extends { id: string }>(entities: TEntity[]): EntityCollection<TEntity> {
  return { allIds: entities.map((entity) => entity.id), byId: Object.fromEntries(entities.map((entity) => [entity.id, entity])) };
}
const zone = (id: string) => ({ id, colorBorder: '#000', colorFill: '#fff', layoutOrientation: 'LEFT_RIGHT' as const, layoutStrategy: 'FLEX' as const, name: id, namePosition: 'top-left' as const, opacity: 1, polygon: [{ x: 0, y: 0 }, { x: 800, y: 0 }, { x: 800, y: 300 }, { x: 0, y: 300 }], shape: 'rectangle' as const, showBorder: true, showName: false, tags: [] });
const actor = (id: string, currentZoneId = 'one') => ({ id, actorType: 'creature' as const, currentZoneId, layoutGroup: 'neutral' as const, metadata: {}, name: id, shape: 'circle' as const, size: 'small' as const, statusEffects: [] });
const base = () => ({ ...createEncounterState({ id: 'history', name: 'History' }), zones: collection([zone('one'), zone('two')]), actors: collection([actor('a'), actor('b'), actor('c'), actor('d', 'two')]) });

function assertExactHistory(type: string, before: EncounterState, next: EncounterState) {
  let history = reducer(undefined, { type: 'init' });
  history = reducer(history, commitEncounterChange({ action: createEncounterActionRecord('seed'), nextEncounter: before }));
  history = reducer(history, commitEncounterChange({ action: createEncounterActionRecord(type), nextEncounter: next }));
  expect(reducer(history, undoEncounterChange()).present).toEqual(before);
  expect(reducer(reducer(history, undoEncounterChange()), redoEncounterChange()).present).toEqual(next);
}

describe('engagement history snapshots', () => {
  it('restores create, join, merge, leave/dissolve, and multi-zone group actions exactly', () => {
    const initial = base();
    const created = createEngagement(initial, { id: 'one', parentZoneId: 'one', participantIds: ['a', 'b'] });
    assertExactHistory('engagement.create', initial, created);
    const joined = joinEngagement(created, 'one', ['c']);
    assertExactHistory('engagement.join', created, joined);
    const withSecond = createEngagement(joined, { id: 'two', parentZoneId: 'two', participantIds: ['c', 'd'] });
    const merged = mergeEngagements(withSecond, 'two', 'one');
    assertExactHistory('engagement.merge', withSecond, merged);
    const left = leaveEngagements(merged, ['a', 'b', 'c']);
    assertExactHistory('engagement.leave', merged, left);
    const grouped = engageSelectedActors(initial, ['a', 'b', 'c', 'd'], (zoneId) => `group-${zoneId}`);
    assertExactHistory('engagement.groupSelected', initial, grouped);
    const moved = moveActorsPreservingCompleteEngagements(
      joined,
      ['a', 'b', 'c'],
      'two'
    );
    assertExactHistory('engagement.moveZone', joined, moved);
  });
});
