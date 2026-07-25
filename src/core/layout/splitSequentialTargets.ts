import type { NestingActor } from './nesting_ts';
import type { SplitSectionBounds } from './splitSectionLayout';
import type { LayoutPoint } from './types';

/** Centers stable actor order on aligned wrapping rows inside one section. */
export function getCenteredSplitSequentialTargets(
  actors: NestingActor[],
  bounds: SplitSectionBounds,
  borderSpacing: number,
  actorGap: number
): Record<string, LayoutPoint> {
  const largestRadius = Math.max(...actors.map((actor) => actor.radius));
  const diameter = largestRadius * 2;
  const usableWidth = Math.max(
    0,
    bounds.maxX - bounds.minX - borderSpacing * 2
  );
  const columnCapacity = Math.max(
    1,
    Math.floor((usableWidth + actorGap) / (diameter + actorGap))
  );
  const columnCount = Math.min(actors.length, columnCapacity);
  const rowCount = Math.ceil(actors.length / columnCount);
  const totalHeight =
    rowCount * diameter + Math.max(0, rowCount - 1) * actorGap;
  const firstRowY =
    (bounds.minY + bounds.maxY - totalHeight) / 2 + largestRadius;
  const targets: Array<[string, LayoutPoint]> = [];

  for (let row = 0; row < rowCount; row += 1) {
    const firstIndex = row * columnCount;
    const actorsInRow = Math.min(columnCount, actors.length - firstIndex);
    const rowWidth =
      actorsInRow * diameter + Math.max(0, actorsInRow - 1) * actorGap;
    const firstX =
      (bounds.minX + bounds.maxX - rowWidth) / 2 + largestRadius;
    const y = firstRowY + row * (diameter + actorGap);

    for (let column = 0; column < actorsInRow; column += 1) {
      const actor = actors[firstIndex + column];
      targets.push([
        actor.id,
        { x: firstX + column * (diameter + actorGap), y }
      ]);
    }
  }

  return Object.fromEntries(targets);
}
