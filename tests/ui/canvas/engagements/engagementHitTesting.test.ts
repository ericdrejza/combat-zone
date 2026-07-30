import { describe, expect, it } from 'vitest';

import { createEncounterState } from '@core/encounter/createEncounterState';
import type { EntityCollection } from '@core/state/entityCollection';
import { findEngagementIdAtPoint } from '@ui/canvas/engagements/engagementHitTesting';

function collection<TEntity extends { id: string }>(
  entities: TEntity[]
): EntityCollection<TEntity> {
  return {
    allIds: entities.map(({ id }) => id),
    byId: Object.fromEntries(entities.map((entity) => [entity.id, entity]))
  };
}

describe('engagement hit testing', () => {
  it('uses the packer-approved token instead of a recomputed centroid', () => {
    const actor = (id: string) => ({
      actorType: 'creature' as const,
      currentZoneId: 'zone',
      id,
      layoutGroup: 'neutral' as const,
      metadata: {},
      name: id,
      shape: 'circle' as const,
      size: 'small' as const,
      statusEffects: []
    });
    const actors = [actor('a'), actor('b'), actor('c')];
    const encounter = {
      ...createEncounterState({ id: 'hit-test', name: 'Hit test' }),
      actors: collection(actors),
      engagements: collection([{
        id: 'melee',
        layoutOrientation: 'LEFT_RIGHT' as const,
        layoutStrategy: 'FLEX' as const,
        parentZoneId: 'zone',
        participantIds: ['a', 'b', 'c']
      }])
    };
    const engagementTokenPoint = { x: 50, y: 150 };
    const placements = [
      { actor: actors[0], engagementTokenPoint, point: { x: 100, y: 100 }, radius: 15 },
      { actor: actors[1], engagementTokenPoint, point: { x: 200, y: 100 }, radius: 15 },
      { actor: actors[2], engagementTokenPoint, point: { x: 150, y: 200 }, radius: 15 }
    ];

    expect(
      findEngagementIdAtPoint(encounter, placements, engagementTokenPoint)
    ).toBe('melee');
    expect(
      findEngagementIdAtPoint(encounter, placements, { x: 150, y: 133 })
    ).toBeUndefined();
  });
});
