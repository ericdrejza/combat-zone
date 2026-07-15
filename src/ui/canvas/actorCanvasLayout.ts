import { calculateZoneLayout } from '@core/layout/encounterLayout';
import type { LayoutPoint } from '@core/layout/types';
import type { Actor } from '@entities/actor/types';
import { ACTOR_SIZE_MULTIPLIERS } from '@entities/actor/actorVisuals';
import type { EncounterState } from '@core/encounter/types';
import { getPolygonBounds, isPointInPolygon } from './zoneGeometry';
import { FLEX_ZONE_EDGE_GAP, getFlexActorPoints } from './actorFlexLayout';
import { getSectionActorPoints } from './actorSectionLayout';
import {
  getFlexRadialActorPoints,
  getSequentialRadialActorPoints
} from './actorRadialLayout';

export const ACTOR_TOKEN_BASE_RADIUS = 30;
export { FLEX_ZONE_EDGE_GAP };

export type ActorRenderPlacement = {
  actor: Actor;
  point: LayoutPoint;
  radius: number;
};

type Bounds = ReturnType<typeof getPolygonBounds>;

function getPolygonCenter(polygon: LayoutPoint[]): LayoutPoint {
  const bounds = getPolygonBounds(polygon);

  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2
  };
}

function getCircleZoneRadius(bounds: Bounds): number {
  return Math.min(bounds.width, bounds.height) / 2;
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

function getSplitSectionBounds(
  sectionId: string,
  bounds: ReturnType<typeof getPolygonBounds>,
  sections: Array<{ id: string; weight: number }>,
  topBottom: boolean
) {
  if (sectionId === 'all') {
    return bounds;
  }

  const activeSections = sections.filter((section) => section.weight > 0);
  const sectionIndex = activeSections.findIndex(
    (section) => section.id === sectionId
  );

  if (sectionIndex < 0) {
    return { ...bounds, width: 0, height: 0 };
  }

  const totalWeight = activeSections.reduce(
    (total, section) => total + section.weight,
    0
  );
  const previousWeight = activeSections
    .slice(0, sectionIndex)
    .reduce((total, section) => total + section.weight, 0);
  const axisSize = topBottom ? bounds.height : bounds.width;
  const offset = (previousWeight / totalWeight) * axisSize;
  const size = (activeSections[sectionIndex].weight / totalWeight) * axisSize;

  return topBottom
    ? { ...bounds, y: bounds.y + offset, height: size }
    : { ...bounds, x: bounds.x + offset, width: size };
}

function getSectionWeight(
  section: { items: Array<{ id: string }> },
  actors: Record<string, Actor | undefined>
): number {
  return section.items.reduce(
    (weight, item) =>
      weight +
      (actors[item.id]
        ? getActorRadius(actors[item.id]!) * 2 + FLEX_ZONE_EDGE_GAP
        : ACTOR_TOKEN_BASE_RADIUS * 2 + FLEX_ZONE_EDGE_GAP),
    0
  );
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
    const splitSectionWeights = descriptor.sections.map((section) => ({
      id: section.id,
      weight: section.items.length
        ? getSectionWeight(section, encounter.actors.byId)
        : 0
    }));

    for (const section of descriptor.sections) {
      const sectionActors = section.items.flatMap((item) => {
        const actor = encounter.actors.byId[item.id];

        return actor ? [actor] : [];
      });
      if (sectionActors.length === 0) {
        continue;
      }
      const radialLayout =
        (zone.shape === 'circle' || zone.shape === 'hexagon') &&
        !split &&
        (descriptor.strategy === 'FLEX' ||
          descriptor.strategy === 'SEQUENTIAL');

      if (radialLayout) {
        const radialActors = sectionActors.map((actor) => ({
          actor,
          radius: getActorRadius(actor)
        }));
        const radialPoints =
          descriptor.strategy === 'FLEX'
            ? getFlexRadialActorPoints(
                radialActors,
                getPolygonCenter(zone.polygon),
                getCircleZoneRadius(zoneBounds)
              )
            : getSequentialRadialActorPoints(
                radialActors,
                getPolygonCenter(zone.polygon),
                getCircleZoneRadius(zoneBounds)
              );

        radialActors.forEach(({ actor, radius }, index) => {
          placements.push({
            actor,
            point: radialPoints[index],
            radius
          });
        });
        continue;
      }

      const sectionBounds = getSplitSectionBounds(
        section.id,
        zoneBounds,
        splitSectionWeights,
        topBottom
      );

      const flexLayout =
        descriptor.strategy === 'FLEX' || descriptor.strategy === 'SPLIT_FLEX';
      const splitFlexPoints = split
        ? getSectionActorPoints(
            sectionActors.map((actor) => ({
              radius: getActorRadius(actor)
            })),
            sectionBounds,
            !topBottom,
            flexLayout
          )
        : [];
      const flexPoints = !split && flexLayout
        ? getFlexActorPoints(
            sectionActors.map((actor) => ({
              actor,
              radius: getActorRadius(actor)
            })),
            zone.polygon,
            {
              x: sectionBounds.x + sectionBounds.width / 2,
              y: sectionBounds.y + sectionBounds.height / 2
            }
          )
        : [];

      sectionActors.forEach((actor, index) => {
        const radius = getActorRadius(actor);
        const point = split
          ? splitFlexPoints[index]
          : flexLayout
            ? flexPoints[index]
            : getGridPoint(index, sectionActors.length, sectionBounds, radius);

        placements.push({
          actor,
          point: pullPointInsidePolygon(point, zone.polygon, radius),
          radius
        });
      });
    }
  }

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
