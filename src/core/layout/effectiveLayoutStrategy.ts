import { getSplitGroupRank } from './splitSectionLayout';
import type {
  NestingActor,
  PolygonNestingInput,
  PolygonNestingStrategy
} from './nesting_ts';

/** Single-faction layouts use the full-zone strategy without changing the saved preference. */
export function getEffectiveLayoutStrategy(
  strategy: PolygonNestingStrategy,
  actors: Pick<NestingActor, 'layoutGroup' | 'splitSectionId'>[]
): PolygonNestingStrategy {
  if (!strategy.startsWith('SPLIT')) return strategy;
  // Dedicated Engagement sections follow their own design rule.
  if (actors.some((actor) => actor.splitSectionId?.startsWith('engagement-'))) {
    return strategy;
  }
  const factions = new Set(actors.map((actor) =>
    actor.splitSectionId ?? ['hero', 'neutral', 'enemy'][getSplitGroupRank(actor)]
  ));
  if (factions.size !== 1) return strategy;
  return strategy === 'SPLIT_FLEX' ? 'FLEX' : 'SEQUENTIAL';
}

/** Keeps spacing defaults, capacity checks, and both packing paths in agreement. */
export function resolvePolygonLayoutInput(
  input: PolygonNestingInput
): PolygonNestingInput {
  const layoutStrategy = getEffectiveLayoutStrategy(
    input.layoutStrategy ?? 'FLEX', input.actors
  );
  return layoutStrategy === input.layoutStrategy ? input : { ...input, layoutStrategy };
}
