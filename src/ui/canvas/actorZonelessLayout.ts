import type { LayoutPoint } from '../../core/layout/types';
import { ZONELESS_ACTOR_ZONE_ID } from '../../core/encounter/types';
import type { Actor } from '../../entities/actor/types';
import type { EncounterState } from '../../core/encounter/types';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from './canvasConstants';
import { getPolygonBounds } from './zoneGeometry';

export const ZONELESS_ACTOR_ZONE_CLEARANCE = 24;
export const ZONELESS_ACTOR_EDGE_PADDING = 24;
export const ZONELESS_ACTOR_GAP = 16;

type Bounds = ReturnType<typeof getPolygonBounds>;

type CornerPlacementOrigin = {
  horizontal: 'left' | 'right';
  vertical: 'top' | 'bottom';
};

type ZonelessActorPlacement = {
  actor: Actor;
  point: LayoutPoint;
  radius: number;
};

function expandBounds(bounds: Bounds, amount: number): Bounds {
  return {
    height: bounds.height + amount * 2,
    width: bounds.width + amount * 2,
    x: bounds.x - amount,
    y: bounds.y - amount
  };
}

function boundsOverlap(first: Bounds, second: Bounds): boolean {
  return (
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y
  );
}

function getActorBounds(point: LayoutPoint, radius: number): Bounds {
  return {
    height: radius * 2,
    width: radius * 2,
    x: point.x - radius,
    y: point.y - radius
  };
}

function isCandidateAvailable(
  point: LayoutPoint,
  radius: number,
  occupiedBounds: Bounds[]
): boolean {
  const candidateBounds = getActorBounds(point, radius);

  return occupiedBounds.every(
    (bounds) => !boundsOverlap(candidateBounds, bounds)
  );
}

function getCornerCandidate(
  origin: CornerPlacementOrigin,
  column: number,
  row: number,
  radius: number
): LayoutPoint {
  const step = radius * 2 + ZONELESS_ACTOR_GAP;
  const leftX = ZONELESS_ACTOR_EDGE_PADDING + radius + column * step;
  const rightX =
    CANVAS_WIDTH - ZONELESS_ACTOR_EDGE_PADDING - radius - column * step;
  const topY = ZONELESS_ACTOR_EDGE_PADDING + radius + row * step;
  const bottomY =
    CANVAS_HEIGHT - ZONELESS_ACTOR_EDGE_PADDING - radius - row * step;

  return {
    x: origin.horizontal === 'left' ? leftX : rightX,
    y: origin.vertical === 'top' ? topY : bottomY
  };
}

function isCandidateInsideCanvas(point: LayoutPoint, radius: number): boolean {
  return (
    point.x - radius >= ZONELESS_ACTOR_EDGE_PADDING &&
    point.x + radius <= CANVAS_WIDTH - ZONELESS_ACTOR_EDGE_PADDING &&
    point.y - radius >= ZONELESS_ACTOR_EDGE_PADDING &&
    point.y + radius <= CANVAS_HEIGHT - ZONELESS_ACTOR_EDGE_PADDING
  );
}

function findZonelessActorPoint(
  radius: number,
  occupiedBounds: Bounds[]
): LayoutPoint {
  const origins: CornerPlacementOrigin[] = [
    { horizontal: 'left', vertical: 'top' },
    { horizontal: 'right', vertical: 'top' },
    { horizontal: 'left', vertical: 'bottom' },
    { horizontal: 'right', vertical: 'bottom' }
  ];
  const maxColumns = Math.ceil(CANVAS_WIDTH / (radius * 2 + ZONELESS_ACTOR_GAP));
  const maxRows = Math.ceil(CANVAS_HEIGHT / (radius * 2 + ZONELESS_ACTOR_GAP));
  const maxLayer = Math.max(maxColumns, maxRows);

  for (let layer = 0; layer <= maxLayer; layer += 1) {
    for (const origin of origins) {
      for (let row = 0; row <= Math.min(layer, maxRows); row += 1) {
        for (
          let column = 0;
          column <= Math.min(layer, maxColumns);
          column += 1
        ) {
          if (Math.max(row, column) !== layer) {
            continue;
          }

          const point = getCornerCandidate(origin, column, row, radius);

          if (
            isCandidateInsideCanvas(point, radius) &&
            isCandidateAvailable(point, radius, occupiedBounds)
          ) {
            return point;
          }
        }
      }
    }
  }

  return {
    x: ZONELESS_ACTOR_EDGE_PADDING + radius,
    y: ZONELESS_ACTOR_EDGE_PADDING + radius
  };
}

export function getZonelessActorRenderPlacements(
  encounter: EncounterState,
  getActorRadius: (actor: Actor) => number
): ZonelessActorPlacement[] {
  const zonelessActors = encounter.actors.allIds
    .map((actorId) => encounter.actors.byId[actorId])
    .filter(
      (actor): actor is Actor => actor?.currentZoneId === ZONELESS_ACTOR_ZONE_ID
    );
  const occupiedBounds = encounter.zones.allIds.flatMap((zoneId) => {
    const zone = encounter.zones.byId[zoneId];

    return zone
      ? [expandBounds(getPolygonBounds(zone.polygon), ZONELESS_ACTOR_ZONE_CLEARANCE)]
      : [];
  });

  return zonelessActors.map((actor) => {
    const radius = getActorRadius(actor);
    const point = findZonelessActorPoint(radius, occupiedBounds);

    occupiedBounds.push(
      expandBounds(getActorBounds(point, radius), ZONELESS_ACTOR_GAP)
    );

    return {
      actor,
      point,
      radius
    };
  });
}
