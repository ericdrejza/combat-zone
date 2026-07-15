import { calculateZoneLayout } from '@core/layout/encounterLayout';
import type { LayoutPoint } from '@core/layout/types';
import type { Actor } from '@entities/actor/types';
import type { EncounterState } from '@core/encounter/types';
import {
  ACTOR_TOKEN_BASE_RADIUS,
  getActorRadius,
  toNestingActor
} from '@core/layout/actorFootprints';
import {
  packPolygonFlexActors,
  packPolygonSequentialActors,
  POLYGON_LAYOUT_SETTINGS
} from '@core/layout/polygonFlexLayout';
import { getPolygonBounds, isPointInPolygon } from './zoneGeometry';
import { FLEX_ZONE_EDGE_GAP, getFlexActorPoints } from './actorFlexLayout';
import {
  getSectionActorPoints,
  getSplitSectionPolygon
} from './actorSectionLayout';
import {
  getSplitSectionBounds,
  getSplitSectionWeights
} from './actorSplitLayout';
import {
  createActorPlacementCacheKey,
  getCachedActorPlacementGeometry,
  type ActorPlacementGeometry
} from './actorPlacementCache';

export { findZoneIdAtPoint } from './zoneHitTesting';

export { ACTOR_TOKEN_BASE_RADIUS, FLEX_ZONE_EDGE_GAP };

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

function calculateActorRenderPlacementGeometry(
  encounter: EncounterState
): ActorPlacementGeometry[] {
  const placements: ActorPlacementGeometry[] = [];

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
    const sectionActorsById = new Map(
      descriptor.sections.map((section) => [
        section.id,
        section.items.flatMap((item) => {
          const actor = encounter.actors.byId[item.id];

          return actor ? [actor] : [];
        })
      ])
    );
    const splitSectionWeights = getSplitSectionWeights(
      descriptor.sections,
      sectionActorsById,
      zone,
      zoneBounds,
      topBottom,
      split && zone.shape !== 'rectangle'
    );

    for (const section of descriptor.sections) {
      const sectionActors = sectionActorsById.get(section.id) ?? [];
      if (sectionActors.length === 0) {
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
      const polygonLayout =
        !split &&
        (descriptor.strategy === 'FLEX' || descriptor.strategy === 'SEQUENTIAL');
      const splitPolygonResult =
        split && zone.shape !== 'rectangle'
          ? packPolygonFlexActors({
              actors: sectionActors.map(toNestingActor),
              polygon: getSplitSectionPolygon(zone.polygon, sectionBounds)
            })
          : null;
      const splitPoints = split
        ? splitPolygonResult?.fits
          ? sectionActors.map(
              (actor) => splitPolygonResult.placements[actor.id]
            )
          : getSectionActorPoints(
              sectionActors.map((actor) => ({
                radius: getActorRadius(actor)
              })),
              sectionBounds,
              !topBottom
            )
        : [];
      const polygonLayoutResult =
        polygonLayout
          ? (descriptor.strategy === 'FLEX'
            ? packPolygonFlexActors({
                actors: sectionActors.map(toNestingActor),
                polygon: zone.polygon
              })
            : packPolygonSequentialActors({
              actors: sectionActors.map(toNestingActor),
              polygon: zone.polygon
            }))
          : null;
      const polygonPoints = polygonLayout
        ? polygonLayoutResult?.fits
          ? sectionActors.map(
              (actor) => polygonLayoutResult.placements[actor.id]
            )
          : flexLayout
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
            : sectionActors.map((actor, index) =>
                getGridPoint(index, sectionActors.length, sectionBounds, getActorRadius(actor))
              )
        : [];

      sectionActors.forEach((actor, index) => {
        const radius = getActorRadius(actor);
        const point = split
          ? splitPoints[index]
          : polygonLayout
            ? polygonPoints[index]
            : getGridPoint(index, sectionActors.length, sectionBounds, radius);

        placements.push({
          actorId: actor.id,
          point:
            split && zone.shape !== 'rectangle'
              ? point
              : pullPointInsidePolygon(point, zone.polygon, radius),
          radius
        });
      });
    }
  }

  return placements;
}

export function getActorRenderPlacements(
  encounter: EncounterState
): ActorRenderPlacement[] {
  const cacheKey = createActorPlacementCacheKey(
    encounter,
    POLYGON_LAYOUT_SETTINGS,
    FLEX_ZONE_EDGE_GAP
  );
  const geometry = getCachedActorPlacementGeometry(cacheKey, () =>
    calculateActorRenderPlacementGeometry(encounter)
  );

  return geometry.flatMap(({ actorId, point, radius }) => {
    const actor = encounter.actors.byId[actorId];

    return actor ? [{ actor, point, radius }] : [];
  });
}
