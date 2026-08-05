import { describe, expect, it } from 'vitest';

import {
  type EngagementFallbackLayout,
  tryEngagementPackingFallbacks
} from '@core/layout/engagementPackingFallback';
import { getEngagementSwapLayouts } from '@core/layout/engagementSwapLayouts';

describe('engagement same-size position swaps', () => {
  it('tries the closest earlier actor of the same size first', () => {
    const token = { x: 50, y: 50 };
    const layouts = getEngagementSwapLayouts(
      [{
        points: [
          { x: 0, y: 0 },
          { x: 90, y: 0 },
          { x: 40, y: 0 },
          { x: 100, y: 0 }
        ],
        token
      }],
      [
        { radius: 60 },
        { radius: 30 },
        { radius: 30 },
        { radius: 30 }
      ]
    );

    expect(layouts[0]).toEqual({
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 40, y: 0 },
        { x: 90, y: 0 }
      ],
      token
    });
    expect(layouts).not.toContainEqual(expect.objectContaining({
      points: [
        { x: 100, y: 0 },
        { x: 90, y: 0 },
        { x: 40, y: 0 },
        { x: 0, y: 0 }
      ]
    }));
  });

  it('tries swaps after other packing fallbacks and before reporting failure', () => {
    const attempts: EngagementFallbackLayout[] = [];
    const result = tryEngagementPackingFallbacks(
      (fallback) => {
        attempts.push(fallback);
        return {
          fits: fallback === 'swap',
          placements: [],
          tokenPoints: {}
        };
      },
      () => ({
        fits: false,
        placements: [],
        tokenPoints: {}
      }),
      'space'
    );

    expect(attempts).toEqual(['preserved', 'growth', 'swap']);
    expect(result.fits).toBe(true);
  });
});
