import { describe, expect, it } from 'vitest';
import {
  footprintsOverlap,
  getFootprint,
  isFootprintInsideZone
} from '@core/layout/polygonGeometry';
import {
  DEFAULT_SPLIT_FLEX_ACTOR_GAP,
  packPolygonActors,
  resolvePolygonNestingSettings,
  type PolygonNestingStrategy
} from '@core/layout/nesting_ts';
import {
  getCollisionActorGap,
  MINIMUM_ACTOR_GAP
} from '@core/layout/nestingSpacing';
import { actor, rectangle } from './nesting_test_helpers';

describe('polygon nesting layout', () => {
  it('packs SPLIT_FLEX factions inside isolated section geometry', () => {
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

  it('uses the shared minimum gap for SPLIT_FLEX actors', () => {
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

  it.each([
    'FLEX',
    'SEQUENTIAL',
    'SPLIT_FLEX',
    'SPLIT_SEQUENTIAL'
  ] as const)(
    'does not compact %s actors below the shared minimum floor',
    (layoutStrategy: PolygonNestingStrategy) => {
      const belowMinimumGap = MINIMUM_ACTOR_GAP - 1;
      const settings = resolvePolygonNestingSettings({
        layoutStrategy,
        settings: { actorGap: belowMinimumGap }
      });

      expect(settings.actorGap).toBe(MINIMUM_ACTOR_GAP);
      expect(getCollisionActorGap(layoutStrategy, belowMinimumGap, 2)).toBe(
        MINIMUM_ACTOR_GAP
      );
    }
  );

  it('spaces actors from the same SPLIT_FLEX faction around their section', () => {
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
    expect(
      Math.max(...heroAxisValues) - Math.min(...heroAxisValues)
    ).toBeGreaterThan(100);
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
});
