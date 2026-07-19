import type { EncounterState } from '../encounter/types';
import { toNestingActor } from '../layout/actorFootprints';
import { isPolygonWithinCanvas } from '../layout/polygonCanvasBounds';
import { findSmallestPolygonFlexZoneExpansion } from '../layout/polygonFlexZoneExpansion';
import { doPolygonsOverlap } from '../layout/polygonCollision';
import {
  findSmallestPolygonFlexZoneFit,
  type PolygonFlexZoneFit
} from '../layout/polygonFlexZoneFit';
import type { NestingActor } from '../layout/nesting_ts';
import type { LayoutPoint } from '../layout/types';
import type { ValidationAction } from './types';

export function isAutoResizeActorAddition(action: ValidationAction): boolean {
  return (
    action.type === 'actor.create' ||
    action.type === 'actor.move' ||
    action.type === 'actor.moveMany'
  );
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

/** Finds the smallest actor-fitting expansion that does not overlap a zone. */
export function findPolygonFlexZoneFit(
  action: ValidationAction,
  encounter: EncounterState,
  zoneId: string,
  polygon: LayoutPoint[],
  actors: NestingActor[]
): PolygonFlexZoneFit | null {
  const isPolygonAllowed = (candidate: LayoutPoint[]) =>
    canExpandWithoutZoneOverlap(encounter, zoneId, candidate);
  const requestedAnchor =
    action.type === 'zone.reshape' ? getResizeAnchor(action) : undefined;

  if (requestedAnchor) {
    return findSmallestPolygonFlexZoneFit(polygon, actors, undefined, {
      anchor: requestedAnchor,
      isPolygonAllowed
    });
  }

  const zone = encounter.zones.byId[zoneId];

  return findSmallestPolygonFlexZoneExpansion(polygon, actors, {
    isPolygonAllowed,
    preserveRectangle: zone?.shape === 'rectangle'
  });
}

export function getNestingActorsInZone(
  encounter: EncounterState,
  zoneId: string,
  strategy: string
): NestingActor[] {
  return strategy === 'FLEX'
    ? encounter.actors.allIds.flatMap((actorId) => {
        const actor = encounter.actors.byId[actorId];

        return actor && actor.currentZoneId === zoneId
          ? [toNestingActor(actor)]
          : [];
      })
    : [];
}
