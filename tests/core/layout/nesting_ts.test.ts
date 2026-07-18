import { describe, expect, it } from 'vitest';
import type { LayoutPoint } from '@core/layout/types';
import {
  footprintsOverlap,
  getFootprint,
  isFootprintInsideZone
} from '@core/layout/polygonGeometry';
import {
  packPolygonActors,
  DEFAULT_SPLIT_FLEX_ACTOR_GAP,
  type NestingActor
} from '@core/layout/nesting_ts';

const rectangle = (width: number, height: number): LayoutPoint[] => [
  { x: 0, y: 0 },
  { x: width, y: 0 },
  { x: width, y: height },
  { x: 0, y: height }
];

const actor = (
  id: string,
  shape: NestingActor['shape'] = 'circle',
  radius = 30
): NestingActor => ({
  id,
  radius,
  shape
});

describe('polygon nesting layout', () => {
  it('centers a singular actor in the zone', () => {
    const result = packPolygonActors({
      actors: [actor('only')],
      polygon: rectangle(300, 200)
    });

    expect(result).toMatchObject({
      fits: true,
      borderSpacing: 16,
      placements: { only: { x: 150, y: 100 } }
    });
  });

  it('moves a singular actor from an invalid center to a valid polygon position', () => {
    const polygon: LayoutPoint[] = [
      { x: 0, y: 0 },
      { x: 320, y: 0 },
      { x: 320, y: 320 },
      { x: 200, y: 320 },
      { x: 200, y: 120 },
      { x: 0, y: 120 }
    ];
    const center = { x: 160, y: 160 };
    const result = packPolygonActors({
      actors: [actor('only')],
      polygon
    });

    expect(
      isFootprintInsideZone(
        getFootprint(actor('only'), center, 16, 16),
        polygon
      )
    ).toBe(false);
    expect(result.fits).toBe(true);
    expect(result.placements.only).not.toEqual(center);
    expect(
      isFootprintInsideZone(
        getFootprint(actor('only'), result.placements.only, 16, 16),
        polygon
      )
    ).toBe(true);
  });

  it('packs rectangle and circle footprints without overlap', () => {
    const result = packPolygonActors({
      actors: [actor('rectangle', 'rectangle'), actor('circle')],
      polygon: rectangle(300, 200)
    });
    const first = result.placements.rectangle;
    const second = result.placements.circle;

    expect(result.fits).toBe(true);
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(Math.hypot(first.x - second.x, first.y - second.y)).toBeGreaterThan(
      60 + 16
    );
  });

  it('balances FLEX actor spacing between neighboring actors and the zone boundary', () => {
    const result = packPolygonActors({
      actors: [actor('first'), actor('second')],
      polygon: rectangle(300, 200)
    });
    const first = result.placements.first;
    const second = result.placements.second;
    const actorBoundaryClearance = Math.min(
      first.x - 30,
      300 - first.x - 30,
      first.y - 30,
      200 - first.y - 30
    );
    const neighboringActorClearance =
      Math.hypot(first.x - second.x, first.y - second.y) - 60;

    expect(result.fits).toBe(true);
    expect(first).toEqual({ x: 210, y: 100 });
    expect(second).toEqual({ x: 90, y: 100 });
    expect(
      Math.abs(actorBoundaryClearance - neighboringActorClearance)
    ).toBeLessThanOrEqual(1);
  });

  it.each([
    [160, 12],
    [152, 8],
    [144, 4]
  ])('falls back to %ipx border spacing when needed', (width, spacing) => {
    const result = packPolygonActors({
      actors: [actor('first'), actor('second')],
      polygon: rectangle(width, 100)
    });

    expect(result.fits).toBe(true);
    expect(result.borderSpacing).toBe(spacing);
  });

  it('reduces border spacing incrementally for sequential layouts', () => {
    const result = packPolygonActors({
      actors: [actor('first'), actor('second')],
      layoutStrategy: 'SEQUENTIAL',
      polygon: rectangle(240, 100)
    });

    expect(result.fits).toBe(true);
    expect(result.borderSpacing).toBe(16);
  });

  it('keeps differently sized sequential actors aligned on shared rows', () => {
    const actors = [
      actor('small-first', 'circle', 20),
      actor('large-first-row', 'rectangle', 50),
      actor('small-second-row', 'circle', 20),
      actor('small-second-row-end', 'circle', 20)
    ];
    const polygon = rectangle(240, 260);
    const result = packPolygonActors({
      actors,
      layoutStrategy: 'SEQUENTIAL',
      polygon
    });

    expect(result.fits).toBe(true);
    expect(result.placements['small-first'].y).toBe(
      result.placements['large-first-row'].y
    );
    expect(result.placements['small-second-row'].y).toBe(
      result.placements['small-second-row-end'].y
    );
    expect(result.placements['small-second-row'].y).toBeGreaterThan(
      result.placements['small-first'].y
    );

    for (const current of actors) {
      expect(
        isFootprintInsideZone(
          getFootprint(current, result.placements[current.id], result.borderSpacing, 16),
          polygon
        )
      ).toBe(true);

      for (const other of actors) {
        if (current.id >= other.id) {
          continue;
        }

        expect(
          footprintsOverlap(
            getFootprint(current, result.placements[current.id], 8, 16),
            getFootprint(other, result.placements[other.id], 8, 16)
          )
        ).toBe(false);
      }
    }
  });

  it('rejects a layout that cannot fit without overlap', () => {
    const result = packPolygonActors({
      actors: [actor('first'), actor('second')],
      polygon: rectangle(100, 100)
    });

    expect(result).toMatchObject({
      fits: false,
      reason: 'no-space'
    });
  });

  it('keeps the incoming drop point alongside its packed target', () => {
    const dropPoint = { x: 250, y: 100 };
    const result = packPolygonActors({
      actors: [actor('existing'), actor('incoming')],
      incomingActorId: 'incoming',
      incomingDropPoint: dropPoint,
      polygon: rectangle(300, 200)
    });

    expect(result.fits).toBe(true);
    expect(result.incomingDropPoint).toEqual(dropPoint);
    expect(result.incomingTargetPoint).toEqual(result.placements.incoming);
  });

  it('is deterministic for a stable actor order', () => {
    const input = {
      actors: [actor('first'), actor('second'), actor('third')],
      polygon: rectangle(400, 300)
    };

    expect(packPolygonActors(input)).toEqual(packPolygonActors(input));
  });

  it('does not let placeholder actor IDs change a proactive layout', () => {
    const polygon = rectangle(400, 300);
    const lazyResult = packPolygonActors({
      actors: [actor('existing'), actor('incoming')],
      polygon
    });
    const proactiveResult = packPolygonActors({
      actors: [actor('existing'), actor('__proactive_actor__')],
      polygon
    });

    expect(lazyResult.fits).toBe(true);
    expect(proactiveResult.fits).toBe(true);
    expect(lazyResult.placements.existing).toEqual(
      proactiveResult.placements.existing
    );
    expect(lazyResult.placements.incoming).toEqual(
      proactiveResult.placements.__proactive_actor__
    );
  });

  it('orders SPLIT_FLEX factions without creating section geometry', () => {
    const actors = [
      { ...actor('hero-one'), layoutGroup: 'hero' as const },
      { ...actor('hero-two'), layoutGroup: 'hero' as const },
      { ...actor('neutral'), layoutGroup: 'neutral' as const },
      { ...actor('enemy'), layoutGroup: 'enemy' as const }
    ];
    const result = packPolygonActors({
      actors,
      layoutOrientation: 'LEFT_RIGHT',
      layoutStrategy: 'SPLIT_FLEX',
      polygon: rectangle(500, 300)
    });

    expect(result.fits).toBe(true);
    const rightmostHero = Math.max(
      ...actors
        .filter((current) => current.layoutGroup === 'hero')
        .map((current) => result.placements[current.id].x + current.radius)
    );
    const leftmostNeutral = result.placements.neutral.x - 30;
    const rightmostNeutral = result.placements.neutral.x + 30;
    const leftmostEnemy = result.placements.enemy.x - 30;

    expect(rightmostHero).toBeLessThanOrEqual(leftmostNeutral);
    expect(rightmostNeutral).toBeLessThanOrEqual(leftmostEnemy);
  });

  it('uses a 2px default gap for SPLIT_FLEX actors', () => {
    const result = packPolygonActors({
      actors: [
        { ...actor('hero-one'), layoutGroup: 'hero' as const },
        { ...actor('hero-two'), layoutGroup: 'hero' as const }
      ],
      layoutOrientation: 'LEFT_RIGHT',
      layoutStrategy: 'SPLIT_FLEX',
      polygon: rectangle(300, 200)
    });
    const legacyGapResult = packPolygonActors({
      actors: [
        { ...actor('hero-one'), layoutGroup: 'hero' as const },
        { ...actor('hero-two'), layoutGroup: 'hero' as const }
      ],
      layoutOrientation: 'LEFT_RIGHT',
      layoutStrategy: 'SPLIT_FLEX',
      polygon: rectangle(300, 200),
      settings: { actorGap: 16 }
    });
    const first = result.placements['hero-one'];
    const second = result.placements['hero-two'];
    const legacyFirst = legacyGapResult.placements['hero-one'];
    const legacySecond = legacyGapResult.placements['hero-two'];

    expect(result.fits).toBe(true);
    expect(legacyGapResult.fits).toBe(true);
    expect(Math.hypot(first.x - second.x, first.y - second.y)).toBeGreaterThanOrEqual(
      actor('hero-one').radius * 2 + DEFAULT_SPLIT_FLEX_ACTOR_GAP
    );
    expect(Math.hypot(first.x - second.x, first.y - second.y)).toBeLessThan(
      Math.hypot(legacyFirst.x - legacySecond.x, legacyFirst.y - legacySecond.y)
    );
  });

  it('keeps actors from the same SPLIT_FLEX faction visually grouped', () => {
    const actors = [
      { ...actor('hero-one'), layoutGroup: 'hero' as const },
      { ...actor('hero-two'), layoutGroup: 'hero' as const },
      { ...actor('hero-three'), layoutGroup: 'hero' as const },
      { ...actor('hero-four'), layoutGroup: 'hero' as const },
      { ...actor('neutral'), layoutGroup: 'neutral' as const },
      { ...actor('enemy'), layoutGroup: 'enemy' as const }
    ];
    const result = packPolygonActors({
      actors,
      layoutOrientation: 'LEFT_RIGHT',
      layoutStrategy: 'SPLIT_FLEX',
      polygon: rectangle(500, 300)
    });
    const heroAxisValues = actors
      .filter((current) => current.layoutGroup === 'hero')
      .map((current) => result.placements[current.id].x);

    expect(result.fits).toBe(true);
    expect(Math.max(...heroAxisValues) - Math.min(...heroAxisValues)).toBeLessThanOrEqual(
      100
    );
  });

  it.each([400, 500, 600])(
    'packs multiple hero rows before the neutral and enemy factions in a %ipx rectangle',
    (width) => {
      const actors = [
        { ...actor('hero-one'), layoutGroup: 'hero' as const },
        { ...actor('hero-two'), layoutGroup: 'hero' as const },
        { ...actor('hero-three'), layoutGroup: 'hero' as const },
        { ...actor('neutral'), layoutGroup: 'neutral' as const },
        { ...actor('enemy'), layoutGroup: 'enemy' as const },
        { ...actor('hero-four'), layoutGroup: 'hero' as const }
      ];
      const polygon = rectangle(width, 200);

      for (let count = 1; count <= actors.length; count += 1) {
        expect(
          packPolygonActors({
            actors: actors.slice(0, count),
            layoutOrientation: 'LEFT_RIGHT',
            layoutStrategy: 'SPLIT_FLEX',
            polygon
          }).fits
        ).toBe(true);
      }

      const result = packPolygonActors({
        actors,
        layoutOrientation: 'LEFT_RIGHT',
        layoutStrategy: 'SPLIT_FLEX',
        polygon
      });

      expect(result.fits).toBe(true);

      for (const current of actors) {
        expect(
          isFootprintInsideZone(
            getFootprint(
              current,
              result.placements[current.id],
              result.borderSpacing,
              16
            ),
            polygon
          )
        ).toBe(true);

        for (const other of actors) {
          if (current.id >= other.id) {
            continue;
          }

          expect(
            footprintsOverlap(
              getFootprint(current, result.placements[current.id], 1, 16),
              getFootprint(other, result.placements[other.id], 1, 16)
            )
          ).toBe(false);
        }
      }

      const heroes = actors.filter((current) => current.layoutGroup === 'hero');
      const rightmostHero = Math.max(
        ...heroes.map(
          (current) => result.placements[current.id].x + current.radius
        )
      );
      expect(rightmostHero).toBeLessThanOrEqual(
        result.placements.neutral.x - 30
      );
      expect(result.placements.neutral.x + 30).toBeLessThanOrEqual(
        result.placements.enemy.x - 30
      );

    }
  );

  it('repositions earlier factions when an incoming actor closes a split boundary', () => {
    const actors = [
      { ...actor('hero-one', 'circle', 24), layoutGroup: 'hero' as const },
      { ...actor('hero-two', 'circle', 32), layoutGroup: 'hero' as const },
      { ...actor('hero-three', 'circle', 28), layoutGroup: 'hero' as const },
      { ...actor('neutral', 'circle', 38), layoutGroup: 'neutral' as const },
      { ...actor('enemy', 'circle', 26), layoutGroup: 'enemy' as const },
      {
        ...actor('incoming-hero', 'circle', 30),
        layoutGroup: 'hero' as const
      }
    ];
    const polygon = rectangle(420, 200);
    const result = packPolygonActors({
      actors,
      incomingActorId: 'incoming-hero',
      incomingDropPoint: { x: 245, y: 100 },
      layoutOrientation: 'LEFT_RIGHT',
      layoutStrategy: 'SPLIT_FLEX',
      polygon
    });

    expect(result.fits).toBe(true);

    for (const current of actors) {
      expect(
        isFootprintInsideZone(
          getFootprint(
            current,
            result.placements[current.id],
            result.borderSpacing,
            16
          ),
          polygon
        )
      ).toBe(true);

      for (const other of actors) {
        if (current.id >= other.id) {
          continue;
        }

        expect(
          footprintsOverlap(
            getFootprint(current, result.placements[current.id], 1, 16),
            getFootprint(other, result.placements[other.id], 1, 16)
          )
        ).toBe(false);
      }
    }

    const heroExtent = Math.max(
      ...actors
        .filter((current) => current.layoutGroup === 'hero')
        .map(
          (current) =>
            result.placements[current.id].x + current.radius
        )
    );
    const neutralExtent = result.placements.neutral.x - 38;
    const enemyExtent = result.placements.enemy.x - 26;

    expect(heroExtent).toBeLessThanOrEqual(neutralExtent);
    expect(result.placements.neutral.x + 38).toBeLessThanOrEqual(enemyExtent);
  });
});
