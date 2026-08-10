import { describe, expect, it } from 'vitest';

import { createEncounterState } from '@core/encounter/createEncounterState';
import type { Engagement } from '@entities/engagement/types';
import { calculateActorPlacementGeometry } from '@ui/canvas/actors/actorPlacementGeometryCalculator';
import {
  ENGAGEMENT_MINIMUM_CLEARANCE,
  ENGAGEMENT_TOKEN_RADIUS,
  getEngagementTokenPoint
} from '@ui/canvas/engagements/engagementGeometry';
import { actor, collection, zone } from './actorPlacementGeometryTestSupport';

describe('calculateActorPlacementGeometry remaining actors', () => {
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
        ).toBeGreaterThanOrEqual(
          placement.radius + other.radius + ENGAGEMENT_MINIMUM_CLEARANCE
        );
      });
      expect(
        Math.hypot(
          placement.point.x - token.x,
          placement.point.y - token.y
        )
      ).toBeGreaterThanOrEqual(
        placement.radius +
          ENGAGEMENT_TOKEN_RADIUS +
          ENGAGEMENT_MINIMUM_CLEARANCE
      );
    });
  });
});
