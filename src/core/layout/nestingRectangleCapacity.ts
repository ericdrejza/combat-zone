import type { PolygonNestingInput } from './nesting_ts';

function isAxisAlignedRectangle(
  polygon: PolygonNestingInput['polygon']
): boolean {
  return (
    polygon.length === 4 &&
    new Set(polygon.map((point) => point.x)).size === 2 &&
    new Set(polygon.map((point) => point.y)).size === 2
  );
}

function canUniformGridFit(
  input: Pick<PolygonNestingInput, 'actors' | 'polygon'>,
  borderSpacing: number
): boolean {
  const xValues = input.polygon.map((point) => point.x);
  const yValues = input.polygon.map((point) => point.y);
  const width = Math.max(...xValues) - Math.min(...xValues);
  const height = Math.max(...yValues) - Math.min(...yValues);
  const largestRadius = Math.max(...input.actors.map((actor) => actor.radius));
  const diameter = largestRadius * 2;
  const usableWidth = width - (largestRadius + borderSpacing) * 2;
  const usableHeight = height - (largestRadius + borderSpacing) * 2;

  return Array.from(
    { length: input.actors.length },
    (_, index) => index + 1
  ).some((columns) => {
    const rows = Math.ceil(input.actors.length / columns);

    return (
      usableWidth >= Math.max(0, columns - 1) * diameter &&
      usableHeight >= Math.max(0, rows - 1) * diameter
    );
  });
}

/**
 * Skips clearly impossible comfort passes for dense rectangles. This is only
 * a starting-spacing hint: mixed-size actors still reach free-space search.
 */
export function getDenseRectangleSpacings(
  input: Pick<PolygonNestingInput, 'actors' | 'layoutStrategy' | 'polygon'>,
  spacings: number[],
  minimumSpacing: number
): number[] | undefined {
  if (
    (input.layoutStrategy ?? 'FLEX') !== 'FLEX' ||
    input.actors.length < 8 ||
    !isAxisAlignedRectangle(input.polygon)
  ) {
    return undefined;
  }

  const firstLikelyFit = spacings.findIndex((spacing) =>
    canUniformGridFit(input, spacing)
  );

  return firstLikelyFit >= 0
    ? spacings.slice(firstLikelyFit)
    : [minimumSpacing];
}
