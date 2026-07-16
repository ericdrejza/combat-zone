import { describe, expect, it } from 'vitest';

import { createEncounterState } from '@core/encounter/createEncounterState';
import { ZONELESS_ACTOR_ZONE_ID } from '@core/encounter/types';
import type { EntityCollection } from '@core/state/entityCollection';
import type { Actor } from '@entities/actor/types';
import type { Zone } from '@entities/zone/types';
import { calculateActorPlacementGeometry } from './actorPlacementGeometryCalculator';

function collection<TEntity extends { id: string }>(
  entities: TEntity[]
): EntityCollection<TEntity> {
  return {
    allIds: entities.map((entity) => entity.id),
    byId: Object.fromEntries(entities.map((entity) => [entity.id, entity]))
  };
}

function actor(id: string, zoneId: string): Actor {
  return {
    actorType: 'creature',
    currentZoneId: zoneId,
    id,
    layoutGroup: 'hero',
    metadata: {},
    name: id,
    shape: 'circle',
    size: 'medium',
    statusEffects: []
  };
}

function zone(id: string, x: number): Zone {
  return {
    colorBorder: '#9b876b',
    colorFill: '#ffffff',
    id,
    layoutOrientation: 'LEFT_RIGHT',
    layoutStrategy: 'FLEX',
    name: id,
    namePosition: 'top-left',
    opacity: 0.7,
    polygon: [
      { x, y: 100 },
      { x: x + 300, y: 100 },
      { x: x + 300, y: 400 },
      { x, y: 400 }
    ],
    shape: 'rectangle',
    showBorder: true,
    showName: false,
    tags: []
  };
}

describe('calculateActorPlacementGeometry', () => {
  it('calculates only the explicitly requested authoritative zones', () => {
    const firstZoneId = 'first-zone';
    const secondZoneId = 'second-zone';
    const encounter = {
      ...createEncounterState({ id: 'geometry-zones', name: 'Geometry' }),
      actors: collection([
        actor('first-actor', firstZoneId),
        actor('second-actor', secondZoneId),
        actor('zoneless-actor', ZONELESS_ACTOR_ZONE_ID)
      ]),
      zones: collection([zone(firstZoneId, 100), zone(secondZoneId, 500)])
    };

    expect(
      calculateActorPlacementGeometry(encounter, [firstZoneId]).map(
        ({ actorId }) => actorId
      )
    ).toEqual(['first-actor']);
  });
});
