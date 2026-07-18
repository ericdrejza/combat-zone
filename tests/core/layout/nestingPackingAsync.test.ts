import { describe, expect, it } from 'vitest';
import { distance } from '@core/layout/polygonGeometry';
import { packPolygonActors } from '@core/layout/nesting_ts';
import { packPolygonActorsWithCandidateRanker } from '@core/layout/nestingPackingAsync';

const polygon = [
  { x: 0, y: 0 },
  { x: 300, y: 0 },
  { x: 300, y: 200 },
  { x: 0, y: 200 }
];

const actors = [
  { id: 'first', radius: 20, shape: 'circle' as const },
  { id: 'second', radius: 20, shape: 'rectangle' as const }
];

describe('asynchronous nesting candidate ranking', () => {
  it('preserves the synchronous packing result', async () => {
    const synchronous = packPolygonActors({
      actors,
      layoutStrategy: 'FLEX',
      polygon
    });
    const asynchronous = await packPolygonActorsWithCandidateRanker(
      { actors, layoutStrategy: 'FLEX', polygon },
      async (candidates, target) =>
        [...candidates].sort(
          (first, second) =>
            distance(first, target) - distance(second, target)
        )
    );

    expect(asynchronous).toEqual(synchronous);
  });
});
