import { getFootprint, isFootprintInsideZone } from '@core/layout/polygonGeometry';
import { getActorRadius, toNestingActor } from '@core/layout/actorFootprints';
import {
  packPolygonFlexActors,
  POLYGON_LAYOUT_SETTINGS
} from '@core/layout/polygonFlexLayout';
import type { Actor } from '@entities/actor/types';
import type { Zone } from '@entities/zone/types';
import {
  getSectionRequiredAxisSize,
  getSplitSectionPolygon,
  type SectionBounds
} from './actorSectionLayout';
import { getPolygonBounds } from './zoneGeometry';
import { FLEX_ZONE_EDGE_GAP } from './actorFlexLayout';

type Bounds = ReturnType<typeof getPolygonBounds>;
type SplitSection = { id: string; items: Array<{ id: string }> };
export type SectionWeight = { id: string; weight: number };

/** Allocates only the minimum rectangular section size needed by each group. */
export function getSplitSectionWeights(
  sections: SplitSection[],
  sectionActors: Map<string, Actor[]>,
  zone: Zone,
  zoneBounds: Bounds,
  topBottom: boolean,
  curved: boolean
): SectionWeight[] {
  const minimumWeights = sections.map((section) => ({
    id: section.id,
    weight: sectionActors.get(section.id)?.length
      ? getSectionRequiredAxisSize(
          sectionActors.get(section.id)!.map((actor) => ({
            radius: getActorRadius(actor)
          })),
          zoneBounds,
          !topBottom
        )
      : 0
  }));

  if (!curved) {
    return minimumWeights;
  }

  return minimumWeights.map((section) => ({
    ...section,
    weight: section.weight
      ? getCurvedSectionRequiredAxisSize(
          section.id,
          sectionActors.get(section.id) ?? [],
          zone,
          zoneBounds,
          minimumWeights,
          topBottom,
          section.weight
        )
      : 0
  }));
}

export function getSplitSectionBounds(
  sectionId: string,
  bounds: Bounds,
  sections: SectionWeight[],
  topBottom: boolean
): SectionBounds {
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
  const sectionWeight = activeSections[sectionIndex].weight;
  const availableSpace = Math.max(0, axisSize - totalWeight);
  const sectionGap =
    activeSections.length > 1
      ? availableSpace / (activeSections.length - 1)
      : 0;
  const offset =
    totalWeight <= axisSize
      ? previousWeight + sectionGap * sectionIndex
      : (previousWeight / totalWeight) * axisSize;
  const size =
    totalWeight <= axisSize
      ? sectionWeight
      : (sectionWeight / totalWeight) * axisSize;

  return topBottom
    ? { ...bounds, y: bounds.y + offset, height: size }
    : { ...bounds, x: bounds.x + offset, width: size };
}

function getSectionBoundsForSize(
  sectionId: string,
  bounds: Bounds,
  sections: SectionWeight[],
  topBottom: boolean,
  size: number
): SectionBounds {
  const activeSections = sections.filter((section) => section.weight > 0);
  const sectionIndex = activeSections.findIndex(
    (section) => section.id === sectionId
  );
  const axisStart = topBottom ? bounds.y : bounds.x;
  const axisSize = topBottom ? bounds.height : bounds.width;
  const axisOffset =
    activeSections.length === 1
      ? 0
      : sectionIndex === 0
        ? 0
        : sectionIndex === activeSections.length - 1
          ? axisSize - size
          : (axisSize - size) / 2;

  return topBottom
    ? { ...bounds, y: axisStart + axisOffset, height: size }
    : { ...bounds, x: axisStart + axisOffset, width: size };
}

function getCurvedSectionRequiredAxisSize(
  sectionId: string,
  actors: Actor[],
  zone: Zone,
  zoneBounds: Bounds,
  sections: SectionWeight[],
  topBottom: boolean,
  minimumSize: number
): number {
  const axisSize = topBottom ? zoneBounds.height : zoneBounds.width;

  for (let size = minimumSize; size <= axisSize; size += 8) {
    const candidateBounds = getSectionBoundsForSize(
      sectionId,
      zoneBounds,
      sections,
      topBottom,
      size
    );
    const packing = packPolygonFlexActors({
      actors: actors.map(toNestingActor),
      polygon: getSplitSectionPolygon(zone.polygon, candidateBounds)
    });
    const fitsZone =
      packing.fits &&
      actors.every((actor) =>
        isFootprintInsideZone(
          getFootprint(
            toNestingActor(actor),
            packing.placements[actor.id],
            FLEX_ZONE_EDGE_GAP,
            POLYGON_LAYOUT_SETTINGS.circleSegments
          ),
          zone.polygon
        )
      );

    if (fitsZone) {
      return size;
    }
  }

  return axisSize;
}
