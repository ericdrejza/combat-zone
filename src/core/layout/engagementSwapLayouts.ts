import type { EngagementPackingLayout } from './engagementPackingLayouts';
import type { LayoutPoint } from './types';

type SwapMember = {
  radius: number;
};

function distance(left: LayoutPoint, right: LayoutPoint): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

/**
 * Tries later participants in append order against nearest earlier actors of
 * the same token size. The ordinary packing validator decides whether both
 * actors and the complete connector network remain valid after each swap.
 */
export function getEngagementSwapLayouts(
  layouts: readonly EngagementPackingLayout[],
  members: readonly SwapMember[]
): EngagementPackingLayout[] {
  return layouts.flatMap((layout) =>
    Array.from(
      { length: Math.max(0, members.length - 2) },
      (_, index) => members.length - index - 1
    ).flatMap((joiningIndex) => {
      const joiningMember = members[joiningIndex];
      if (!joiningMember || !layout.points[joiningIndex]) return [];

      return members
        .slice(0, joiningIndex)
        .flatMap((member, memberIndex) =>
          member.radius === joiningMember.radius && layout.points[memberIndex]
            ? [{
                distance: distance(
                  layout.points[joiningIndex],
                  layout.points[memberIndex]
                ),
                memberIndex
              }]
            : []
        )
        .sort(
          (left, right) =>
            left.distance - right.distance ||
            left.memberIndex - right.memberIndex
        )
        .map(({ memberIndex }) => {
          const points = layout.points.map((point) => ({ ...point }));
          [points[joiningIndex], points[memberIndex]] = [
            points[memberIndex],
            points[joiningIndex]
          ];
          return { ...layout, points };
        });
    })
  );
}
