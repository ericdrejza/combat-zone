import { describe, expect, it } from 'vitest';

import { createEncounterState } from '@core/encounter/createEncounterState';
import { ZONELESS_ACTOR_ZONE_ID } from '@core/encounter/types';
import { isPointInPolygon } from '@core/layout/polygonGeometry';
import type { Engagement } from '@entities/engagement/types';
import { calculateActorPlacementGeometry } from '@ui/canvas/actors/actorPlacementGeometryCalculator';
import {
  ENGAGEMENT_MINIMUM_CLEARANCE,
  ENGAGEMENT_TOKEN_RADIUS,
  getEngagementTokenPoint
} from '@ui/canvas/engagements/engagementGeometry';
import { orderActorsForEngagementPacking } from '@core/layout/engagementPackingOrder';
import {
  actor,
  collection,
  zone
} from './actorPlacementGeometryTestSupport';

describe('calculateActorPlacementGeometry', () => {
  it('packs engagements and single actors together by descending token area', () => {
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
      'single-large',
      'small-a',
      'small-b',
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
          participant.radius +
            ENGAGEMENT_TOKEN_RADIUS +
            ENGAGEMENT_MINIMUM_CLEARANCE
        )
      );
    }
  });
});
