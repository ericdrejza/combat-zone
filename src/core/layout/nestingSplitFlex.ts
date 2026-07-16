import type { LayoutOrientation, LayoutPoint } from './types';
import type {
  NestingActor,
  PolygonNestingInput
} from './nesting_ts';
import { getFlexTargetPoint } from './nestingTargets';
import { getPolygonBounds } from './polygonGeometry';
import { getSplitSectionWidths } from './nestingSplitFlexSections';

export function getSplitGroupRank(actor: NestingActor): number {
  return actor.layoutGroup === 'hero'
    ? 0
    : actor.layoutGroup === 'neutral'
      ? 1
      : actor.layoutGroup === 'enemy'
        ? 2
        : 1;
}

export function getSplitFlexTargetPoints(
  input: PolygonNestingInput,
  borderSpacing: number,
  actorGap: number
): Map<string, LayoutPoint> {
  const baseTargets = input.actors.map((actor, index) => ({
    actor,
    index,
    point: getFlexTargetPoint(
      index,
      input.actors.length,
      input.polygon,
      input.actors,
      borderSpacing,
      actorGap
    )
  }));
  const vertical = input.layoutOrientation === 'TOP_BOTTOM';
  const axisValue = (point: LayoutPoint) => (vertical ? point.y : point.x);
  const targetSlots = [...baseTargets].sort(
    (first, second) =>
      axisValue(first.point) - axisValue(second.point) ||
      first.index - second.index
  );
  const groupedTargets = new Map<
    number,
    Array<{ actor: NestingActor; point: LayoutPoint }>
  >();
  let slotIndex = 0;

  for (const groupRank of [0, 1, 2]) {
    const groupActors = baseTargets
      .filter(({ actor }) => getSplitGroupRank(actor) === groupRank)
      .sort((first, second) => first.index - second.index);

    for (const { actor } of groupActors) {
      const slot = targetSlots[slotIndex];

      if (slot) {
        const entries = groupedTargets.get(groupRank) ?? [];
        entries.push({ actor, point: slot.point });
        groupedTargets.set(groupRank, entries);
      }
      slotIndex += 1;
    }
  }

  const activeRanks = [...groupedTargets.keys()].sort(
    (first, second) => first - second
  );
  const offsets = new Map(activeRanks.map((rank) => [rank, 0]));
  const axisWithOffset = (
    point: LayoutPoint,
    offset: number
  ): number => (vertical ? point.y : point.x) + offset;

  positionTargetsWithinSplitSections(
    groupedTargets,
    activeRanks,
    input,
    borderSpacing,
    actorGap,
    vertical
  );

  // FLEX can place several actors on the same ring coordinate. Separate
  // neighboring faction targets before packing so the search has a viable
  // ordering to refine instead of rejecting an otherwise spacious zone.
  for (let pass = 0; pass < activeRanks.length * 2; pass += 1) {
    for (let index = 0; index < activeRanks.length - 1; index += 1) {
      const lowerRank = activeRanks[index];
      const upperRank = activeRanks[index + 1];
      const lowerEntries = groupedTargets.get(lowerRank) ?? [];
      const upperEntries = groupedTargets.get(upperRank) ?? [];
      const lowerMax = Math.max(
        ...lowerEntries.map(({ actor, point }) =>
          axisWithOffset(point, offsets.get(lowerRank) ?? 0) + actor.radius
        )
      );
      const upperMin = Math.min(
        ...upperEntries.map(({ actor, point }) =>
          axisWithOffset(point, offsets.get(upperRank) ?? 0) - actor.radius
        )
      );
      const requiredSeparation = lowerMax + actorGap - upperMin;

      if (requiredSeparation > 0) {
        offsets.set(
          lowerRank,
          (offsets.get(lowerRank) ?? 0) - requiredSeparation / 2
        );
        offsets.set(
          upperRank,
          (offsets.get(upperRank) ?? 0) + requiredSeparation / 2
        );
      }
    }
  }

  const targets = new Map<string, LayoutPoint>();

  for (const [rank, entries] of groupedTargets) {
    const offset = offsets.get(rank) ?? 0;

    for (const { actor, point } of entries) {
      targets.set(
        actor.id,
        vertical
          ? { x: point.x, y: point.y + offset }
          : { x: point.x + offset, y: point.y }
      );
    }
  }

  return targets;
}

/**
 * Gives each active faction a logical band along the split axis. Band widths
 * follow faction counts, but a faction always receives enough width for its
 * largest actor. Targets keep their perpendicular FLEX coordinate and are
 * clamped to the actor's own usable portion of the band.
 */
function positionTargetsWithinSplitSections(
  groupedTargets: Map<
    number,
    Array<{ actor: NestingActor; point: LayoutPoint }>
  >,
  activeRanks: number[],
  input: PolygonNestingInput,
  borderSpacing: number,
  actorGap: number,
  vertical: boolean
): void {
  if (activeRanks.length < 2) {
    return;
  }

  const bounds = getPolygonBounds(input.polygon);
  const axisStart = vertical ? bounds.minY : bounds.minX;
  const axisEnd = vertical ? bounds.maxY : bounds.maxX;
  const usableStart = axisStart + borderSpacing;
  const usableLength = Math.max(0, axisEnd - axisStart - borderSpacing * 2);
  const groupRequirements = activeRanks.map((rank) => {
    const entries = groupedTargets.get(rank) ?? [];
    const plannedCount = input.actors.filter(
      (actor) => getSplitGroupRank(actor) === rank
    ).length;

    return {
      // The input is the post-mutation actor population. Counting it directly
      // makes an incoming actor claim its faction's share before boundaries
      // are calculated, rather than sizing from a pre-add target snapshot.
      count: plannedCount,
      minimumWidth: Math.max(...entries.map(({ actor }) => actor.radius * 2))
    };
  });
  const sectionWidths = getSplitSectionWidths(groupRequirements, usableLength);
  let cursor = usableStart;

  for (let index = 0; index < activeRanks.length; index += 1) {
    const rank = activeRanks[index];
    const width = sectionWidths[index];
    const sectionEnd = cursor + width;
    const entries = groupedTargets.get(rank) ?? [];
    const targetMinimum = Math.min(
      ...entries.map(({ point }) => vertical ? point.y : point.x)
    );
    const targetMaximum = Math.max(
      ...entries.map(({ point }) => vertical ? point.y : point.x)
    );
    const targetCenter = (targetMinimum + targetMaximum) / 2;
    const sectionCenter = (cursor + sectionEnd) / 2;
    const targetOffset = sectionCenter - targetCenter;
    const largestRadius = Math.max(
      ...entries.map(({ actor }) => actor.radius)
    );
    const compactColumnCount = Math.max(1, Math.ceil(Math.sqrt(entries.length)));
    const compactSpan = Math.min(
      Math.max(
        0,
        (compactColumnCount - 1) * (largestRadius * 2 + actorGap)
      ),
      Math.max(0, width - largestRadius * 2)
    );
    const targetSpan = targetMaximum - targetMinimum;
    const axisScale =
      targetSpan > compactSpan ? compactSpan / targetSpan : 1;

    for (const { actor, point } of entries) {
      const rawAxis = (vertical ? point.y : point.x) + targetOffset;
      const targetAxis =
        sectionCenter + (rawAxis - sectionCenter) * axisScale;
      const minimumCenter = cursor + actor.radius;
      const maximumCenter = sectionEnd - actor.radius;
      const clampedAxis = Math.min(
        maximumCenter,
        Math.max(minimumCenter, targetAxis)
      );

      if (vertical) {
        point.y = clampedAxis;
      } else {
        point.x = clampedAxis;
      }
    }

    cursor = sectionEnd;
  }
}

function getSplitAxisValue(
  point: LayoutPoint,
  orientation: LayoutOrientation | undefined
): number {
  return orientation === 'TOP_BOTTOM' ? point.y : point.x;
}

export function respectsSplitOrdering(
  actor: NestingActor,
  candidate: LayoutPoint,
  placedActors: NestingActor[],
  placements: Record<string, LayoutPoint>,
  orientation: LayoutOrientation | undefined
): boolean {
  const candidateAxis = getSplitAxisValue(candidate, orientation);
  const candidateRank = getSplitGroupRank(actor);

  return placedActors.every((placedActor) => {
    const placed = placements[placedActor.id];

    if (!placed || getSplitGroupRank(placedActor) === candidateRank) {
      return true;
    }

    const placedAxis = getSplitAxisValue(placed, orientation);

    return candidateRank < getSplitGroupRank(placedActor)
      ? candidateAxis + actor.radius <= placedAxis - placedActor.radius
      : placedAxis + placedActor.radius <= candidateAxis - actor.radius;
  });
}

export function hasValidSplitOrdering(
  actors: NestingActor[],
  placements: Record<string, LayoutPoint>,
  orientation: LayoutOrientation | undefined
): boolean {
  for (let firstIndex = 0; firstIndex < actors.length; firstIndex += 1) {
    const first = actors[firstIndex];
    const firstPoint = placements[first.id];

    if (!firstPoint) {
      return false;
    }

    for (
      let secondIndex = firstIndex + 1;
      secondIndex < actors.length;
      secondIndex += 1
    ) {
      const second = actors[secondIndex];

      if (getSplitGroupRank(first) === getSplitGroupRank(second)) {
        continue;
      }

      const secondPoint = placements[second.id];
      const firstAxis = getSplitAxisValue(firstPoint, orientation);
      const secondAxis = getSplitAxisValue(secondPoint, orientation);
      const firstBeforeSecond =
        getSplitGroupRank(first) < getSplitGroupRank(second);

      if (
        firstBeforeSecond
          ? firstAxis + first.radius > secondAxis - second.radius
          : secondAxis + second.radius > firstAxis - first.radius
      ) {
        return false;
      }
    }
  }

  return true;
}
