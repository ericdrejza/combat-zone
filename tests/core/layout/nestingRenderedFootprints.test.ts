import { describe, expect, it } from 'vitest';
import { packPolygonActors, type NestingActor } from '@core/layout/nesting_ts';
import { packPolygonActorsWithCandidateRanker } from '@core/layout/nestingPackingAsync';
import { NestingSpatialIndex } from '@core/layout/nestingSpatialIndex';

const polygon = [{ x: 0, y: 0 }, { x: 260, y: 0 }, { x: 260, y: 320 }, { x: 0, y: 320 }];
const actors: NestingActor[] = Array.from({ length: 8 }, (_, index) => ({
  id: String(index), radius: index === 7 ? 90 : 30,
  shape: 'circle', layoutGroup: 'enemy'
}));

function expectClearance(
  placements: Record<string, { x: number; y: number }>,
  packedActors = actors
) {
  for (const [index, actor] of packedActors.entries()) {
    for (const other of packedActors.slice(index + 1)) {
      const first = placements[actor.id];
      const second = placements[other.id];
      expect(Math.hypot(first.x - second.x, first.y - second.y))
        .toBeGreaterThanOrEqual(actor.radius + other.radius + 4 - 0.0001);
    }
  }
}

describe('rendered footprint packing', () => {
  it.each(['FLEX', 'SPLIT_FLEX'] as const)('finds full-circle clearance in %s', (layoutStrategy) => {
    const result = packPolygonActors({ actors, polygon, layoutStrategy });
    expect(result.fits).toBe(true);
    expectClearance(result.placements);
    expect(packPolygonActors({ actors, polygon, layoutStrategy })).toEqual(result);
  });

  it.each(['FLEX', 'SPLIT_FLEX'] as const)('fits two xLarge actors alongside smaller actors in %s', (layoutStrategy) => {
    const packedActors = actors.map((actor, index) => ({
      ...actor, radius: index >= 6 ? 90 : 30
    }));
    const result = packPolygonActors({
      actors: packedActors,
      polygon: [{ x: 0, y: 0 }, { x: 480, y: 0 }, { x: 480, y: 360 }, { x: 0, y: 360 }],
      layoutStrategy
    });
    expect(result.fits).toBe(true);
    expectClearance(result.placements, packedActors);
  });

  it('applies the same clearance with an asynchronous candidate ranker', async () => {
    const result = await packPolygonActorsWithCandidateRanker({ actors, polygon }, async (points) => points);
    expect(result.fits).toBe(true);
    expectClearance(result.placements);
  });

  it.each(['circle', 'rectangle'] as const)('checks the complete circle against a %s', (shape) => {
    const index = new NestingSpatialIndex(200, 8);
    const large: NestingActor = { id: 'large', radius: 90, shape: 'circle' };
    const other: NestingActor = { id: 'other', radius: 30, shape };
    index.insert(index.createFootprint(large, { x: 0, y: 0 }, 2));
    // A low-resolution circle polygon misses rendered area between its vertices.
    expect(index.overlaps(index.createFootprint(other, { x: 110, y: 45 }, 2))).toBe(true);
    expect(index.overlaps(index.createFootprint(other, { x: 150, y: 45 }, 2))).toBe(false);
  });
});
