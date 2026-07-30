import { describe, expect, it } from 'vitest';

import { engagementEntitiesAreSeparate } from '@core/validation/engagementEntityOverlap';

describe('engagement entity overlap validation', () => {
  const actor = (
    actorId: string,
    x: number,
    y: number,
    shape: 'circle' | 'rectangle' = 'circle'
  ) => ({
    actorId,
    point: { x, y },
    radius: 20,
    shape
  });

  it('rejects every actor/actor, actor/token, and token/token overlap class', () => {
    expect(
      engagementEntitiesAreSeparate(
        [actor('a', 50, 50), actor('b', 80, 50)],
        [],
        12
      )
    ).toBe(false);
    expect(
      engagementEntitiesAreSeparate(
        [actor('a', 50, 50, 'rectangle')],
        [{ x: 70, y: 70 }],
        12
      )
    ).toBe(false);
    expect(
      engagementEntitiesAreSeparate(
        [],
        [{ x: 50, y: 50 }, { x: 70, y: 50 }],
        12
      )
    ).toBe(false);
  });

  it('accepts complete footprints whose areas retain the minimum gap', () => {
    expect(
      engagementEntitiesAreSeparate(
        [
          actor('a', 40, 40, 'rectangle'),
          actor('b', 82, 40, 'rectangle')
        ],
        [{ x: 40, y: 74 }, { x: 82, y: 74 }],
        12
      )
    ).toBe(true);
  });
});
