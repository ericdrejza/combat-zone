import { describe, expect, it } from 'vitest';

import { createEncounterState } from '@core/encounter/createEncounterState';
import { ZONELESS_ACTOR_ZONE_ID } from '@core/encounter/types';
import type { EntityCollection } from '@core/state/entityCollection';
import type { Actor } from '@entities/actor/types';
import type { Zone } from '@entities/zone/types';
import { RADIAL_ACTOR_GAP } from './actorRadialLayout';
import {
  ACTOR_TOKEN_BASE_RADIUS,
  FLEX_ZONE_EDGE_GAP,
  getActorRenderPlacements
} from './actorCanvasLayout';
import { cacheActorRenderPlacementsForZoneMove } from './actorPlacementTranslation';
import {
  createCirclePolygonFromBounds,
  createHexagonPolygonFromBounds
} from './zoneShapeGeometry';
import {
  footprintsOverlap,
  getFootprint,
  isFootprintInsideZone
} from '@core/layout/polygonGeometry';
import { toNestingActor } from '@core/layout/actorFootprints';

function collection<TEntity extends { id: string }>(
  entities: TEntity[]
): EntityCollection<TEntity> {
  return {
    allIds: entities.map((entity) => entity.id),
    byId: Object.fromEntries(entities.map((entity) => [entity.id, entity]))
  };
}

function actor(id: string): Actor {
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

function zonedActor(id: string, zoneId: string): Actor {
  return {
    ...actor(id),
    currentZoneId: zoneId
  };
}

function zone(
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

function circleZone(
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

function polygonZone(
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

function expectPackedPlacements(
  placements: ReturnType<typeof getActorRenderPlacements>,
  polygon: Zone['polygon']
) {
  const edgeClearanceFootprints = placements.map(({ actor, point }) =>
    getFootprint(toNestingActor(actor), point, FLEX_ZONE_EDGE_GAP, 16)
  );

  expect(edgeClearanceFootprints.every((footprint) =>
    isFootprintInsideZone(footprint, polygon)
  )).toBe(true);

  for (let first = 0; first < placements.length; first += 1) {
    for (let second = first + 1; second < placements.length; second += 1) {
      expect(
        footprintsOverlap(
          getFootprint(
            toNestingActor(placements[first].actor),
            placements[first].point,
            8,
            16
          ),
          getFootprint(
            toNestingActor(placements[second].actor),
            placements[second].point,
            8,
            16
          )
        )
      ).toBe(false);
    }
  }
}

describe('actor canvas layout', () => {
  it('centers the only FLEX actor in a zone', () => {
    const zoneId = 'rectangle-zone';
    const encounter = {
      ...createEncounterState({ id: 'encounter-flex-center', name: 'Flex' }),
      actors: collection([zonedActor('actor-only', zoneId)]),
      zones: collection([zone(zoneId, 100, 120, 300, 200)])
    };

    const placement = getActorRenderPlacements(encounter)[0];

    expect(placement.point).toEqual({ x: 250, y: 220 });
  });

  it('uses polygon packing for FLEX actors with actor and edge separation', () => {
    const zoneId = 'rectangle-zone';
    const encounter = {
      ...createEncounterState({ id: 'encounter-flex-spacing', name: 'Flex' }),
      actors: collection([
        zonedActor('actor-first', zoneId),
        zonedActor('actor-second', zoneId)
      ]),
      zones: collection([zone(zoneId, 100, 100, 300, 300)])
    };
    const placements = getActorRenderPlacements(encounter);
    const first = placements[0];
    const second = placements[1];

    expect(first.point).toEqual({ x: 354, y: 250 });
    expect(second.point).toEqual({ x: 146, y: 250 });
    expect(
      Math.hypot(
        first.point.x - second.point.x,
        first.point.y - second.point.y
      )
    ).toBeGreaterThanOrEqual(first.radius + second.radius);
    expect(first.point.x + first.radius).toBeLessThanOrEqual(
      400 - FLEX_ZONE_EDGE_GAP
    );
    expect(first.point.y - first.radius).toBeGreaterThanOrEqual(
      100 + FLEX_ZONE_EDGE_GAP
    );
  });

  it('gives split FLEX sections space based on non-empty section content', () => {
    const zoneId = 'split-zone';
    const encounter = {
      ...createEncounterState({ id: 'encounter-split-flex', name: 'Split Flex' }),
      actors: collection([
        { ...zonedActor('hero', zoneId), layoutGroup: 'hero' as const },
        { ...zonedActor('enemy', zoneId), layoutGroup: 'enemy' as const }
      ]),
      zones: collection([
        {
          ...zone(zoneId, 100, 100, 300, 200),
          layoutStrategy: 'SPLIT_FLEX' as const
        }
      ])
    };

    const placements = getActorRenderPlacements(encounter);

    expect(placements.map(({ point }) => point)).toEqual([
      { x: 175, y: 200 },
      { x: 325, y: 200 }
    ]);
  });

  it('lays split sections vertically for LEFT_RIGHT and horizontally for TOP_BOTTOM', () => {
    const zoneId = 'split-zone';
    const actors = [
      { ...zonedActor('hero-one', zoneId), layoutGroup: 'hero' as const },
      { ...zonedActor('hero-two', zoneId), layoutGroup: 'hero' as const },
      { ...zonedActor('enemy', zoneId), layoutGroup: 'enemy' as const }
    ];
    const leftRightEncounter = {
      ...createEncounterState({ id: 'encounter-split-left-right', name: 'Split' }),
      actors: collection(actors),
      zones: collection([
        {
          ...zone(zoneId, 100, 100, 300, 200),
          layoutStrategy: 'SPLIT_FLEX' as const,
          layoutOrientation: 'LEFT_RIGHT' as const
        }
      ])
    };
    const topBottomEncounter = {
      ...leftRightEncounter,
      zones: collection([
        {
          ...leftRightEncounter.zones.byId[zoneId]!,
          layoutOrientation: 'TOP_BOTTOM' as const
        }
      ])
    };

    const leftRight = getActorRenderPlacements(leftRightEncounter);
    const topBottom = getActorRenderPlacements(topBottomEncounter);

    expect(leftRight[0].point).toEqual({ x: 200, y: 146 });
    expect(leftRight[1].point).toEqual({ x: 200, y: 254 });
    expect(leftRight[2].point).toEqual({ x: 350, y: 200 });
    expect(topBottom[0].point.x).toBeCloseTo(146);
    expect(topBottom[0].point.y).toBeCloseTo(166.667);
    expect(topBottom[1].point.x).toBeCloseTo(354);
    expect(topBottom[1].point.y).toBeCloseTo(166.667);
    expect(topBottom[2].point.x).toBeCloseTo(250);
    expect(topBottom[2].point.y).toBeCloseTo(266.667);
  });

  it('uses polygon packing for FLEX actors in circular zones', () => {
    const zoneId = 'circle-zone';
    const encounter = {
      ...createEncounterState({
        id: 'encounter-circle-flex',
        name: 'Circle Flex'
      }),
      actors: collection([
        zonedActor('actor-top', zoneId),
        zonedActor('actor-right', zoneId),
        zonedActor('actor-bottom', zoneId),
        zonedActor('actor-left', zoneId)
      ]),
      zones: collection([circleZone(zoneId, 100, 100, 200, 200)])
    };
    const placements = getActorRenderPlacements(encounter);
    expectPackedPlacements(placements, encounter.zones.byId[zoneId]!.polygon);
  });

  it('places SEQUENTIAL actors clockwise next to the previous actor in circular zones', () => {
    const zoneId = 'circle-zone';
    const encounter = {
      ...createEncounterState({
        id: 'encounter-circle-sequential',
        name: 'Circle Sequential'
      }),
      actors: collection([
        zonedActor('actor-first', zoneId),
        zonedActor('actor-second', zoneId),
        zonedActor('actor-third', zoneId)
      ]),
      zones: collection([circleZone(zoneId, 100, 100, 300, 300, 'SEQUENTIAL')])
    };
    const placements = getActorRenderPlacements(encounter);
    const ringRadius = 150 - ACTOR_TOKEN_BASE_RADIUS - RADIAL_ACTOR_GAP;
    const angleStep =
      2 *
      Math.asin(
        (ACTOR_TOKEN_BASE_RADIUS * 2 + RADIAL_ACTOR_GAP) / (2 * ringRadius)
      );

    expect(placements[0].point.x).toBeCloseTo(250);
    expect(placements[0].point.y).toBeCloseTo(250 - ringRadius);
    expect(placements[1].point.x).toBeCloseTo(
      250 + Math.cos(-Math.PI / 2 + angleStep) * ringRadius
    );
    expect(placements[1].point.y).toBeCloseTo(
      250 + Math.sin(-Math.PI / 2 + angleStep) * ringRadius
    );
    expect(placements[1].point.x).toBeLessThan(250 + ringRadius);
    expect(placements[2].point.x).toBeGreaterThan(placements[1].point.x);
  });

  it.each([
    ['circle', (id: string) => circleZone(id, 100, 100, 300, 300)],
    ['hexagon', (id: string) => polygonZone(
      id,
      createHexagonPolygonFromBounds({ height: 300, width: 300, x: 100, y: 100 }),
      'hexagon'
    )],
    ['polygon', (id: string) => polygonZone(
      id,
      [
        { x: 100, y: 100 },
        { x: 400, y: 130 },
        { x: 350, y: 400 },
        { x: 150, y: 350 }
      ],
      'polygon'
    )]
  ])('uses the same FLEX packer for %s zones', (_shape, createZone) => {
    const zoneId = `${_shape}-flex-zone`;
    const actors = [
      zonedActor('actor-one', zoneId),
      zonedActor('actor-two', zoneId),
      zonedActor('actor-three', zoneId)
    ];
    const selectedZone = createZone(zoneId);
    const encounter = {
      ...createEncounterState({ id: `encounter-${_shape}-flex`, name: 'Flex' }),
      actors: collection(actors),
      zones: collection([selectedZone])
    };

    const placements = getActorRenderPlacements(encounter);

    expect(placements).toHaveLength(actors.length);
    expectPackedPlacements(placements, selectedZone.polygon);
  });

  it('does not include zoneless actors in canvas placements', () => {
    const encounter = {
      ...createEncounterState({ id: 'encounter-zoneless-layout', name: 'Zoneless Layout' }),
      actors: collection([actor('actor-zoneless')])
    };

    expect(getActorRenderPlacements(encounter)).toEqual([]);
  });

  it('reuses geometry for visual-only actor edits while rendering the latest actor', () => {
    const zoneId = 'rectangle-zone';
    const encounter = {
      ...createEncounterState({ id: 'encounter-cache', name: 'Cache' }),
      actors: collection([zonedActor('actor-cache', zoneId)]),
      zones: collection([zone(zoneId, 100, 100, 300, 300)])
    };
    const initialPlacement = getActorRenderPlacements(encounter)[0];
    const updatedActor = {
      ...encounter.actors.byId['actor-cache']!,
      image: 'data:image/png;base64,updated',
      name: 'Updated actor'
    };
    const updatedEncounter = {
      ...encounter,
      actors: collection([updatedActor])
    };

    const updatedPlacement = getActorRenderPlacements(updatedEncounter)[0];

    expect(updatedPlacement.actor).toBe(updatedActor);
    expect(updatedPlacement.point).toEqual(initialPlacement.point);
  });

  it('reuses translated geometry when a zone moves', () => {
    const zoneId = 'translated-zone';
    const encounter = {
      ...createEncounterState({ id: 'encounter-zone-move-cache', name: 'Cache' }),
      actors: collection([
        zonedActor('actor-one', zoneId),
        zonedActor('actor-two', zoneId)
      ]),
      zones: collection([zone(zoneId, 100, 100, 300, 300)])
    };
    const placements = getActorRenderPlacements(encounter);
    const offset = { x: 75, y: -30 };
    const movedZone = zone(zoneId, 175, 70, 300, 300);
    const movedEncounter = {
      ...encounter,
      zones: collection([movedZone])
    };

    cacheActorRenderPlacementsForZoneMove(
      movedEncounter,
      placements,
      zoneId,
      offset
    );

    expect(getActorRenderPlacements(movedEncounter).map(({ point }) => point)).toEqual(
      placements.map(({ point }) => ({
        x: point.x + offset.x,
        y: point.y + offset.y
      }))
    );
  });
});
