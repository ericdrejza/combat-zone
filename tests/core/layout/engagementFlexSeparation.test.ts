import { describe, expect, it } from 'vitest';

import { createEncounterState } from '@core/encounter/createEncounterState';
import { routeEngagementConnectorGroups } from '@core/layout/engagementConnectorRouting';
import {
  ENGAGEMENT_MINIMUM_CLEARANCE,
  ENGAGEMENT_PREFERRED_CLEARANCE,
  ENGAGEMENT_TOKEN_RADIUS
} from '@core/layout/engagementPacking';
import { orderEngagementPackingCenters } from '@core/layout/engagementPackingLayouts';
import { engagementPackingCandidateFits } from '@core/layout/engagementPackingValidation';
import type { EntityCollection } from '@core/state/entityCollection';
import { engagementEntitiesAreSeparate } from '@core/validation/engagementEntityOverlap';
import type { Actor, ActorSize } from '@entities/actor/types';
import type { Engagement } from '@entities/engagement/types';
import type { Zone } from '@entities/zone/types';
import { calculateActorPlacementGeometry } from '@ui/canvas/actors/actorPlacementGeometryCalculator';

function collection<TEntity extends { id: string }>(
  entities: TEntity[]
): EntityCollection<TEntity> {
  return {
    allIds: entities.map(({ id }) => id),
    byId: Object.fromEntries(entities.map((entity) => [entity.id, entity]))
  };
}

function actor(id: string, size: ActorSize, zoneId: string): Actor {
  return {
    actorType: 'creature',
    currentZoneId: zoneId,
    id,
    layoutGroup: 'hero',
    metadata: {},
    name: id,
    shape: id.endsWith('rectangle') ? 'rectangle' : 'circle',
    size,
    statusEffects: []
  };
}

describe('FLEX engagement separation', () => {
  it('orders candidate centers away from an accepted engagement token', () => {
    const centers = [
      { x: 50, y: 50 },
      { x: 150, y: 50 },
      { x: 250, y: 50 }
    ];
    const polygon = [
      { x: 0, y: 0 },
      { x: 300, y: 0 },
      { x: 300, y: 100 },
      { x: 0, y: 100 }
    ];

    expect(
      orderEngagementPackingCenters(
        centers,
        polygon,
        false,
        [{ x: 40, y: 50 }]
      )[0]
    ).toEqual({ x: 250, y: 50 });
  });

  it('uses more distant engagement regions when the boundary has spare room', () => {
    const polygon = [
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
      { x: 1000, y: 200 },
      { x: 0, y: 200 }
    ];

    expect(
      orderEngagementPackingCenters(
        [{ x: 400, y: 100 }, { x: 800, y: 100 }],
        polygon,
        false,
        [{ x: 100, y: 100 }]
      )[0]
    ).toEqual({ x: 800, y: 100 });
  });

  it('applies preferred clearance between an engagement token and its actors', () => {
    const actorRadius = 30;
    const requiredDistance =
      actorRadius + ENGAGEMENT_TOKEN_RADIUS + ENGAGEMENT_PREFERRED_CLEARANCE;
    const candidateFits = (actorX: number) =>
      engagementPackingCandidateFits({
        acceptedActors: [],
        acceptedClusters: [],
        acceptedTokens: [],
        actorClearance: ENGAGEMENT_PREFERRED_CLEARANCE,
        minimumClearance: ENGAGEMENT_MINIMUM_CLEARANCE,
        polygon: [
          { x: -100, y: -100 },
          { x: 100, y: -100 },
          { x: 100, y: 100 },
          { x: -100, y: 100 }
        ],
        proposed: [
          { actorId: 'actor', point: { x: actorX, y: 0 }, radius: actorRadius }
        ],
        token: { x: 0, y: 0 },
        tokenRadius: ENGAGEMENT_TOKEN_RADIUS
      });

    expect(
      candidateFits(requiredDistance - ENGAGEMENT_MINIMUM_CLEARANCE * 2)
    ).toBe(false);
    expect(candidateFits(requiredDistance)).toBe(true);
  });

  it('fits a new mixed-size engagement away from another group and a loose large actor', () => {
    const zoneId = 'mixed-size-flex';
    const zone: Zone = {
      colorBorder: '#123456',
      colorFill: '#ffffff',
      id: zoneId,
      layoutOrientation: 'LEFT_RIGHT',
      layoutStrategy: 'FLEX',
      name: 'Mixed size FLEX',
      namePosition: 'top-left',
      opacity: 1,
      polygon: [
        { x: 0, y: 0 },
        { x: 360, y: 0 },
        { x: 360, y: 300 },
        { x: 0, y: 300 }
      ],
      shape: 'rectangle',
      showBorder: true,
      showName: false,
      tags: []
    };
    const actors = [
      actor('existing-large', 'large', zoneId),
      actor('existing-medium-rectangle', 'medium', zoneId),
      actor('existing-small', 'small', zoneId),
      actor('new-medium', 'medium', zoneId),
      actor('new-small-rectangle', 'small', zoneId),
      actor('loose-large', 'large', zoneId)
    ];
    const engagements: Engagement[] = [
      {
        id: 'existing',
        layoutOrientation: 'LEFT_RIGHT',
        layoutStrategy: 'FLEX',
        parentZoneId: zoneId,
        participantIds: [
          'existing-large',
          'existing-medium-rectangle',
          'existing-small'
        ]
      },
      {
        id: 'new',
        layoutOrientation: 'LEFT_RIGHT',
        layoutStrategy: 'FLEX',
        parentZoneId: zoneId,
        participantIds: ['new-medium', 'new-small-rectangle']
      }
    ];
    const encounter = {
      ...createEncounterState({ id: 'mixed-size', name: 'Mixed size' }),
      actors: collection(actors),
      engagements: collection(engagements),
      zones: collection([zone])
    };
    const placements = calculateActorPlacementGeometry(encounter);
    const placementById = new Map(
      placements.map((placement) => [placement.actorId, placement])
    );
    const tokenPoints = engagements.map(
      ({ participantIds }) =>
        placementById.get(participantIds[0])?.engagementTokenPoint
    );

    expect(placements).toHaveLength(actors.length);
    expect(tokenPoints.every(Boolean)).toBe(true);
    expect(
      engagementEntitiesAreSeparate(
        placements.map((placement) => ({
          actorId: placement.actorId,
          point: placement.point,
          radius: placement.radius,
          shape: encounter.actors.byId[placement.actorId]?.shape
        })),
        tokenPoints.flatMap((point) => point ? [point] : []),
        ENGAGEMENT_TOKEN_RADIUS
      )
    ).toBe(true);

    const groups = engagements.map((item, index) => ({
      engagementId: item.id,
      participants: item.participantIds.map((actorId) => {
        const placement = placementById.get(actorId)!;
        return {
          actorId,
          point: placement.point,
          radius: placement.radius,
          shape: encounter.actors.byId[actorId]?.shape
        };
      }),
      token: tokenPoints[index]!
    }));
    expect(
      routeEngagementConnectorGroups(
        groups,
        placements.map((placement) => ({
          actorId: placement.actorId,
          point: placement.point,
          radius: placement.radius,
          shape: encounter.actors.byId[placement.actorId]?.shape
        }))
      ).complete
    ).toBe(true);
  });
});
