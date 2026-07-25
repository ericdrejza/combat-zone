import { describe, expect, it } from 'vitest';
import { getSplitSectionSizes } from '@core/layout/splitSectionSizing';

describe('SPLIT_FLEX section widths', () => {
  it('shares remaining width in proportion to actor footprint area', () => {
    expect(
      getSplitSectionSizes(
        [
          { actorArea: 200, minimumSize: 60 },
          { actorArea: 200, minimumSize: 60 },
          { actorArea: 100, minimumSize: 60 }
        ],
        500
      )
    ).toEqual([188, 188, 124]);
  });

  it('gives an incoming faction its share before the boundary is placed', () => {
    expect(
      getSplitSectionSizes(
        [
          { actorArea: 200, minimumSize: 60 },
          { actorArea: 200, minimumSize: 60 },
          { actorArea: 200, minimumSize: 60 }
        ],
        468
      )
    ).toEqual([156, 156, 156]);
  });

  it('reserves each minimum before distributing remaining width', () => {
    const widths = getSplitSectionSizes(
      [
        { actorArea: 300, minimumSize: 60 },
        { actorArea: 100, minimumSize: 200 },
        { actorArea: 100, minimumSize: 60 }
      ],
      400
    );

    expect(widths).toEqual([108, 216, 76]);
    expect(widths[1]).toBeGreaterThanOrEqual(200);
  });
});
