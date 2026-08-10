import { describe, expect, it } from 'vitest';

import { createEncounterState } from '@core/encounter/createEncounterState';
import type { Zone } from '@entities/zone/types';
import { getActorRenderPlacements } from '@ui/canvas/actors/actorCanvasLayout';
import { calculateActorPlacementGeometry } from '@ui/canvas/actors/actorPlacementGeometryCalculator';
import {
  collection,
  circleZone,
  createHexagonPolygonFromBounds,
  expectPackedPlacements,
  footprintsOverlap,
  getFootprint,
  isFootprintInsideZone,
  polygonZone,
  toNestingActor,
  zone,
  zonedActor,
  FLEX_ZONE_EDGE_GAP,
  MINIMUM_ACTOR_GAP,
  POLYGON_LAYOUT_SETTINGS
} from './actorCanvasLayoutTestSupport';

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
      Math.hypot(first.point.x - second.point.x, first.point.y - second.point.y)
    ).toBeGreaterThanOrEqual(first.radius + second.radius);
    expect(first.point.x + first.radius).toBeLessThanOrEqual(
      400 - FLEX_ZONE_EDGE_GAP
    );
    expect(first.point.y - first.radius).toBeGreaterThanOrEqual(
      100 + FLEX_ZONE_EDGE_GAP
    );
  });

  it('uses independent FLEX spacing inside each split faction section', () => {
    const zoneId = 'split-zone';
    const encounter = {
      ...createEncounterState({
        id: 'encounter-split-flex',
        name: 'Split Flex'
      }),
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

    const placements = calculateActorPlacementGeometry(encounter).map(
      ({ actorId, point, radius }) => ({
        actor: encounter.actors.byId[actorId]!,
        point,
        radius
      })
    );

    expect(placements.map(({ point }) => point)).toEqual([
      { x: 175, y: 200 },
      { x: 325, y: 200 }
    ]);
  });

  it('keeps multi-row split FLEX factions ordered without overlap', () => {
    const zoneId = 'split-capacity-zone';
    const encounter = {
      ...createEncounterState({
        id: 'encounter-split-capacity',
        name: 'Split'
      }),
      actors: collection([
        { ...zonedActor('hero-one', zoneId), layoutGroup: 'hero' as const },
        { ...zonedActor('hero-two', zoneId), layoutGroup: 'hero' as const },
        { ...zonedActor('hero-three', zoneId), layoutGroup: 'hero' as const },
        { ...zonedActor('neutral', zoneId), layoutGroup: 'neutral' as const },
        { ...zonedActor('enemy', zoneId), layoutGroup: 'enemy' as const },
        { ...zonedActor('hero-four', zoneId), layoutGroup: 'hero' as const }
      ]),
      zones: collection([
        {
          ...zone(zoneId, 100, 100, 400, 200),
          layoutStrategy: 'SPLIT_FLEX' as const
        }
      ])
    };

    const placements = calculateActorPlacementGeometry(encounter).map(
      ({ actorId, point, radius }) => ({
        actor: encounter.actors.byId[actorId]!,
        point,
        radius
      })
    );
    const heroPlacements = placements.filter(
      ({ actor: current }) => current.layoutGroup === 'hero'
    );
    const neutralPlacement = placements.find(
      ({ actor: current }) => current.id === 'neutral'
    )!;
    const enemyPlacement = placements.find(
      ({ actor: current }) => current.id === 'enemy'
    )!;

    expect(placements).toHaveLength(6);
    const polygon = encounter.zones.byId[zoneId]!.polygon;

    for (const placement of placements) {
      expect(
        isFootprintInsideZone(
          getFootprint(
            toNestingActor(placement.actor),
            placement.point,
            4,
            POLYGON_LAYOUT_SETTINGS.circleSegments
          ),
          polygon
        )
      ).toBe(true);
    }

    for (let first = 0; first < placements.length; first += 1) {
      for (let second = first + 1; second < placements.length; second += 1) {
        expect(
          footprintsOverlap(
            getFootprint(
              toNestingActor(placements[first].actor),
              placements[first].point,
              1,
              16
            ),
            getFootprint(
              toNestingActor(placements[second].actor),
              placements[second].point,
              1,
              16
            )
          )
        ).toBe(false);
      }
    }
    expect(
      Math.max(...heroPlacements.map(({ point, radius }) => point.x + radius))
    ).toBeLessThanOrEqual(neutralPlacement.point.x - neutralPlacement.radius);
    expect(
      neutralPlacement.point.x + neutralPlacement.radius
    ).toBeLessThanOrEqual(enemyPlacement.point.x - enemyPlacement.radius);
  });

  it.each([
    [
      'circle',
      'SPLIT_FLEX' as const,
      (id: string, strategy: Zone['layoutStrategy']) =>
        circleZone(id, 100, 100, 300, 300, strategy)
    ],
    [
      'hexagon',
      'SPLIT_FLEX' as const,
      (id: string, strategy: Zone['layoutStrategy']) => ({
        ...polygonZone(
          id,
          createHexagonPolygonFromBounds({
            height: 300,
            width: 300,
            x: 100,
            y: 100
          }),
          'hexagon'
        ),
        layoutStrategy: strategy
      })
    ]
  ])(
    'keeps curved %s split sections inside the zone without overlap',
    (_shape, strategy, createZone) => {
      const zoneId = `curved-split-${_shape}`;
      const selectedZone = createZone(zoneId, strategy);
      const encounter = {
        ...createEncounterState({
          id: 'encounter-curved-split',
          name: 'Split'
        }),
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
      expectPackedPlacements(
        placements,
        selectedZone.polygon,
        MINIMUM_ACTOR_GAP
      );
    }
  );
});
