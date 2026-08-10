import { describe, expect, it } from 'vitest';
import type { LayoutPoint } from '@core/layout/types';
import { isFootprintInsideZone, getFootprint } from '@core/layout/polygonGeometry';
import { packPolygonActors } from '@core/layout/nesting_ts';
import { actor, rectangle } from './nesting_test_helpers';

describe('polygon nesting layout', () => {
  it('packs area-weighted split sequential sections inside a circle', () => {
    const polygon: LayoutPoint[] = Array.from({ length: 60 }, (_, index) => {
      const angle = (index / 60) * Math.PI * 2;

      return {
        x: 150 + Math.cos(angle) * 150,
        y: 150 + Math.sin(angle) * 150
      };
    });
    const actors = [
      { ...actor('huge-hero', 'circle', 60), layoutGroup: 'hero' as const },
      { ...actor('small-enemy-one', 'circle', 15), layoutGroup: 'enemy' as const },
      { ...actor('small-enemy-two', 'circle', 15), layoutGroup: 'enemy' as const },
      { ...actor('small-enemy-three', 'circle', 15), layoutGroup: 'enemy' as const }
    ];
    const result = packPolygonActors({
      actors,
      layoutOrientation: 'LEFT_RIGHT',
      layoutStrategy: 'SPLIT_SEQUENTIAL',
      polygon
    });

    expect(result.fits).toBe(true);
    expect(
      actors.every((current) =>
        isFootprintInsideZone(
          getFootprint(
            current,
            result.placements[current.id],
            result.borderSpacing,
            16
          ),
          polygon
        )
      )
    ).toBe(true);
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
});
