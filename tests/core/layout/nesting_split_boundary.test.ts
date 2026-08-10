import { describe, expect, it } from 'vitest';
import {
  footprintsOverlap,
  getFootprint,
  isFootprintInsideZone
} from '@core/layout/polygonGeometry';
import { packPolygonActors } from '@core/layout/nesting_ts';
import { actor, rectangle } from './nesting_test_helpers';

describe('polygon nesting layout', () => {
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
