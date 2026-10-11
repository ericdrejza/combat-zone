import { describe, expect, it } from 'vitest';
import { packPolygonActors, type NestingActor } from '@core/layout/nesting_ts';
import { packPolygonActorsWithCandidateRanker } from '@core/layout/nestingPackingAsync';
import { getFittingSplitSectionDividers } from '@core/layout/splitSectionDividers';
import { getEffectiveLayoutStrategy } from '@core/layout/effectiveLayoutStrategy';
import { actor, rectangle } from './nesting_test_helpers';

const pairs = [['SPLIT_FLEX', 'FLEX'], ['SPLIT_SEQUENTIAL', 'SEQUENTIAL']] as const;
const polygons = [rectangle(600, 400), [
  { x: 150, y: 0 }, { x: 450, y: 0 }, { x: 600, y: 200 },
  { x: 450, y: 400 }, { x: 150, y: 400 }, { x: 0, y: 200 }
]];

describe('single-faction split layouts', () => {
  for (const [split, ordinary] of pairs) {
    for (const layoutOrientation of ['LEFT_RIGHT', 'TOP_BOTTOM'] as const) {
      it.each(['hero', 'ally', 'neutral', 'enemy'] as const)(
        `${split} matches ${ordinary} for %s in ${layoutOrientation}`,
        (layoutGroup) => {
          const actors = [actor('one'), actor('two', 'rectangle', 60), actor('three')]
            .map((current) => ({ ...current, layoutGroup }));
          for (const polygon of polygons) {
            const input = { actors, polygon, layoutOrientation, incomingActorId: 'three', incomingDropPoint: { x: 280, y: 210 } };
            const result = packPolygonActors({ ...input, layoutStrategy: split });
            expect(result.fits).toBe(true);
            expect(result).toEqual(packPolygonActors({ ...input, layoutStrategy: ordinary }));
            expect(result.splitSections).toBeUndefined();
            expect(getFittingSplitSectionDividers({ ...input, layoutStrategy: split })).toEqual([]);
          }
        }
      );
    }

    it(`${split} keeps dedicated Engagement sections with one faction`, () => {
      const actors: NestingActor[] = [
        { ...actor('one'), layoutGroup: 'hero', splitSectionId: 'engagement-one' },
        { ...actor('two'), layoutGroup: 'hero', splitSectionId: 'engagement-one' }
      ];
      const result = packPolygonActors({ actors, polygon: rectangle(600, 400), layoutStrategy: split });
      expect(getEffectiveLayoutStrategy(split, actors)).toBe(split);
      expect(result.fits).toBe(true);
      expect(result.splitSections).toEqual([{ id: 'engagement-one', polygon: rectangle(600, 400) }]);
    });

    it(`${split} groups Hero and Ally into the same single faction section`, () => {
      const actors: NestingActor[] = [
        { ...actor('one'), layoutGroup: 'hero' },
        { ...actor('two'), layoutGroup: 'ally' }
      ];
      const input = { actors, polygon: rectangle(600, 400) };
      expect(packPolygonActors({ ...input, layoutStrategy: split }))
        .toEqual(packPolygonActors({ ...input, layoutStrategy: ordinary }));
    });

    it(`${split} preserves explicit spacing and asynchronous packing`, async () => {
      const input = {
        actors: [actor('one'), actor('two'), actor('three')],
        polygon: rectangle(600, 400), settings: { actorGap: 12 }
      };
      const ranker = async (points: { x: number; y: number }[]) => points;
      expect(await packPolygonActorsWithCandidateRanker({ ...input, layoutStrategy: split }, ranker))
        .toEqual(await packPolygonActorsWithCandidateRanker({ ...input, layoutStrategy: ordinary }, ranker));
    });
  }
});
