import { describe, expect, it } from 'vitest';

import {
  ENGAGEMENT_MINIMUM_CLEARANCE,
  ENGAGEMENT_TOKEN_RADIUS
} from '@core/layout/engagementGeometryConstants';
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
        ENGAGEMENT_TOKEN_RADIUS
      )
    ).toBe(false);
    expect(
      engagementEntitiesAreSeparate(
        [actor('a', 50, 50, 'rectangle')],
        [{ x: 70, y: 70 }],
        ENGAGEMENT_TOKEN_RADIUS
      )
    ).toBe(false);
    expect(
      engagementEntitiesAreSeparate(
        [],
        [{ x: 50, y: 50 }, { x: 70, y: 50 }],
        ENGAGEMENT_TOKEN_RADIUS
      )
    ).toBe(false);
  });

  it('accepts complete footprints whose areas retain the minimum gap', () => {
    const minimumGap = ENGAGEMENT_MINIMUM_CLEARANCE;
    const firstActor = actor('a', 40, 40, 'rectangle');
    const secondActor = actor(
      'b',
      firstActor.point.x + firstActor.radius * 2 + minimumGap,
      firstActor.point.y,
      'rectangle'
    );
    const tokenY =
      firstActor.point.y +
      firstActor.radius +
      ENGAGEMENT_TOKEN_RADIUS +
      minimumGap;

    expect(
      engagementEntitiesAreSeparate(
        [firstActor, secondActor],
        [
          { x: firstActor.point.x, y: tokenY },
          { x: secondActor.point.x, y: tokenY }
        ],
        ENGAGEMENT_TOKEN_RADIUS
      )
    ).toBe(true);
  });
});
