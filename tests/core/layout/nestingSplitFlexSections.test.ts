import { describe, expect, it } from 'vitest';
import { getSplitSectionWidths } from '@core/layout/nestingSplitFlexSections';

describe('SPLIT_FLEX section widths', () => {
  it('uses actor counts as the section ratio', () => {
    expect(
      getSplitSectionWidths(
        [
          { count: 2, minimumWidth: 60 },
          { count: 2, minimumWidth: 60 },
          { count: 1, minimumWidth: 60 }
        ],
        500
      )
    ).toEqual([200, 200, 100]);
  });

  it('gives an incoming faction its share before the boundary is placed', () => {
    expect(
      getSplitSectionWidths(
        [
          { count: 2, minimumWidth: 60 },
          { count: 2, minimumWidth: 60 },
          { count: 2, minimumWidth: 60 }
        ],
        468
      )
    ).toEqual([156, 156, 156]);
  });

  it('expands a faction section to fit its largest actor', () => {
    const widths = getSplitSectionWidths(
      [
        { count: 3, minimumWidth: 60 },
        { count: 1, minimumWidth: 200 },
        { count: 1, minimumWidth: 60 }
      ],
      400
    );

    expect(widths).toEqual([140, 200, 60]);
    expect(widths[1]).toBeGreaterThanOrEqual(200);
  });
});
