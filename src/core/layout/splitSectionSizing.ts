export type SplitSectionRequirement = {
  actorArea: number;
  minimumSize: number;
};

/**
 * Gives every section its minimum fitting width, then shares spare split-axis
 * space in proportion to the rendered footprint area in that section.
 */
export function getSplitSectionSizes(
  requirements: SplitSectionRequirement[],
  availableLength: number
): number[] {
  if (requirements.length === 0) {
    return [];
  }

  const minimumTotal = requirements.reduce(
    (total, requirement) => total + requirement.minimumSize,
    0
  );
  const available = Math.max(0, availableLength);

  if (minimumTotal >= available) {
    const scale = minimumTotal > 0 ? available / minimumTotal : 0;
    return requirements.map(
      (requirement) => requirement.minimumSize * scale
    );
  }

  const remaining = available - minimumTotal;
  const totalArea = requirements.reduce(
    (total, requirement) => total + requirement.actorArea,
    0
  );
  const fallbackArea = totalArea > 0 ? totalArea : requirements.length;

  return requirements.map(
    (requirement) =>
      requirement.minimumSize +
      remaining *
        ((totalArea > 0 ? requirement.actorArea : 1) / fallbackArea)
  );
}
