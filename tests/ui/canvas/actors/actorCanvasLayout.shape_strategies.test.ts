import { describe, expect, it } from 'vitest';

import { createEncounterState } from '@core/encounter/createEncounterState';
import { toNestingActor } from '@core/layout/actorFootprints';
import {
  packPolygonSequentialActors
} from '@core/layout/polygonFlexLayout';
import { getActorRenderPlacements } from '@ui/canvas/actors/actorCanvasLayout';
import {
  collection,
  circleZone,
  createHexagonPolygonFromBounds,
  expectPackedPlacements,
  polygonZone,
  zone,
  zonedActor
} from './actorCanvasLayoutTestSupport';

describe('actor canvas layout', () => {
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
    [
      'hexagon',
      (id: string) =>
        polygonZone(
          id,
          createHexagonPolygonFromBounds({
            height: 300,
            width: 300,
            x: 100,
            y: 100
          }),
          'hexagon'
        )
    ],
    [
      'polygon',
      (id: string) =>
        polygonZone(
          id,
          [
            { x: 100, y: 100 },
            { x: 400, y: 130 },
            { x: 350, y: 400 },
            { x: 150, y: 350 }
          ],
          'polygon'
        )
    ]
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
});
