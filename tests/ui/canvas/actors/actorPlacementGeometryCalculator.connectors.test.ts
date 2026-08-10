import { describe, expect, it } from 'vitest';

import { createEncounterState } from '@core/encounter/createEncounterState';
import { type Engagement } from '@entities/engagement/types';
import { calculateActorPlacementGeometry } from '@ui/canvas/actors/actorPlacementGeometryCalculator';
import {
  ENGAGEMENT_MINIMUM_CLEARANCE,
  ENGAGEMENT_TOKEN_RADIUS,
  getEngagementTokenPoint,
  routeEngagementConnectorGroups,
  routeEngagementConnectors
} from '@ui/canvas/engagements/engagementGeometry';
import { engagementEntitiesAreSeparate } from '@core/validation/engagementEntityOverlap';
import {
  actor,
  collection,
  expectVisibleActorBranches,
  zone
} from './actorPlacementGeometryTestSupport';

describe('calculateActorPlacementGeometry engagement connectors', () => {
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
          ENGAGEMENT_TOKEN_RADIUS +
            placement.radius +
            ENGAGEMENT_MINIMUM_CLEARANCE
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
});
