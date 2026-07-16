import { describe, expect, it, vi } from 'vitest';

import { createEncounterState } from '@core/encounter/createEncounterState';
import { ZONELESS_ACTOR_ZONE_ID } from '@core/encounter/types';
import type { EntityCollection } from '@core/state/entityCollection';
import type { Actor } from '@entities/actor/types';
import type { Zone } from '@entities/zone/types';
import {
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
import {
  packPolygonSequentialActors,
  POLYGON_LAYOUT_SETTINGS
} from '@core/layout/polygonFlexLayout';
import {
  clearProactiveActorPlacementCache,
  getProactivePlanCount,
  scheduleProactiveActorPlacementComputations
} from './proactiveActorPlacementCache';

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
  it('centers the only FLEX actor when its footprint fits', () => {
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

    expect(first.point).toEqual({ x: 310, y: 250 });
    expect(second.point).toEqual({ x: 190, y: 250 });
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
      { x: 146, y: 200 },
      { x: 354, y: 200 }
    ]);
  });

  it.each([
    ['circle', 'SPLIT_FLEX' as const, (id: string, strategy: Zone['layoutStrategy']) =>
      circleZone(id, 100, 100, 300, 300, strategy)],
    ['hexagon', 'SPLIT_SEQUENTIAL' as const, (id: string, strategy: Zone['layoutStrategy']) => ({
      ...polygonZone(
        id,
        createHexagonPolygonFromBounds({ height: 300, width: 300, x: 100, y: 100 }),
        'hexagon'
      ),
      layoutStrategy: strategy
    })]
  ])('keeps curved %s split sections inside the zone without overlap', (_shape, strategy, createZone) => {
    const zoneId = `curved-split-${_shape}`;
    const selectedZone = createZone(zoneId, strategy);
    const encounter = {
      ...createEncounterState({ id: 'encounter-curved-split', name: 'Split' }),
      actors: collection([
        { ...zonedActor('hero-one', zoneId), layoutGroup: 'hero' as const },
        { ...zonedActor('hero-two', zoneId), layoutGroup: 'hero' as const },
        { ...zonedActor('enemy-one', zoneId), layoutGroup: 'enemy' as const },
        { ...zonedActor('enemy-two', zoneId), layoutGroup: 'enemy' as const }
      ]),
      zones: collection([selectedZone])
    };

    const placements = getActorRenderPlacements(encounter);
    console.log(placements.map(({ actor, point }) => [actor.id, point]));
    expectPackedPlacements(placements, selectedZone.polygon);
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

    expect(leftRight[0].point).toEqual({ x: 146, y: 146 });
    expect(leftRight[1].point).toEqual({ x: 146, y: 254 });
    expect(leftRight[2].point).toEqual({ x: 354, y: 200 });
    expect(topBottom[0].point).toEqual({ x: 146, y: 146 });
    expect(topBottom[1].point).toEqual({ x: 354, y: 146 });
    expect(topBottom[2].point).toEqual({ x: 250, y: 254 });
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

  it('uses polygon packing to place SEQUENTIAL actors clockwise in circular zones', () => {
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
    const expected = packPolygonSequentialActors({
      actors: encounter.actors.allIds.map((actorId) =>
        toNestingActor(encounter.actors.byId[actorId]!)
      ),
      polygon: encounter.zones.byId[zoneId]!.polygon
    });

    expect(expected.fits).toBe(true);
    expect(placements.map(({ point }) => point)).toEqual(
      encounter.actors.allIds.map((actorId) => expected.placements[actorId])
    );
    expectPackedPlacements(placements, encounter.zones.byId[zoneId]!.polygon);
  });

  it('uses aligned row-major packing for rectangular SEQUENTIAL zones', () => {
    const zoneId = 'rectangle-sequential-zone';
    const selectedZone = {
      ...zone(zoneId, 100, 100, 300, 300),
      layoutStrategy: 'SEQUENTIAL' as const
    };
    const encounter = {
      ...createEncounterState({
        id: 'encounter-rectangle-sequential',
        name: 'Rectangle Sequential'
      }),
      actors: collection([
        zonedActor('actor-first', zoneId),
        zonedActor('actor-second', zoneId),
        zonedActor('actor-third', zoneId),
        zonedActor('actor-fourth', zoneId)
      ]),
      zones: collection([selectedZone])
    };

    const placements = getActorRenderPlacements(encounter);

    expect(placements.map(({ point }) => point)).toEqual([
      { x: 174, y: 212 },
      { x: 250, y: 212 },
      { x: 326, y: 212 },
      { x: 250, y: 288 }
    ]);
    expectPackedPlacements(placements, selectedZone.polygon);
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

  it('uses an asynchronously precomputed non-split configuration for a new actor', async () => {
    vi.useFakeTimers();
    clearProactiveActorPlacementCache();

    try {
      const zoneId = 'proactive-zone';
      const selectedZone = zone(zoneId, 100, 100, 500, 500);
      const existingActor = zonedActor('existing', zoneId);
      const baseEncounter = {
        ...createEncounterState({ id: 'encounter-proactive', name: 'Proactive' }),
        actors: collection([existingActor]),
        zones: collection([selectedZone])
      };
      const plannedPointCalculator = (_zone: Zone, actors: { id: string; radius: number }[]) =>
        actors.map((plannedActor, index) => ({
          actorId: plannedActor.id,
          point: { x: 100 + index * 100, y: 200 },
          radius: plannedActor.radius
        }));

      scheduleProactiveActorPlacementComputations(
        baseEncounter,
        POLYGON_LAYOUT_SETTINGS,
        plannedPointCalculator
      );
      await vi.runAllTimersAsync();

      expect(getProactivePlanCount()).toBe(8);

      const incomingActor = zonedActor('incoming', zoneId);
      const nextEncounter = {
        ...baseEncounter,
        actors: collection([existingActor, incomingActor])
      };
      const plannedPlacements = getActorRenderPlacements(
        nextEncounter,
        'PROACTIVE'
      );

      expect(getProactivePlanCount()).toBe(8);
      expect(plannedPlacements).toHaveLength(2);
      expect(plannedPlacements.map(({ actor }) => actor.id)).toEqual([
        existingActor.id,
        incomingActor.id
      ]);
      expect(plannedPlacements.map(({ point }) => point)).toEqual([
        { x: 100, y: 200 },
        { x: 200, y: 200 }
      ]);
    } finally {
      clearProactiveActorPlacementCache();
      vi.useRealTimers();
    }
  });
});
