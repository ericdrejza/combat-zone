import { describe, expect, it } from 'vitest';

import { createEncounterState } from '@core/encounter/createEncounterState';
import type { EntityCollection } from '@core/state/entityCollection';
import type { Actor } from '@entities/actor/types';
import type { Engagement } from '@entities/engagement/types';
import type { Zone } from '@entities/zone/types';
import { calculateActorPlacementGeometry } from '@ui/canvas/actors/actorPlacementGeometryCalculator';
import {
  createCirclePolygonFromBounds,
  createHexagonPolygonFromBounds
} from '@ui/canvas/zones/zoneShapeGeometry';
import { expectUnderTarget, measure } from './actorPackingPerformanceFixtures';

function collection<TEntity extends { id: string }>(
  entities: TEntity[]
): EntityCollection<TEntity> {
  return {
    allIds: entities.map(({ id }) => id),
    byId: Object.fromEntries(entities.map((entity) => [entity.id, entity]))
  };
}

describe('curved-zone engagement performance', () => {
  it.each([
    ['circle', createCirclePolygonFromBounds],
    ['hexagon', createHexagonPolygonFromBounds]
  ] as const)('packs 8/4/3 engagements efficiently in a %s', (shape, polygon) => {
    const zoneId = `${shape}-performance`;
    const groupSizes = [8, 4, 3];
    const engagements: Engagement[] = groupSizes.map((count, groupIndex) => ({
      id: `group-${groupIndex}`,
      layoutOrientation: 'LEFT_RIGHT',
      layoutStrategy: 'FLEX',
      parentZoneId: zoneId,
      participantIds: Array.from(
        { length: count },
        (_, actorIndex) => `group-${groupIndex}-actor-${actorIndex}`
      )
    }));
    const actors: Actor[] = engagements.flatMap((engagement) =>
      engagement.participantIds.map((id) => ({
        actorType: 'creature',
        currentZoneId: zoneId,
        id,
        layoutGroup: 'neutral',
        metadata: {},
        name: id,
        shape: 'circle',
        size: 'medium',
        statusEffects: []
      }))
    );
    const selectedZone: Zone = {
      colorBorder: '#123456',
      colorFill: '#ffffff',
      id: zoneId,
      layoutOrientation: 'LEFT_RIGHT',
      layoutStrategy: 'FLEX',
      name: `${shape} performance`,
      namePosition: 'top-left',
      opacity: 1,
      polygon: polygon({ height: 520, width: 680, x: 0, y: 0 }),
      shape,
      showBorder: true,
      showName: false,
      tags: []
    };
    const encounter = {
      ...createEncounterState({
        id: `${shape}-performance`,
        name: `${shape} performance`
      }),
      actors: collection(actors),
      engagements: collection(engagements),
      zones: collection([selectedZone])
    };
    const { result, timing } = measure(() =>
      calculateActorPlacementGeometry(encounter)
    );

    expect(result).toHaveLength(actors.length);
    expect(
      new Set(
        result.flatMap(({ engagementTokenPoint }) =>
          engagementTokenPoint
            ? [`${engagementTokenPoint.x}:${engagementTokenPoint.y}`]
            : []
        )
      ).size
    ).toBe(engagements.length);
    expectUnderTarget(`${shape} engagement pack (8/4/3)`, timing);
  });
});
