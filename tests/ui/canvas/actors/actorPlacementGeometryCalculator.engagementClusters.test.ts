import { describe, expect, it } from 'vitest';

import { createEncounterState } from '@core/encounter/createEncounterState';
import { distanceToPolygonBoundary } from '@core/layout/polygonGeometry';
import type { Engagement } from '@entities/engagement/types';
import { calculateActorPlacementGeometry } from '@ui/canvas/actors/actorPlacementGeometryCalculator';
import {
  ENGAGEMENT_MINIMUM_CLEARANCE,
  ENGAGEMENT_TOKEN_RADIUS,
  getEngagementTokenPoint
} from '@ui/canvas/engagements/engagementGeometry';
import {
  createCirclePolygonFromBounds,
  createHexagonPolygonFromBounds
} from '@ui/canvas/zones/zoneShapeGeometry';
import { actor, collection, zone } from './actorPlacementGeometryTestSupport';

describe('calculateActorPlacementGeometry engagement clusters', () => {
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
        expect(Math.hypot(placement.point.x - other.point.x, placement.point.y - other.point.y)).toBeGreaterThanOrEqual(placement.radius + other.radius + ENGAGEMENT_MINIMUM_CLEARANCE);
      });
    });
    tokens.forEach((token, tokenIndex) => {
      placements.forEach((placement) => {
        expect(Math.hypot(token.x - placement.point.x, token.y - placement.point.y)).toBeGreaterThanOrEqual(placement.radius + ENGAGEMENT_TOKEN_RADIUS + ENGAGEMENT_MINIMUM_CLEARANCE);
      });
      tokens.slice(tokenIndex + 1).forEach((other) => {
        expect(Math.hypot(token.x - other.x, token.y - other.y)).toBeGreaterThanOrEqual(ENGAGEMENT_TOKEN_RADIUS * 2 + ENGAGEMENT_MINIMUM_CLEARANCE);
      });
    });
  });

  it.each([
    ['circle', createCirclePolygonFromBounds],
    ['hexagon', createHexagonPolygonFromBounds]
  ] as const)(
    'keeps engagement actors at minimum clearance inside %s zone edges',
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
          radius + ENGAGEMENT_MINIMUM_CLEARANCE - 0.01
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
    ).toBeGreaterThanOrEqual(
      clusters[0].reach +
        clusters[1].reach +
        ENGAGEMENT_MINIMUM_CLEARANCE
    );
  });
});
