import { describe, expect, it } from 'vitest';
import {
  footprintsOverlap,
  getFootprint,
  isFootprintInsideZone
} from '@core/layout/polygonGeometry';
import { packPolygonActors } from '@core/layout/nesting_ts';
import { MINIMUM_FLEX_ACTOR_GAP } from '@core/layout/nestingSpacing';
import { actor, rectangle } from './nesting_test_helpers';

describe('polygon nesting layout', () => {
  it('distributes spare room around dense rectangle actors', () => {
    const polygon = rectangle(400, 220);
    const actors = Array.from({ length: 8 }, (_, index) =>
      actor(`dense-${index}`)
    );
    const result = packPolygonActors({ actors, polygon });
    const minimumEdgeClearance = Math.min(
      ...actors.flatMap((current) => {
        const point = result.placements[current.id];

        return [
          point.x - current.radius,
          polygon[1].x - point.x - current.radius,
          point.y - current.radius,
          polygon[2].y - point.y - current.radius
        ];
      })
    );

    expect(result.fits).toBe(true);
    expect(result.borderSpacing).toBe(16);
    expect(minimumEdgeClearance).toBeGreaterThan(16);
  });

  it('retains the shared minimum gap in compact dense FLEX rectangles', () => {
    const polygon = rectangle(260, 132);
    const actors = Array.from({ length: 8 }, (_, index) =>
      actor(`compact-${index}`)
    );
    const result = packPolygonActors({ actors, polygon });

    expect(result.fits).toBe(true);
    expect(
      actors.flatMap((current, index) =>
        actors.slice(index + 1).map((other) =>
          footprintsOverlap(
            getFootprint(
              current,
              result.placements[current.id],
              MINIMUM_FLEX_ACTOR_GAP / 2,
              16
            ),
            getFootprint(
              other,
              result.placements[other.id],
              MINIMUM_FLEX_ACTOR_GAP / 2,
              16
            )
          )
        )
      )
    ).not.toContain(true);
  });

  it('rejects a dense FLEX rectangle that only fits touching actors', () => {
    const result = packPolygonActors({
      actors: Array.from({ length: 8 }, (_, index) =>
        actor(`touching-${index}`)
      ),
      polygon: rectangle(250, 130)
    });

    expect(result).toMatchObject({ fits: false, reason: 'no-space' });
  });

  it('packs small actors around a larger actor in a rectangular FLEX zone', () => {
    const polygon = rectangle(240, 160);
    const actors = [
      actor('large', 'rectangle', 45),
      ...Array.from({ length: 7 }, (_, index) =>
        actor(`small-${index}`, 'circle', 15)
      )
    ];
    const result = packPolygonActors({ actors, polygon });

    expect(result.fits).toBe(true);

    for (const [index, current] of actors.entries()) {
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

      for (const other of actors.slice(index + 1)) {
        expect(
          footprintsOverlap(
            getFootprint(current, result.placements[current.id], 0, 16),
            getFootprint(other, result.placements[other.id], 0, 16)
          )
        ).toBe(false);
      }
    }
  });

  it('keeps preferred FLEX edge spacing when a roomy rectangle does not need compaction', () => {
    const actors = Array.from({ length: 8 }, (_, index) =>
      actor(`roomy-${index}`)
    );
    const result = packPolygonActors({
      actors,
      polygon: rectangle(800, 500)
    });

    expect(result.fits).toBe(true);
    expect(result.borderSpacing).toBe(16);
  });
});
