import { describe, expect, it } from 'vitest';

import { createEncounterState } from '@core/encounter/createEncounterState';
import {
  engagementClusterEnvelopesAreSeparate,
  footprintFitsPolygon,
  getEngagementParticipantCandidateLayouts
} from '@core/layout/engagementPackingCandidates';
import { getEngagementChainCandidateLayouts } from '@core/layout/engagementChainLayouts';
import {
  ENGAGEMENT_CHAIN_VISIBLE_CLEARANCE,
  ENGAGEMENT_MINIMUM_CLEARANCE,
  ENGAGEMENT_TOKEN_RADIUS,
  getEngagementTokenPoint,
  packEngagementParticipants
} from '@core/layout/engagementPacking';
import { engagementPackingCandidateFits } from '@core/layout/engagementPackingValidation';
import type { EntityCollection } from '@core/state/entityCollection';
import { buildActor } from '@entities/actor/actorMutations';
import { createEngagement } from '@entities/engagement/engagementMutations';
import type { Zone } from '@entities/zone/types';

function collection<TEntity extends { id: string }>(
  entities: TEntity[]
): EntityCollection<TEntity> {
  return {
    allIds: entities.map(({ id }) => id),
    byId: Object.fromEntries(entities.map((entity) => [entity.id, entity]))
  };
}

describe('engagement participant candidates', () => {
  it('enforces full circular footprint clearance from sloped zone edges', () => {
    const diamond = [
      { x: 50, y: 0 },
      { x: 100, y: 50 },
      { x: 50, y: 100 },
      { x: 0, y: 50 }
    ];
    const point = { x: 32, y: 32 };

    expect(footprintFitsPolygon(point, 8, diamond)).toBe(true);
    expect(
      footprintFitsPolygon(point, 8, diamond, ENGAGEMENT_MINIMUM_CLEARANCE)
    ).toBe(false);
    expect(
      footprintFitsPolygon(
        { x: 34, y: 34 },
        8,
        diamond,
        ENGAGEMENT_MINIMUM_CLEARANCE
      )
    ).toBe(true);
  });

  it('fits a four-actor chained line with a visible branch gap', () => {
    const polygon = [
      { x: 0, y: 0 },
      { x: 220, y: 0 },
      { x: 220, y: 320 },
      { x: 0, y: 320 }
    ];
    const points = getEngagementParticipantCandidateLayouts(
      { x: 110, y: 160 },
      [30, 30, 30, 30],
      'TOP_BOTTOM',
      'SEQUENTIAL',
      ENGAGEMENT_CHAIN_VISIBLE_CLEARANCE,
      ENGAGEMENT_TOKEN_RADIUS
    )[0];
    const proposed = points.map((point, index) => ({
      actorId: `actor-${index}`,
      point,
      radius: 30
    }));
    const token = getEngagementTokenPoint(proposed, polygon);

    expect(engagementPackingCandidateFits({
      acceptedActors: [],
      acceptedClusters: [],
      acceptedTokens: [],
      actorClearance: ENGAGEMENT_CHAIN_VISIBLE_CLEARANCE,
      minimumClearance: ENGAGEMENT_MINIMUM_CLEARANCE,
      polygon,
      proposed,
      token,
      tokenRadius: ENGAGEMENT_TOKEN_RADIUS
    })).toBe(true);
  });

  it('offers collision-safe compact multi-ring participant layouts as membership grows', () => {
    const polygon = [
      { x: 0, y: 0 },
      { x: 500, y: 0 },
      { x: 500, y: 370 },
      { x: 0, y: 370 }
    ];
    const layouts = getEngagementParticipantCandidateLayouts(
      { x: 250, y: 185 },
      Array.from({ length: 20 }, () => 30),
      'LEFT_RIGHT',
      'FLEX',
      ENGAGEMENT_MINIMUM_CLEARANCE,
      ENGAGEMENT_TOKEN_RADIUS
    );

    expect(layouts.some((points) => {
      const participants = points.map((point, index) => ({
        actorId: `actor-${index}`,
        point,
        radius: 30
      }));
      return (
        points.every((point) => footprintFitsPolygon(point, 30, polygon)) &&
        points.every((point, index) =>
          points.every((other, otherIndex) =>
            index === otherIndex ||
            Math.hypot(point.x - other.x, point.y - other.y) >=
              30 * 2 + ENGAGEMENT_MINIMUM_CLEARANCE
          )
        )
      );
    })).toBe(true);
  });

  it('offers elongated and compact token-anchored chains', () => {
    const radii = Array.from({ length: 9 }, () => 30);
    const chainClearance = 6;
    const layouts = getEngagementChainCandidateLayouts(
      { x: 250, y: 180 },
      radii,
      'LEFT_RIGHT',
      chainClearance
    );

    expect(layouts.length).toBeGreaterThan(2);
    expect(layouts[0]?.points.every((point) => point.y === 180)).toBe(true);
    expect(layouts.some(({ points }) =>
      new Set(points.map(({ y }) => y)).size > 1
    )).toBe(true);
    expect(layouts.every(({ points, token }) =>
      points.every((point) =>
        Math.hypot(point.x - token.x, point.y - token.y) >=
          30 + ENGAGEMENT_TOKEN_RADIUS + chainClearance
      )
    )).toBe(true);
  });

  it('preserves valid actor positions when only connector routing is needed', () => {
    const zone: Zone = {
      colorBorder: '#000000',
      colorFill: '#ffffff',
      id: 'concave-zone',
      layoutOrientation: 'LEFT_RIGHT',
      layoutStrategy: 'FLEX',
      name: 'Concave zone',
      namePosition: 'top-left',
      opacity: 1,
      polygon: [
        { x: 0, y: 0 },
        { x: 120, y: 0 },
        { x: 120, y: 140 },
        { x: 260, y: 140 },
        { x: 260, y: 240 },
        { x: 0, y: 240 }
      ],
      shape: 'polygon',
      showBorder: true,
      showName: false,
      tags: []
    };
    const actors = ['top', 'bottom-left', 'bottom-right'].map((id) =>
      buildActor({ currentZoneId: zone.id, id })
    );
    const encounter = createEngagement(
      {
        ...createEncounterState({ id: 'connector-only', name: 'Connector' }),
        actors: collection(actors),
        zones: collection([zone])
      },
      {
        id: 'concave-engagement',
        parentZoneId: zone.id,
        participantIds: actors.map(({ id }) => id)
      }
    );
    const placements = [
      { actorId: 'top', point: { x: 60, y: 40 }, radius: 30 },
      { actorId: 'bottom-left', point: { x: 60, y: 190 }, radius: 30 },
      { actorId: 'bottom-right', point: { x: 200, y: 190 }, radius: 30 }
    ];
    const packing = packEngagementParticipants(encounter, placements);

    expect(packing.fits).toBe(true);
    expect(packing.placements).toEqual(placements);
    expect(packing.tokenPoints['concave-engagement']).toBeDefined();
  });

  it('separates elongated engagements by token ownership, not circular reach', () => {
    const left = {
      token: { x: 100, y: 100 },
      participants: [
        { point: { x: 40, y: 40 } },
        { point: { x: 40, y: 160 } }
      ]
    };
    const right = {
      token: { x: 220, y: 100 },
      participants: [
        { point: { x: 280, y: 40 } },
        { point: { x: 280, y: 160 } }
      ]
    };

    expect(
      engagementClusterEnvelopesAreSeparate(
        right,
        [left],
        ENGAGEMENT_MINIMUM_CLEARANCE
      )
    ).toBe(true);
    expect(
      engagementClusterEnvelopesAreSeparate(
        {
          token: { x: 60, y: 100 },
          participants: [{ point: { x: 100, y: 100 } }]
        },
        [left],
        ENGAGEMENT_MINIMUM_CLEARANCE
      )
    ).toBe(false);
  });
});
