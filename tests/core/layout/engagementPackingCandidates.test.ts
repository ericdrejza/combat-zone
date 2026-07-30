import { describe, expect, it } from 'vitest';

import {
  engagementClusterEnvelopesAreSeparate,
  footprintFitsPolygon,
  getEngagementParticipantCandidateLayouts
} from '@core/layout/engagementPackingCandidates';
import { getEngagementChainCandidateLayouts } from '@core/layout/engagementChainLayouts';
import {
  ENGAGEMENT_CHAIN_VISIBLE_CLEARANCE,
  getEngagementTokenPoint
} from '@core/layout/engagementPacking';
import { engagementPackingCandidateFits } from '@core/layout/engagementPackingValidation';

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
    expect(footprintFitsPolygon(point, 8, diamond, 2)).toBe(false);
    expect(footprintFitsPolygon({ x: 34, y: 34 }, 8, diamond, 2)).toBe(true);
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
      12
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
      minimumClearance: 2,
      polygon,
      proposed,
      token,
      tokenRadius: 12
    })).toBe(true);
  });

  it('offers a compact multi-ring layout as engagement membership grows', () => {
    const polygon = [
      { x: 0, y: 0 },
      { x: 500, y: 0 },
      { x: 500, y: 360 },
      { x: 0, y: 360 }
    ];
    const layouts = getEngagementParticipantCandidateLayouts(
      { x: 250, y: 180 },
      Array.from({ length: 20 }, () => 30),
      'LEFT_RIGHT',
      'FLEX',
      2,
      12
    );

    expect(layouts.some((points) => {
      const participants = points.map((point, index) => ({
        actorId: `actor-${index}`,
        point,
        radius: 30
      }));
      const token = getEngagementTokenPoint(participants, polygon);

      return (
        points.every((point) => footprintFitsPolygon(point, 30, polygon)) &&
        points.every((point, index) =>
          points.every((other, otherIndex) =>
            index === otherIndex ||
            Math.hypot(point.x - other.x, point.y - other.y) >= 62
          )
        ) &&
        participants.every((participant) =>
          Math.hypot(
            participant.point.x - token.x,
            participant.point.y - token.y
          ) >= 44
        )
      );
    })).toBe(true);
  });

  it('offers elongated and compact token-anchored chains', () => {
    const radii = Array.from({ length: 9 }, () => 30);
    const layouts = getEngagementChainCandidateLayouts(
      { x: 250, y: 180 },
      radii,
      'LEFT_RIGHT',
      6
    );

    expect(layouts.length).toBeGreaterThan(2);
    expect(layouts[0]?.points.every((point) => point.y === 180)).toBe(true);
    expect(layouts.some(({ points }) =>
      new Set(points.map(({ y }) => y)).size > 1
    )).toBe(true);
    expect(layouts.every(({ points, token }) =>
      points.every((point) =>
        Math.hypot(point.x - token.x, point.y - token.y) >= 48
      )
    )).toBe(true);
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
      engagementClusterEnvelopesAreSeparate(right, [left], 2)
    ).toBe(true);
    expect(
      engagementClusterEnvelopesAreSeparate(
        {
          token: { x: 60, y: 100 },
          participants: [{ point: { x: 100, y: 100 } }]
        },
        [left],
        2
      )
    ).toBe(false);
  });
});
