import { describe, expect, it } from 'vitest';

import { createEncounterState } from '@core/encounter/createEncounterState';
import { ZONELESS_ACTOR_ZONE_ID } from '@core/encounter/types';
import type { EntityCollection } from '@core/state/entityCollection';
import type { Actor } from '@entities/actor/types';
import type { Zone } from '@entities/zone/types';
import type { Engagement } from '@entities/engagement/types';
import {
  distanceToPolygonBoundary,
  isPointInPolygon
} from '@core/layout/polygonGeometry';
import { calculateActorPlacementGeometry } from '@ui/canvas/actors/actorPlacementGeometryCalculator';
import {
  ENGAGEMENT_CHAIN_VISIBLE_CLEARANCE,
  ENGAGEMENT_TOKEN_RADIUS,
  getEngagementTokenPoint,
  routeEngagementConnectorGroups,
  routeEngagementConnectors,
  type EngagementConnector
} from '@ui/canvas/engagements/engagementGeometry';
import { orderActorsForEngagementPacking } from '@core/layout/engagementPackingOrder';
import {
  createCirclePolygonFromBounds,
  createHexagonPolygonFromBounds
} from '@ui/canvas/zones/zoneShapeGeometry';
import { engagementEntitiesAreSeparate } from '@core/validation/engagementEntityOverlap';

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

function expectVisibleActorBranches(
  participants: Array<{ actorId: string; point: { x: number; y: number }; radius: number }>,
  connectors: EngagementConnector[]
): void {
  connectors
    .filter(
      (connector): connector is EngagementConnector & { viaActorId: string } =>
        Boolean(connector.viaActorId)
    )
    .forEach((connector) => {
      const actor = participants.find(
        ({ actorId }) => actorId === connector.actorId
      )!;
      const anchor = participants.find(
        ({ actorId }) => actorId === connector.viaActorId
      )!;
      const visibleSpan =
        Math.hypot(
          actor.point.x - anchor.point.x,
          actor.point.y - anchor.point.y
        ) -
        actor.radius -
        anchor.radius;

      expect(visibleSpan).toBeGreaterThanOrEqual(
        ENGAGEMENT_CHAIN_VISIBLE_CLEARANCE
      );
    });
}

describe('calculateActorPlacementGeometry', () => {
  it('packs larger engagement groups before smaller groups and single actors', () => {
    const zoneId = 'packing-order';
    const actors = [
      { ...actor('single-large', zoneId), size: 'large' as const },
      { ...actor('small-a', zoneId), size: 'small' as const },
      { ...actor('large-a', zoneId), size: 'large' as const },
      { ...actor('small-b', zoneId), size: 'small' as const },
      { ...actor('large-b', zoneId), size: 'large' as const },
      { ...actor('single-small', zoneId), size: 'small' as const }
    ];
    const encounter = {
      ...createEncounterState({ id: 'packing-order', name: 'Packing order' }),
      actors: collection(actors),
      engagements: collection([
        {
          id: 'small-group',
          parentZoneId: zoneId,
          participantIds: ['small-a', 'small-b'],
          layoutOrientation: 'LEFT_RIGHT' as const,
          layoutStrategy: 'FLEX' as const
        },
        {
          id: 'large-group',
          parentZoneId: zoneId,
          participantIds: ['large-a', 'large-b'],
          layoutOrientation: 'LEFT_RIGHT' as const,
          layoutStrategy: 'FLEX' as const
        }
      ])
    };

    expect(
      orderActorsForEngagementPacking(encounter, actors).map(({ id }) => id)
    ).toEqual([
      'large-a',
      'large-b',
      'small-a',
      'small-b',
      'single-large',
      'single-small'
    ]);
  });

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

  it('packs split engagement sections in stable order between hero and neutral sections', () => {
    const zoneId = 'split-zone';
    const splitZone = {
      ...zone(zoneId, 0),
      layoutStrategy: 'SPLIT_SEQUENTIAL' as const,
      polygon: [{ x: 0, y: 0 }, { x: 1200, y: 0 }, { x: 1200, y: 300 }, { x: 0, y: 300 }]
    };
    const actors = [
      { ...actor('hero', zoneId), layoutGroup: 'hero' as const },
      { ...actor('first-a', zoneId), layoutGroup: 'hero' as const },
      { ...actor('first-b', zoneId), layoutGroup: 'enemy' as const },
      { ...actor('second-a', zoneId), layoutGroup: 'hero' as const },
      { ...actor('second-b', zoneId), layoutGroup: 'enemy' as const },
      { ...actor('neutral', zoneId), layoutGroup: 'neutral' as const },
      { ...actor('enemy', zoneId), layoutGroup: 'enemy' as const }
    ];
    const engagements: Engagement[] = [
      { id: 'first', parentZoneId: zoneId, participantIds: ['first-a', 'first-b'], layoutOrientation: 'LEFT_RIGHT', layoutStrategy: 'SEQUENTIAL' },
      { id: 'second', parentZoneId: zoneId, participantIds: ['second-a', 'second-b'], layoutOrientation: 'LEFT_RIGHT', layoutStrategy: 'SEQUENTIAL' }
    ];
    const encounter = { ...createEncounterState({ id: 'split', name: 'Split' }), actors: collection(actors), engagements: collection(engagements), zones: collection([splitZone]) };
    const geometry = calculateActorPlacementGeometry(encounter);
    const placements = new Map(
      geometry.map((placement) => [placement.actorId, placement])
    );
    const averageX = (ids: string[]) =>
      ids.reduce((sum, id) => sum + placements.get(id)!.point.x, 0) /
      ids.length;
    expect(averageX(['hero'])).toBeLessThan(averageX(['first-a', 'first-b']));
    expect(averageX(['first-a', 'first-b'])).toBeLessThan(averageX(['second-a', 'second-b']));
    expect(averageX(['second-a', 'second-b'])).toBeLessThan(averageX(['neutral']));
    expect(averageX(['neutral'])).toBeLessThan(averageX(['enemy']));

    for (const engagement of engagements) {
      const memberPlacements = engagement.participantIds.map(
        (actorId) => placements.get(actorId)!
      );
      const sectionPolygon = memberPlacements[0].sectionPolygon;

      expect(sectionPolygon).toBeDefined();
      expect(memberPlacements[1].sectionPolygon).toEqual(sectionPolygon);
      memberPlacements.forEach(({ point, radius }) => {
        [
          point,
          { x: point.x - radius, y: point.y },
          { x: point.x + radius, y: point.y },
          { x: point.x, y: point.y - radius },
          { x: point.x, y: point.y + radius }
        ].forEach((sample) =>
          expect(isPointInPolygon(sample, sectionPolygon!)).toBe(true)
        );
      });

      const participants = memberPlacements.map(
        ({ actorId, point, radius }) => ({ actorId, point, radius })
      );
      const token = getEngagementTokenPoint(participants, sectionPolygon);

      [
        token,
        { x: token.x - ENGAGEMENT_TOKEN_RADIUS, y: token.y },
        { x: token.x + ENGAGEMENT_TOKEN_RADIUS, y: token.y },
        { x: token.x, y: token.y - ENGAGEMENT_TOKEN_RADIUS },
        { x: token.x, y: token.y + ENGAGEMENT_TOKEN_RADIUS }
      ].forEach((sample) =>
        expect(isPointInPolygon(sample, sectionPolygon!)).toBe(true)
      );
      participants.forEach((participant) =>
        expect(
          Math.hypot(
            token.x - participant.point.x,
            token.y - participant.point.y
          )
        ).toBeGreaterThanOrEqual(
          participant.radius + ENGAGEMENT_TOKEN_RADIUS + 2
        )
      );
    }
  });

  it('keeps three multi-actor engagement clusters and their tokens clear in one FLEX zone', () => {
    const zoneId = 'shared-zone';
    const sharedZone = {
      ...zone(zoneId, 0),
      polygon: [
        { x: 0, y: 0 },
        { x: 960, y: 0 },
        { x: 960, y: 720 },
        { x: 0, y: 720 }
      ]
    };
    const engagements: Engagement[] = [
      { id: 'first', parentZoneId: zoneId, participantIds: ['first-a', 'first-b', 'first-c'], layoutOrientation: 'LEFT_RIGHT', layoutStrategy: 'FLEX' },
      { id: 'second', parentZoneId: zoneId, participantIds: ['second-a', 'second-b', 'second-c'], layoutOrientation: 'TOP_BOTTOM', layoutStrategy: 'SEQUENTIAL' },
      { id: 'third', parentZoneId: zoneId, participantIds: ['third-a', 'third-b', 'third-c'], layoutOrientation: 'LEFT_RIGHT', layoutStrategy: 'FLEX' }
    ];
    const encounter = {
      ...createEncounterState({ id: 'multiple-engagements', name: 'Multiple engagements' }),
      actors: collection(
        engagements.flatMap((engagement) => engagement.participantIds)
          .map((id) => actor(id, zoneId))
      ),
      engagements: collection(engagements),
      zones: collection([sharedZone])
    };
    const placements = calculateActorPlacementGeometry(encounter);
    const byActorId = new Map(placements.map((placement) => [placement.actorId, placement]));
    const tokens = engagements.map((engagement) =>
      getEngagementTokenPoint(
        engagement.participantIds.map((actorId) => byActorId.get(actorId)!),
        sharedZone.polygon
      )
    );

    placements.forEach((placement, index) => {
      placements.slice(index + 1).forEach((other) => {
        expect(Math.hypot(placement.point.x - other.point.x, placement.point.y - other.point.y)).toBeGreaterThanOrEqual(placement.radius + other.radius + 2);
      });
    });
    tokens.forEach((token, tokenIndex) => {
      placements.forEach((placement) => {
        expect(Math.hypot(token.x - placement.point.x, token.y - placement.point.y)).toBeGreaterThanOrEqual(placement.radius + ENGAGEMENT_TOKEN_RADIUS + 2);
      });
      tokens.slice(tokenIndex + 1).forEach((otherToken) => {
        expect(Math.hypot(token.x - otherToken.x, token.y - otherToken.y)).toBeGreaterThanOrEqual(ENGAGEMENT_TOKEN_RADIUS * 2 + 2);
      });
    });
  });

  it('preserves safe token points and complete lines for 8/4/3 engagements', () => {
    const zoneId = 'mixed-large-engagements';
    const groups = [8, 4, 3].map((count, groupIndex) => ({
      id: `group-${groupIndex}`,
      participantIds: Array.from(
        { length: count },
        (_, actorIndex) => `group-${groupIndex}-actor-${actorIndex}`
      )
    }));
    const actors = groups.flatMap((group) =>
      group.participantIds.map((id, index) => ({
        ...actor(id, zoneId),
        shape: index % 2 === 0 ? 'rectangle' as const : 'circle' as const
      }))
    );
    const engagements: Engagement[] = groups.map((group) => ({
      ...group,
      layoutOrientation: 'LEFT_RIGHT',
      layoutStrategy: 'FLEX',
      parentZoneId: zoneId
    }));
    const encounter = {
      ...createEncounterState({
        id: 'mixed-large-engagements',
        name: 'Mixed large engagements'
      }),
      actors: collection(actors),
      engagements: collection(engagements),
      zones: collection([{
        ...zone(zoneId, 0),
        polygon: [
          { x: 0, y: 0 },
          { x: 680, y: 0 },
          { x: 680, y: 520 },
          { x: 0, y: 520 }
        ]
      }])
    };
    const placements = calculateActorPlacementGeometry(encounter);
    const byActorId = new Map(
      placements.map((placement) => [placement.actorId, placement])
    );
    const connectorGroups = engagements.map((engagement) => {
      const participants = engagement.participantIds.map(
        (actorId) => byActorId.get(actorId)!
      );
      const token = participants[0].engagementTokenPoint;

      expect(token).toBeDefined();
      placements.forEach((placement) =>
        expect(
          Math.hypot(
            token!.x - placement.point.x,
            token!.y - placement.point.y
          )
        ).toBeGreaterThanOrEqual(
          ENGAGEMENT_TOKEN_RADIUS + placement.radius + 2
        )
      );

      return {
        engagementId: engagement.id,
        participants,
        token: token!
      };
    });
    const routing = routeEngagementConnectorGroups(
      connectorGroups,
      placements
    );

    expect(placements).toHaveLength(15);
    expect(
      engagementEntitiesAreSeparate(
        placements.map((placement) => ({
          ...placement,
          shape: encounter.actors.byId[placement.actorId]!.shape
        })),
        connectorGroups.map(({ token }) => token),
        ENGAGEMENT_TOKEN_RADIUS
      )
    ).toBe(true);
    expect(
      Object.fromEntries(
        engagements.map((engagement) => [
          engagement.id,
          routing.connectorsByEngagementId[engagement.id]?.length
        ])
      )
    ).toEqual(Object.fromEntries(
      engagements.map((engagement) => [
        engagement.id,
        engagement.participantIds.length
      ])
    ));
    expect(routing.complete).toBe(true);
  });

  it.each([
    ['circle', createCirclePolygonFromBounds],
    ['hexagon', createHexagonPolygonFromBounds]
  ] as const)(
    'keeps engagement actors 2px inside %s zone edges',
    (shape, createPolygon) => {
      const zoneId = `${shape}-edge-clearance`;
      const groups = [8, 4, 3].map((count, groupIndex) => ({
        id: `group-${groupIndex}`,
        participantIds: Array.from(
          { length: count },
          (_, actorIndex) => `group-${groupIndex}-actor-${actorIndex}`
        )
      }));
      const encounter = {
        ...createEncounterState({
          id: `${shape}-edge-clearance`,
          name: `${shape} edge clearance`
        }),
        actors: collection(
          groups.flatMap((group) =>
            group.participantIds.map((id) => actor(id, zoneId))
          )
        ),
        engagements: collection<Engagement>(
          groups.map((group) => ({
            ...group,
            layoutOrientation: 'LEFT_RIGHT',
            layoutStrategy: 'FLEX',
            parentZoneId: zoneId
          }))
        ),
        zones: collection([{
          ...zone(zoneId, 0),
          polygon: createPolygon({
            height: 520,
            width: 680,
            x: 0,
            y: 0
          }),
          shape
        }])
      };
      const placements = calculateActorPlacementGeometry(encounter);
      const polygon = encounter.zones.byId[zoneId]!.polygon;

      expect(placements).toHaveLength(15);
      placements.forEach(({ point, radius }) =>
        expect(distanceToPolygonBoundary(point, polygon)).toBeGreaterThanOrEqual(
          radius + 2 - 0.01
        )
      );
    }
  );

  it('keeps a small engagement outside a larger engagement envelope', () => {
    const zoneId = 'uneven-engagements';
    const largeActorIds = Array.from(
      { length: 8 },
      (_, index) => `large-${index}`
    );
    const smallActorIds = ['small-a', 'small-b'];
    const engagements: Engagement[] = [
      {
        id: 'large',
        parentZoneId: zoneId,
        participantIds: largeActorIds,
        layoutOrientation: 'LEFT_RIGHT',
        layoutStrategy: 'FLEX'
      },
      {
        id: 'small',
        parentZoneId: zoneId,
        participantIds: smallActorIds,
        layoutOrientation: 'LEFT_RIGHT',
        layoutStrategy: 'FLEX'
      }
    ];
    const encounter = {
      ...createEncounterState({
        id: 'uneven-engagements',
        name: 'Uneven engagements'
      }),
      actors: collection(
        [...largeActorIds, ...smallActorIds].map((id) => actor(id, zoneId))
      ),
      engagements: collection(engagements),
      zones: collection([{
        ...zone(zoneId, 0),
        polygon: [
          { x: 0, y: 0 },
          { x: 900, y: 0 },
          { x: 900, y: 500 },
          { x: 0, y: 500 }
        ]
      }])
    };
    const placements = calculateActorPlacementGeometry(encounter);
    const byActorId = new Map(
      placements.map((placement) => [placement.actorId, placement])
    );
    const clusters = engagements.map((engagement) => {
      const participants = engagement.participantIds.map(
        (actorId) => byActorId.get(actorId)!
      );
      const token = getEngagementTokenPoint(
        participants,
        encounter.zones.byId[zoneId]?.polygon
      );
      const reach = Math.max(
        ...participants.map(({ point }) =>
          Math.hypot(point.x - token.x, point.y - token.y)
        )
      );

      return { reach, token };
    });

    expect(
      Math.hypot(
        clusters[0].token.x - clusters[1].token.x,
        clusters[0].token.y - clusters[1].token.y
      )
    ).toBeGreaterThanOrEqual(clusters[0].reach + clusters[1].reach + 2);
  });

  it('spreads FLEX engagement participants when the zone has room', () => {
    const zoneId = 'spacious-flex';
    const participants = [actor('a', zoneId), actor('b', zoneId)];
    const encounter = {
      ...createEncounterState({ id: 'spacious', name: 'Spacious' }),
      actors: collection(participants),
      engagements: collection<Engagement>([{
        id: 'melee',
        parentZoneId: zoneId,
        participantIds: ['a', 'b'],
        layoutOrientation: 'LEFT_RIGHT',
        layoutStrategy: 'FLEX'
      }]),
      zones: collection([{
        ...zone(zoneId, 0),
        polygon: [
          { x: 0, y: 0 },
          { x: 500, y: 0 },
          { x: 500, y: 400 },
          { x: 0, y: 400 }
        ]
      }])
    };
    const placements = calculateActorPlacementGeometry(encounter);
    const [first, second] = placements;

    expect(
      Math.hypot(
        first.point.x - second.point.x,
        first.point.y - second.point.y
      )
    ).toBeGreaterThanOrEqual(first.radius + second.radius + 22);
  });

  it.each([
    ['SPLIT_FLEX', 'LEFT_RIGHT'],
    ['SPLIT_SEQUENTIAL', 'LEFT_RIGHT'],
    ['SPLIT_FLEX', 'TOP_BOTTOM'],
    ['SPLIT_SEQUENTIAL', 'TOP_BOTTOM']
  ] as const)(
    'aligns %s engagement actors with the %s divider axis and chains connectors',
    (layoutStrategy, layoutOrientation) => {
    const zoneId = 'split-engagement-line';
    const actorIds = ['a', 'b', 'c', 'd'];
    const leftRight = layoutOrientation === 'LEFT_RIGHT';
    const encounter = {
      ...createEncounterState({ id: 'split-line', name: 'Split line' }),
      actors: collection(actorIds.map((id) => actor(id, zoneId))),
      engagements: collection<Engagement>([{
        id: 'melee',
        parentZoneId: zoneId,
        participantIds: actorIds,
        layoutOrientation: 'LEFT_RIGHT',
        layoutStrategy: 'FLEX'
      }]),
      zones: collection([{
        ...zone(zoneId, 0),
        layoutOrientation,
        layoutStrategy,
        polygon: [
          { x: 0, y: 0 },
          { x: leftRight ? 220 : 320, y: 0 },
          { x: leftRight ? 220 : 320, y: leftRight ? 320 : 220 },
          { x: 0, y: leftRight ? 320 : 220 }
        ]
      }])
    };
    const placements = calculateActorPlacementGeometry(encounter);
    const sectionPolygon = placements[0].sectionPolygon;
    const participants = placements.map(({ actorId, point, radius }) => ({
      actorId,
      point,
      radius
    }));
    const token = getEngagementTokenPoint(participants, sectionPolygon);
    const connectors = routeEngagementConnectors(token, participants, {
      obstacles: participants
    });

    expect(placements).toHaveLength(4);
    placements.forEach((placement) => {
      expect(
        leftRight ? placement.point.x : placement.point.y
      ).toBeCloseTo(
        leftRight ? placements[0].point.x : placements[0].point.y
      );
    });
    expect(
      new Set(
        placements.map(({ point }) => leftRight ? point.y : point.x)
      ).size
    ).toBe(4);
    expect(connectors).toHaveLength(4);
    expect(connectors.some(({ viaActorId }) => viaActorId)).toBe(true);
    expectVisibleActorBranches(participants, connectors);
  });

  it.each([
    ['SPLIT_FLEX', 'LEFT_RIGHT'],
    ['SPLIT_SEQUENTIAL', 'LEFT_RIGHT'],
    ['SPLIT_FLEX', 'TOP_BOTTOM'],
    ['SPLIT_SEQUENTIAL', 'TOP_BOTTOM']
  ] as const)(
    'wraps an eight-actor engagement in %s with %s orientation',
    (layoutStrategy, layoutOrientation) => {
      const zoneId = 'large-split-engagement';
      const actorIds = Array.from({ length: 8 }, (_, index) => `actor-${index}`);
      const encounter = {
        ...createEncounterState({
          id: 'large-split-engagement',
          name: 'Large split engagement'
        }),
        actors: collection(actorIds.map((id) => actor(id, zoneId))),
        engagements: collection<Engagement>([{
          id: 'melee',
          parentZoneId: zoneId,
          participantIds: actorIds,
          layoutOrientation: 'LEFT_RIGHT',
          layoutStrategy: 'FLEX'
        }]),
        zones: collection([{
          ...zone(zoneId, 0),
          layoutOrientation,
          layoutStrategy,
          polygon: [
            { x: 0, y: 0 },
            { x: 500, y: 0 },
            { x: 500, y: 420 },
            { x: 0, y: 420 }
          ]
        }])
      };
      const placements = calculateActorPlacementGeometry(encounter);
      const participants = placements.map(({ actorId, point, radius }) => ({
        actorId,
        point,
        radius
      }));
      const token = getEngagementTokenPoint(
        participants,
        placements[0]?.sectionPolygon
      );
      const connectors = routeEngagementConnectors(token, participants, {
        obstacles: participants
      });

      expect(placements).toHaveLength(actorIds.length);
      expect(connectors).toHaveLength(actorIds.length);
      expect(connectors.some(({ viaActorId }) => viaActorId)).toBe(true);
      expectVisibleActorBranches(participants, connectors);
    }
  );

  it('fills remaining zone space with single actors after placing an engagement', () => {
    const zoneId = 'crowded-zone';
    const crowdedZone = {
      ...zone(zoneId, 0),
      polygon: [
        { x: 0, y: 0 },
        { x: 400, y: 0 },
        { x: 400, y: 300 },
        { x: 0, y: 300 }
      ]
    };
    const actors = Array.from({ length: 10 }, (_, index) =>
      actor(`actor-${index}`, zoneId)
    );
    const engagement: Engagement = {
      id: 'melee',
      parentZoneId: zoneId,
      participantIds: ['actor-0', 'actor-1'],
      layoutOrientation: 'LEFT_RIGHT',
      layoutStrategy: 'FLEX'
    };
    const encounter = {
      ...createEncounterState({ id: 'crowded', name: 'Crowded' }),
      actors: collection(actors),
      engagements: collection([engagement]),
      zones: collection([crowdedZone])
    };
    const placements = calculateActorPlacementGeometry(encounter);
    const participantPlacements = engagement.participantIds.map(
      (actorId) => placements.find((placement) => placement.actorId === actorId)!
    );
    const token = getEngagementTokenPoint(
      participantPlacements,
      crowdedZone.polygon
    );

    expect(placements).toHaveLength(actors.length);
    placements.forEach((placement, index) => {
      placements.slice(index + 1).forEach((other) => {
        expect(
          Math.hypot(
            placement.point.x - other.point.x,
            placement.point.y - other.point.y
          )
        ).toBeGreaterThanOrEqual(placement.radius + other.radius + 2);
      });
      expect(
        Math.hypot(
          placement.point.x - token.x,
          placement.point.y - token.y
        )
      ).toBeGreaterThanOrEqual(
        placement.radius + ENGAGEMENT_TOKEN_RADIUS + 2
      );
    });
  });
});
