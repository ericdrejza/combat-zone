import { expect } from 'vitest';

import { ZONELESS_ACTOR_ZONE_ID } from '@core/encounter/types';
import type { EntityCollection } from '@core/state/entityCollection';
import { toNestingActor } from '@core/layout/actorFootprints';
import {
  footprintsOverlap,
  getFootprint,
  isFootprintInsideZone
} from '@core/layout/polygonGeometry';
import { MINIMUM_ACTOR_GAP } from '@core/layout/nestingSpacing';
import { POLYGON_LAYOUT_SETTINGS } from '@core/layout/polygonFlexLayout';
import type { Actor } from '@entities/actor/types';
import type { Zone } from '@entities/zone/types';
import { FLEX_ZONE_EDGE_GAP } from '@ui/canvas/actors/actorCanvasLayout';
import {
  createCirclePolygonFromBounds,
  createHexagonPolygonFromBounds
} from '@ui/canvas/zones/zoneShapeGeometry';

export function collection<TEntity extends { id: string }>(
  entities: TEntity[]
): EntityCollection<TEntity> {
  return {
    allIds: entities.map((entity) => entity.id),
    byId: Object.fromEntries(entities.map((entity) => [entity.id, entity]))
  };
}

export function actor(id: string): Actor {
  return {
    actorType: 'creature',
    currentZoneId: ZONELESS_ACTOR_ZONE_ID,
    id,
    layoutGroup: 'hero',
    metadata: {},
    name: id,
    shape: 'circle',
    size: 'medium',
    statusEffects: []
  };
}

export function zonedActor(id: string, zoneId: string): Actor {
  return {
    ...actor(id),
    currentZoneId: zoneId
  };
}

export function zone(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number
): Zone {
  return {
    colorBorder: '#9b876b',
    colorFill: '#ffffff',
    id,
    layoutOrientation: 'LEFT_RIGHT',
    layoutStrategy: 'FLEX',
    name: id,
    namePosition: 'top-left',
    opacity: 0.7,
    polygon: [
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height }
    ],
    shape: 'rectangle',
    showBorder: true,
    showName: false,
    tags: []
  };
}

export function circleZone(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  layoutStrategy: Zone['layoutStrategy'] = 'FLEX'
): Zone {
  return {
    ...zone(id, x, y, width, height),
    layoutStrategy,
    polygon: createCirclePolygonFromBounds({ height, width, x, y }),
    shape: 'circle'
  };
}

export function polygonZone(
  id: string,
  polygon: Zone['polygon'],
  shape: Zone['shape']
): Zone {
  return {
    ...zone(id, 0, 0, 1, 1),
    polygon,
    shape
  };
}

export function expectPackedPlacements(
  placements: Array<{ actor: Actor; point: { x: number; y: number } }>,
  polygon: Zone['polygon'],
  actorGap = POLYGON_LAYOUT_SETTINGS.actorGap
) {
  const edgeClearanceFootprints = placements.map(({ actor: current, point }) =>
    getFootprint(toNestingActor(current), point, FLEX_ZONE_EDGE_GAP, 16)
  );

  expect(
    edgeClearanceFootprints.every((footprint) =>
      isFootprintInsideZone(footprint, polygon)
    )
  ).toBe(true);

  for (let first = 0; first < placements.length; first += 1) {
    for (let second = first + 1; second < placements.length; second += 1) {
      expect(
        footprintsOverlap(
          getFootprint(
            toNestingActor(placements[first].actor),
            placements[first].point,
            actorGap / 2,
            16
          ),
          getFootprint(
            toNestingActor(placements[second].actor),
            placements[second].point,
            actorGap / 2,
            16
          )
        )
      ).toBe(false);
    }
  }
}

export { FLEX_ZONE_EDGE_GAP, MINIMUM_ACTOR_GAP, POLYGON_LAYOUT_SETTINGS };
export { createHexagonPolygonFromBounds };
export {
  footprintsOverlap,
  getFootprint,
  isFootprintInsideZone,
  toNestingActor
};
