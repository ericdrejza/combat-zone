import type { EncounterState } from '../encounter/types';
import { toNestingActor } from '../layout/actorFootprints';
import { packEngagementParticipants } from '../layout/engagementPacking';
import { isPolygonWithinCanvas } from '../layout/polygonCanvasBounds';
import { orderActorsForEngagementPacking } from '../layout/engagementPackingOrder';
import { findSmallestPolygonFlexZoneExpansion } from '../layout/polygonFlexZoneExpansion';
import { doPolygonsOverlap } from '../layout/polygonCollision';
import {
  findSmallestPolygonFlexZoneFit,
  type PolygonFlexZoneFit
} from '../layout/polygonFlexZoneFit';
import type { NestingActor } from '../layout/nesting_ts';
import { packPolygonActors } from '../layout/nesting_ts';
import type { LayoutPoint } from '../layout/types';
import type { Zone } from '@entities/zone/types';
import type { ValidationAction } from './types';

export function isZoneLayoutChange(action: ValidationAction): boolean {
  if (
    action.type !== 'zone.updateProperties' &&
    action.type !== 'zone.exportProperties'
  ) {
    return false;
  }

  const properties = action.payload.properties;

  return Boolean(
    properties &&
      typeof properties === 'object' &&
      !Array.isArray(properties) &&
      (typeof properties.layoutStrategy === 'string' ||
        typeof properties.layoutOrientation === 'string')
  );
}

function getPolygonNestingStrategy(
  strategy: Zone['layoutStrategy']
): 'FLEX' | 'SEQUENTIAL' | 'SPLIT_FLEX' | 'SPLIT_SEQUENTIAL' {
  return strategy === 'SPLIT_FLEX'
    ? 'SPLIT_FLEX'
    : strategy === 'SPLIT_SEQUENTIAL'
      ? 'SPLIT_SEQUENTIAL'
      : strategy === 'SEQUENTIAL'
        ? 'SEQUENTIAL'
        : 'FLEX';
}

function getResizeAnchor(action: ValidationAction): LayoutPoint | undefined {
  const anchor = action.payload.resizeAnchor;

  return anchor &&
    typeof anchor === 'object' &&
    !Array.isArray(anchor) &&
    typeof anchor.x === 'number' &&
    typeof anchor.y === 'number'
    ? { x: anchor.x, y: anchor.y }
    : undefined;
}

function canExpandWithoutZoneOverlap(
  encounter: EncounterState,
  zoneId: string,
  polygon: LayoutPoint[]
): boolean {
  return (
    isPolygonWithinCanvas(polygon) &&
    encounter.zones.allIds.every((otherZoneId) => {
    const otherZone = encounter.zones.byId[otherZoneId];

    return (
      otherZoneId === zoneId ||
      !otherZone ||
      !doPolygonsOverlap(polygon, otherZone.polygon)
    );
    })
  );
}

/** Includes Engagement tokens and routed connectors in non-split resize capacity. */
function engagementLayoutFitsPolygon(
  encounter: EncounterState,
  zoneId: string,
  actors: NestingActor[],
  polygon: LayoutPoint[]
): boolean {
  const zone = encounter.zones.byId[zoneId];
  const hasEngagement = encounter.engagements.allIds.some(
    (engagementId) =>
      encounter.engagements.byId[engagementId]?.parentZoneId === zoneId
  );

  if (
    (zone?.layoutStrategy !== 'FLEX' &&
      zone?.layoutStrategy !== 'SEQUENTIAL') ||
    !hasEngagement
  ) {
    return true;
  }

  const actorPacking = packPolygonActors({
    actors,
    layoutOrientation: zone.layoutOrientation,
    layoutStrategy: zone.layoutStrategy,
    polygon
  });

  if (!actorPacking.fits) {
    return false;
  }

  const placements = actors.flatMap((actor) => {
    const point = actorPacking.placements[actor.id];

    return point
      ? [{ actorId: actor.id, point, radius: actor.radius, shape: actor.shape }]
      : [];
  });
  const encounterWithCandidate = {
    ...encounter,
    zones: {
      ...encounter.zones,
      byId: {
        ...encounter.zones.byId,
        [zoneId]: { ...zone, polygon }
      }
    }
  };

  return (
    placements.length === actors.length &&
    packEngagementParticipants(encounterWithCandidate, placements).fits
  );
}

/** Finds the smallest complete-layout expansion that does not overlap a zone. */
export function findPolygonFlexZoneFit(
  action: ValidationAction,
  encounter: EncounterState,
  zoneId: string,
  polygon: LayoutPoint[],
  actors: NestingActor[]
): PolygonFlexZoneFit | null {
  const isPolygonAllowed = (candidate: LayoutPoint[]) =>
    canExpandWithoutZoneOverlap(encounter, zoneId, candidate);
  const isAdditionalLayoutFit = (candidate: LayoutPoint[]) =>
    engagementLayoutFitsPolygon(encounter, zoneId, actors, candidate);
  const requestedAnchor =
    action.type === 'zone.reshape' ? getResizeAnchor(action) : undefined;

  if (requestedAnchor) {
    return findSmallestPolygonFlexZoneFit(polygon, actors, undefined, {
      anchor: requestedAnchor,
      isAdditionalLayoutFit,
      isPolygonAllowed,
      layoutOrientation: encounter.zones.byId[zoneId]?.layoutOrientation,
      layoutStrategy: getPolygonNestingStrategy(
        encounter.zones.byId[zoneId]?.layoutStrategy ?? 'FLEX'
      )
    });
  }

  const zone = encounter.zones.byId[zoneId];

  return findSmallestPolygonFlexZoneExpansion(polygon, actors, {
    isAdditionalLayoutFit,
    isPolygonAllowed,
    layoutOrientation: zone?.layoutOrientation,
    layoutStrategy: getPolygonNestingStrategy(zone?.layoutStrategy ?? 'FLEX'),
    preserveRectangle: zone?.shape === 'rectangle'
  });
}

export function getNestingActorsInZone(
  encounter: EncounterState,
  zoneId: string,
  _strategy: string
): NestingActor[] {
  const zoneActors = encounter.actors.allIds.flatMap((actorId) => {
    const actor = encounter.actors.byId[actorId];

    return actor && actor.currentZoneId === zoneId ? [actor] : [];
  });

  return orderActorsForEngagementPacking(encounter, zoneActors).map(
    toNestingActor
  );
}
