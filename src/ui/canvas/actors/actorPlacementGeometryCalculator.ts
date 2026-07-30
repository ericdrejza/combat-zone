import { calculateZoneLayoutFromEntities } from '@core/layout/encounterLayout';
import type { EncounterState } from '@core/encounter/types';
import type { LayoutPoint } from '@core/layout/types';
import {
  ACTOR_TOKEN_BASE_RADIUS,
  getActorRadius,
  toNestingActor
} from '@core/layout/actorFootprints';
import { getEngagementAwareSplitInput } from '@core/layout/engagementSplitLayout';
import {
  packPolygonFlexActors,
  packPolygonSplitFlexActors,
  packPolygonSequentialActors,
  packPolygonSplitSequentialActors
} from '@core/layout/polygonFlexLayout';
import type { Actor } from '@entities/actor/types';
import type { Engagement } from '@entities/engagement/types';
import { getPolygonBounds, isPointInPolygon } from '../zones/zoneGeometry';
import { orderActorsForEngagementPacking } from '@core/layout/engagementPackingOrder';
import { attachEngagementPlacementGeometry } from './actorEngagementPlacementGeometry';
import { FLEX_ZONE_EDGE_GAP, getFlexActorPoints } from './actorFlexLayout';
import type { ActorPlacementGeometry } from './actorPlacementCache';

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

/**
 * Runs the complete layout calculation in a worker. This module intentionally
 * has no Redux, React, DOM, or Worker dependencies so it can be shared by the
 * worker and the test-only no-Worker fallback.
 */
export function calculateActorPlacementGeometry(
  encounter: EncounterState,
  zoneIds?: readonly string[]
): ActorPlacementGeometry[] {
  const placements: ActorPlacementGeometry[] = [];
  const splitSectionPolygons: Record<string, LayoutPoint[]> = {};
  const requestedZoneIds = zoneIds ? new Set(zoneIds) : undefined;
  const actorsByZone = new Map<string, Actor[]>();
  const engagementsByZone = new Map<string, Engagement[]>();

  for (const actorId of encounter.actors.allIds) {
    const actor = encounter.actors.byId[actorId];

    if (actor) {
      const entries = actorsByZone.get(actor.currentZoneId) ?? [];
      entries.push(actor);
      actorsByZone.set(actor.currentZoneId, entries);
    }
  }

  for (const engagementId of encounter.engagements.allIds) {
    const engagement = encounter.engagements.byId[engagementId];

    if (engagement) {
      const entries = engagementsByZone.get(engagement.parentZoneId) ?? [];
      entries.push(engagement);
      engagementsByZone.set(engagement.parentZoneId, entries);
    }
  }

  for (const zoneId of encounter.zones.allIds) {
    if (requestedZoneIds && !requestedZoneIds.has(zoneId)) {
      continue;
    }

    const zone = encounter.zones.byId[zoneId];

    if (!zone) {
      continue;
    }

    const zoneActors = orderActorsForEngagementPacking(
      encounter,
      actorsByZone.get(zoneId) ?? []
    );
    const descriptor = calculateZoneLayoutFromEntities(
      zone,
      zoneActors,
      engagementsByZone.get(zoneId) ?? []
    ).descriptor;
    const zoneBounds = getPolygonBounds(zone.polygon);
    if (descriptor.strategy === 'SPLIT_FLEX') {
      const splitInput = getEngagementAwareSplitInput(encounter, zoneId);
      const packing = packPolygonSplitFlexActors({
        actors: splitInput.actors,
        layoutOrientation: descriptor.orientation,
        polygon: zone.polygon,
        splitSectionOrder: splitInput.splitSectionOrder
      });

      if (packing.fits) {
        const sectionById = new Map(
          packing.splitSections?.map((section) => [section.id, section.polygon])
        );
        const nestingActorById = new Map(
          splitInput.actors.map((actor) => [actor.id, actor])
        );
        packing.splitSections?.forEach((section) => {
          splitSectionPolygons[`${zone.id}:${section.id}`] = section.polygon;
        });
        zoneActors.forEach((actor) => {
          const point = packing.placements[actor.id];
          const sectionPolygon = sectionById.get(
            nestingActorById.get(actor.id)?.splitSectionId ?? actor.layoutGroup
          );

          if (point) {
            placements.push({
              actorId: actor.id,
              point,
              radius: getActorRadius(actor),
              ...(sectionPolygon ? { sectionPolygon } : {})
            });
          }
        });

        continue;
      }
    }

    if (descriptor.strategy === 'SPLIT_SEQUENTIAL') {
      const splitInput = getEngagementAwareSplitInput(encounter, zoneId);
      const packing = packPolygonSplitSequentialActors({
        actors: splitInput.actors,
        layoutOrientation: descriptor.orientation,
        polygon: zone.polygon,
        splitSectionOrder: splitInput.splitSectionOrder
      });

      if (packing.fits) {
        const sectionById = new Map(
          packing.splitSections?.map((section) => [section.id, section.polygon])
        );
        const nestingActorById = new Map(
          splitInput.actors.map((actor) => [actor.id, actor])
        );
        packing.splitSections?.forEach((section) => {
          splitSectionPolygons[`${zone.id}:${section.id}`] = section.polygon;
        });
        zoneActors.forEach((actor) => {
          const point = packing.placements[actor.id];
          const sectionPolygon = sectionById.get(
            nestingActorById.get(actor.id)?.splitSectionId ?? actor.layoutGroup
          );

          if (point) {
            placements.push({
              actorId: actor.id,
              point,
              radius: getActorRadius(actor),
              ...(sectionPolygon ? { sectionPolygon } : {})
            });
          }
        });

        continue;
      }

      // Invalid imported state must never render footprints outside the zone.
      // The shared validator prevents new states from reaching this branch.
      continue;
    }

    const sectionActorsById = new Map(
      descriptor.sections.map((section) => [
        section.id,
        section.items.flatMap((item) => {
          const actor = encounter.actors.byId[item.id];

          return actor ? [actor] : [];
        })
      ])
    );

    for (const section of descriptor.sections) {
      const sectionActors = sectionActorsById.get(section.id) ?? [];

      if (sectionActors.length === 0) {
        continue;
      }

      const flexLayout = descriptor.strategy === 'FLEX';
      const polygonLayoutResult = flexLayout
        ? packPolygonFlexActors({
            actors: sectionActors.map(toNestingActor),
            polygon: zone.polygon
          })
        : packPolygonSequentialActors({
            actors: sectionActors.map(toNestingActor),
            polygon: zone.polygon
          });
      const polygonPoints = polygonLayoutResult.fits
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
                x: zoneBounds.x + zoneBounds.width / 2,
                y: zoneBounds.y + zoneBounds.height / 2
              }
            )
          : sectionActors.map((actor, index) =>
              getGridPoint(
                index,
                sectionActors.length,
                zoneBounds,
                getActorRadius(actor)
              )
            );

      sectionActors.forEach((actor, index) => {
        const radius = getActorRadius(actor);
        const point = polygonPoints[index];

        placements.push({
          actorId: actor.id,
          point: pullPointInsidePolygon(point, zone.polygon, radius),
          radius
        });
      });
    }
  }

  return attachEngagementPlacementGeometry(
    encounter,
    placements,
    splitSectionPolygons
  );
}

export { ACTOR_TOKEN_BASE_RADIUS, FLEX_ZONE_EDGE_GAP };
