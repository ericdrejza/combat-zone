import { calculateZoneLayout } from '../../core/layout/encounterLayout';
import type { LayoutPoint } from '../../core/layout/types';
import { ZONELESS_ACTOR_ZONE_ID } from '../../core/encounter/types';
import type { Actor } from '../../entities/actor/types';
import { ACTOR_SIZE_MULTIPLIERS } from '../../entities/actor/actorVisuals';
import type { EncounterState } from '../../core/encounter/types';
import { getPolygonBounds, isPointInPolygon } from './zoneGeometry';

export const ACTOR_TOKEN_BASE_RADIUS = 30;

export type ActorRenderPlacement = {
  actor: Actor;
  point: LayoutPoint;
  radius: number;
};

function getPolygonCenter(polygon: LayoutPoint[]): LayoutPoint {
  const bounds = getPolygonBounds(polygon);

  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2
  };
}

function pullPointInsidePolygon(
  point: LayoutPoint,
  polygon: LayoutPoint[],
  radius: number
): LayoutPoint {
  const center = getPolygonCenter(polygon);
  let candidate = point;

  for (let step = 0; step < 12; step += 1) {
    const samplePoints = [
      candidate,
      { x: candidate.x - radius, y: candidate.y },
      { x: candidate.x + radius, y: candidate.y },
      { x: candidate.x, y: candidate.y - radius },
      { x: candidate.x, y: candidate.y + radius }
    ];

    if (samplePoints.every((sample) => isPointInPolygon(sample, polygon))) {
      return candidate;
    }

    candidate = {
      x: candidate.x + (center.x - candidate.x) * 0.3,
      y: candidate.y + (center.y - candidate.y) * 0.3
    };
  }

  return center;
}

function getGridPoint(
  index: number,
  count: number,
  bounds: ReturnType<typeof getPolygonBounds>,
  radius: number
): LayoutPoint {
  const columns = Math.max(1, Math.ceil(Math.sqrt(count)));
  const rows = Math.max(1, Math.ceil(count / columns));
  const column = index % columns;
  const row = Math.floor(index / columns);
  const usableWidth = Math.max(bounds.width - radius * 2, 1);
  const usableHeight = Math.max(bounds.height - radius * 2, 1);

  return {
    x: bounds.x + radius + ((column + 0.5) / columns) * usableWidth,
    y: bounds.y + radius + ((row + 0.5) / rows) * usableHeight
  };
}

function getSectionBounds(
  sectionId: string,
  bounds: ReturnType<typeof getPolygonBounds>,
  split: boolean,
  topBottom: boolean
) {
  if (!split || sectionId === 'all') {
    return bounds;
  }

  if (topBottom) {
    if (sectionId === 'hero') {
      return { ...bounds, height: bounds.height * 0.45 };
    }

    if (sectionId === 'enemy') {
      return {
        ...bounds,
        height: bounds.height * 0.45,
        y: bounds.y + bounds.height * 0.55
      };
    }

    return {
      ...bounds,
      height: bounds.height * 0.1,
      y: bounds.y + bounds.height * 0.45
    };
  }

  if (sectionId === 'hero') {
    return { ...bounds, width: bounds.width * 0.45 };
  }

  if (sectionId === 'enemy') {
    return {
      ...bounds,
      width: bounds.width * 0.45,
      x: bounds.x + bounds.width * 0.55
    };
  }

  return {
    ...bounds,
    width: bounds.width * 0.1,
    x: bounds.x + bounds.width * 0.45
  };
}

function getActorRadius(actor: Actor): number {
  return (
    ACTOR_TOKEN_BASE_RADIUS * ACTOR_SIZE_MULTIPLIERS[actor.size ?? 'medium']
  );
}

export function getActorRenderPlacements(
  encounter: EncounterState
): ActorRenderPlacement[] {
  const placements: ActorRenderPlacement[] = [];

  for (const zoneId of encounter.zones.allIds) {
    const zone = encounter.zones.byId[zoneId];

    if (!zone) {
      continue;
    }

    const descriptor = calculateZoneLayout(encounter, zoneId).descriptor;
    const zoneBounds = getPolygonBounds(zone.polygon);
    const split =
      descriptor.strategy === 'SPLIT_FLEX' ||
      descriptor.strategy === 'SPLIT_SEQUENTIAL';
    const topBottom = descriptor.orientation === 'TOP_BOTTOM';

    for (const section of descriptor.sections) {
      const sectionBounds = getSectionBounds(
        section.id,
        zoneBounds,
        split,
        topBottom
      );

      section.items.forEach((item, index) => {
        const actor = encounter.actors.byId[item.id];

        if (!actor) {
          return;
        }

        const radius = getActorRadius(actor);
        const point = getGridPoint(
          index,
          section.items.length,
          sectionBounds,
          radius
        );

        placements.push({
          actor,
          point: pullPointInsidePolygon(point, zone.polygon, radius),
          radius
        });
      });
    }
  }

  const zonelessActors = encounter.actors.allIds
    .map((actorId) => encounter.actors.byId[actorId])
    .filter(
      (actor): actor is Actor => actor?.currentZoneId === ZONELESS_ACTOR_ZONE_ID
    );

  zonelessActors.forEach((actor, index) => {
    const radius = getActorRadius(actor);

    placements.push({
      actor,
      point: {
        x: 48 + index * 40,
        y: 48
      },
      radius
    });
  });

  return placements;
}

export function findZoneIdAtPoint(
  encounter: EncounterState,
  point: LayoutPoint
): string | undefined {
  return [...encounter.zones.allIds].reverse().find((zoneId) => {
    const zone = encounter.zones.byId[zoneId];

    return zone ? isPointInPolygon(point, zone.polygon) : false;
  });
}
