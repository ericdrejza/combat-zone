import { describe, expect, it } from 'vitest';

import { createEncounterState } from '@core/encounter/createEncounterState';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import type { EntityCollection } from '@core/state/entityCollection';
import { prepareValidatedEncounterChange } from '@core/validation/validatedEncounterChange';
import type { Actor } from '@entities/actor/types';
import type { Zone } from '@entities/zone/types';
import reducer, { commitEncounterChange, redoEncounterChange, undoEncounterChange } from '@store/encounterSlice';
import {
  createEngagement,
  engageSelectedActors,
  joinEngagement,
  leaveEngagements,
  mergeEngagements,
  moveActorsPreservingCompleteEngagements,
  updateEngagementProperties
} from '@entities/engagement/engagementMutations';
import { isSameEngagementDrop } from '@entities/engagement/engagementDrop';

function collection<TEntity extends { id: string }>(entities: TEntity[]): EntityCollection<TEntity> {
  return { allIds: entities.map((entity) => entity.id), byId: Object.fromEntries(entities.map((entity) => [entity.id, entity])) };
}

const zoneA: Zone = {
  colorBorder: '#422', colorFill: '#fff', id: 'zone-a', layoutOrientation: 'LEFT_RIGHT', layoutStrategy: 'FLEX', name: 'A', namePosition: 'top-left', opacity: 1,
  polygon: [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 400 }, { x: 0, y: 400 }], shape: 'rectangle', showBorder: true, showName: false, tags: []
};
const zoneB: Zone = { ...zoneA, id: 'zone-b' };
const actor = (id: string, zoneId = zoneA.id): Actor => ({ actorType: 'creature', currentZoneId: zoneId, id, layoutGroup: 'neutral', metadata: {}, name: id, shape: 'circle', size: 'small', statusEffects: [] });
function state() {
  return { ...createEncounterState({ id: 'encounter', name: 'Encounter' }), zones: collection([zoneA, zoneB]), actors: collection([actor('a'), actor('b'), actor('c'), actor('d', zoneB.id)]) };
}

describe('engagement mutations', () => {
  it('creates exactly one transitive group and moves cross-zone members into its parent zone', () => {
    const next = createEngagement(state(), { id: 'melee', parentZoneId: zoneA.id, participantIds: ['a', 'd'] });
    expect(next.engagements.byId.melee?.participantIds).toEqual(['a', 'd']);
    expect(next.actors.byId.d?.currentZoneId).toBe(zoneA.id);
  });

  it('joins, merges, and auto-dissolves within one mutation snapshot', () => {
    const created = createEngagement(state(), { id: 'first', parentZoneId: zoneA.id, participantIds: ['a', 'b'] });
    const joined = joinEngagement(created, 'first', ['c']);
    expect(joined.engagements.byId.first?.participantIds).toEqual(['a', 'b', 'c']);
    const other = createEngagement(joined, { id: 'second', parentZoneId: zoneB.id, participantIds: ['d', 'c'] });
    const merged = mergeEngagements(other, 'second', 'first');
    expect(merged.engagements.allIds).toEqual(['first']);
    expect(merged.engagements.byId.first?.participantIds).toEqual(['a', 'b', 'd', 'c']);
    const left = leaveEngagements(merged, ['a', 'b', 'd']);
    expect(left.engagements.allIds).toEqual([]);
  });

  it('treats a drop onto the same engagement as a no-op rather than disengaging', () => {
    const engaged = createEngagement(state(), { id: 'melee', parentZoneId: zoneA.id, participantIds: ['a', 'b'] });
    expect(isSameEngagementDrop(engaged, ['a'], 'melee')).toBe(true);
    expect(isSameEngagementDrop(engaged, ['a', 'c'], 'melee')).toBe(false);
  });

  it('moves a complete engagement to another zone without changing membership', () => {
    const engaged = createEngagement(state(), {
      id: 'melee',
      parentZoneId: zoneA.id,
      participantIds: ['a', 'b', 'c']
    });
    const moved = moveActorsPreservingCompleteEngagements(
      engaged,
      ['a', 'b', 'c'],
      zoneB.id
    );

    expect(moved.engagements.byId.melee).toEqual({
      ...engaged.engagements.byId.melee,
      parentZoneId: zoneB.id
    });
    expect(
      ['a', 'b', 'c'].map((actorId) => moved.actors.byId[actorId]?.currentZoneId)
    ).toEqual([zoneB.id, zoneB.id, zoneB.id]);
  });

  it('replaces the original group only after a matured hover creates the new engagement', () => {
    const engaged = createEngagement(state(), {
      id: 'original',
      parentZoneId: zoneA.id,
      participantIds: ['a', 'b', 'c']
    });
    const regrouped = createEngagement(engaged, {
      id: 'hover-created',
      parentZoneId: zoneB.id,
      participantIds: ['a', 'b', 'c', 'd']
    });

    expect(regrouped.engagements.allIds).toEqual(['hover-created']);
    expect(regrouped.engagements.byId['hover-created']?.participantIds).toEqual([
      'a',
      'b',
      'c',
      'd'
    ]);
    expect(
      ['a', 'b', 'c', 'd'].map(
        (actorId) => regrouped.actors.byId[actorId]?.currentZoneId
      )
    ).toEqual([zoneB.id, zoneB.id, zoneB.id, zoneB.id]);
  });

  it('removes only a partial dragged selection from its old engagement', () => {
    const engaged = createEngagement(state(), {
      id: 'melee',
      parentZoneId: zoneA.id,
      participantIds: ['a', 'b', 'c']
    });
    const moved = moveActorsPreservingCompleteEngagements(
      engaged,
      ['a'],
      zoneB.id
    );

    expect(moved.engagements.byId.melee?.participantIds).toEqual(['b', 'c']);
    expect(moved.actors.byId.a?.currentZoneId).toBe(zoneB.id);
  });

  it('groups selection independently per zone and leaves unselected old members behind', () => {
    const initial = createEngagement(state(), { id: 'old', parentZoneId: zoneA.id, participantIds: ['a', 'b', 'c'] });
    const next = engageSelectedActors(initial, ['a', 'b', 'd'], (zoneId) => `new-${zoneId}`);
    expect(next.engagements.byId.old).toBeUndefined();
    expect(next.engagements.byId['new-zone-a']?.participantIds).toEqual(['a', 'b']);
  });

  it('updates layout through history with exact undo/redo', () => {
    const initial = createEngagement(state(), { id: 'melee', parentZoneId: zoneA.id, participantIds: ['a', 'b'] });
    const next = updateEngagementProperties(initial, 'melee', { layoutOrientation: 'TOP_BOTTOM', layoutStrategy: 'SEQUENTIAL' });
    let history = reducer(undefined, { type: 'test/init' });
    history = reducer(history, commitEncounterChange({ action: createEncounterActionRecord('seed'), nextEncounter: initial }));
    history = reducer(history, commitEncounterChange({ action: createEncounterActionRecord('engagement.update'), nextEncounter: next }));
    expect(history.present.engagements.byId.melee?.layoutStrategy).toBe('SEQUENTIAL');
    expect(reducer(history, undoEncounterChange()).present).toEqual(initial);
    expect(reducer(reducer(history, undoEncounterChange()), redoEncounterChange()).present).toEqual(next);
  });

  it('STRICT blocks a malformed engagement while ADVISORY allows it with validation messages', () => {
    const strict = { ...state(), validationState: { mode: 'STRICT' as const, messages: [] } };
    const action = createEncounterActionRecord('engagement.create', { parentZoneId: zoneA.id, participantIds: ['a'] });
    expect(prepareValidatedEncounterChange({ action, currentEncounter: strict, nextEncounter: strict }).blocked).toBe(true);
    const advisory = { ...strict, validationState: { mode: 'ADVISORY' as const, messages: [] } };
    const result = prepareValidatedEncounterChange({ action, currentEncounter: advisory, nextEncounter: advisory });
    expect(result.blocked).toBe(false);
    expect(result.validationResult.messages.some((message) => message.code === 'engagement.tooFewParticipants')).toBe(true);
  });

  it('STRICT rejects duplicate and overlapping memberships while ADVISORY reports them', () => {
    const initial = state();
    const malformed = {
      ...initial,
      engagements: collection([
        { id: 'one', parentZoneId: zoneA.id, participantIds: ['a', 'a'], layoutOrientation: 'LEFT_RIGHT' as const, layoutStrategy: 'FLEX' as const },
        { id: 'two', parentZoneId: zoneA.id, participantIds: ['a', 'b'], layoutOrientation: 'LEFT_RIGHT' as const, layoutStrategy: 'FLEX' as const }
      ])
    };
    const action = createEncounterActionRecord('engagement.update', { parentZoneId: zoneA.id, participantIds: ['a', 'b'] });
    const strict = { ...initial, validationState: { mode: 'STRICT' as const, messages: [] } };
    expect(prepareValidatedEncounterChange({ action, currentEncounter: strict, nextEncounter: malformed }).blocked).toBe(true);
    const advisory = { ...strict, validationState: { mode: 'ADVISORY' as const, messages: [] } };
    const result = prepareValidatedEncounterChange({ action, currentEncounter: advisory, nextEncounter: malformed });
    expect(result.blocked).toBe(false);
    expect(result.validationResult.messages.map((message) => message.code)).toContain('engagement.participantInMultipleGroups');
  });
});
