import {
  footprintFitsPolygon,
  getPolygonCandidates
} from './engagementPackingCandidates';
import {
  ENGAGEMENT_MINIMUM_CLEARANCE,
  ENGAGEMENT_PREFERRED_CLEARANCE,
  ENGAGEMENT_TOKEN_RADIUS
} from './engagementGeometryConstants';
import type { LayoutPoint } from './types';
import type { ActorShape } from '@entities/actor/types';
import { engagementFootprintsAreSeparate } from './engagementFootprintGeometry';

type TokenParticipant = {
  point: LayoutPoint;
  radius: number;
  shape?: ActorShape;
};

function centerOf(points: readonly LayoutPoint[]): LayoutPoint {
  return points.reduce(
    (result, point) => ({
      x: result.x + point.x / points.length,
      y: result.y + point.y / points.length
    }),
    { x: 0, y: 0 }
  );
}

/**
 * Finds the stable derived token point shared by rendering, hit-testing, and
 * packing. Whole-polygon search is reserved for wrapped split layouts.
 */
export function getEngagementTokenPoint(
  participants: readonly TokenParticipant[],
  polygon?: readonly LayoutPoint[],
  searchWholePolygon = true
): LayoutPoint {
  if (!participants.length) return { x: 0, y: 0 };
  const centroid = centerOf(participants.map(({ point }) => point));
  const fits = (point: LayoutPoint, clearance: number) =>
    participants.every((participant) =>
      engagementFootprintsAreSeparate(
        { point, radius: ENGAGEMENT_TOKEN_RADIUS },
        participant,
        clearance
      )
    ) &&
    (!polygon ||
      footprintFitsPolygon(
        point,
        ENGAGEMENT_TOKEN_RADIUS,
        polygon,
        ENGAGEMENT_MINIMUM_CLEARANCE
      ));

  for (const clearance of [
    ENGAGEMENT_PREFERRED_CLEARANCE,
    ENGAGEMENT_MINIMUM_CLEARANCE
  ]) {
    if (fits(centroid, clearance)) return centroid;
    const largestRadius = Math.max(...participants.map(({ radius }) => radius));
    for (let index = 0; index < 24; index += 1) {
      const angle = (index * Math.PI * 2) / 24;
      const ring =
        largestRadius +
        ENGAGEMENT_TOKEN_RADIUS +
        clearance +
        Math.floor(index / 8) * 12;
      const candidate = {
        x: centroid.x + Math.cos(angle) * ring,
        y: centroid.y + Math.sin(angle) * ring
      };
      if (fits(candidate, clearance)) return candidate;
    }
  }
  if (polygon && searchWholePolygon) {
    const candidate = getPolygonCandidates(centroid, polygon, 8).find(
      (point) => fits(point, ENGAGEMENT_MINIMUM_CLEARANCE)
    );
    if (candidate) return candidate;
  }
  return centroid;
}
