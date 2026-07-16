export type SplitSectionRequirement = {
  count: number;
  minimumWidth: number;
};

/**
 * Allocates the available split-axis length by actor count while honoring
 * each faction's largest-actor minimum. This is weighted water filling: a
 * large minimum can claim extra space, but unconstrained factions retain the
 * requested count-based ratio with the space that remains.
 */
export function getSplitSectionWidths(
  requirements: SplitSectionRequirement[],
  availableLength: number
): number[] {
  const widths = requirements.map(() => 0);
  const openIndexes = new Set(requirements.map((_, index) => index));
  let remainingLength = availableLength;
  let remainingWeight = requirements.reduce(
    (total, requirement) => total + requirement.count,
    0
  );

  while (openIndexes.size > 0) {
    const scale =
      remainingWeight > 0 ? remainingLength / remainingWeight : 0;
    const constrainedIndex = [...openIndexes].find(
      (index) => requirements[index].minimumWidth > scale * requirements[index].count
    );

    if (constrainedIndex === undefined) {
      for (const index of openIndexes) {
        widths[index] = scale * requirements[index].count;
      }
      break;
    }

    widths[constrainedIndex] = requirements[constrainedIndex].minimumWidth;
    remainingLength -= widths[constrainedIndex];
    remainingWeight -= requirements[constrainedIndex].count;
    openIndexes.delete(constrainedIndex);
  }

  return widths;
}
