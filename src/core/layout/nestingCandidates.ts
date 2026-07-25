import type { LayoutPoint } from "./types";
import { getPolygonBounds } from "./polygonGeometry";
import type { NestingActor, PolygonNestingSettings } from "./nesting_ts";

/**
 * Streams candidate centers so a valid preferred target can finish packing
 * without allocating or scoring the fallback grid.
 */
export function* getNestingCandidatePoints(
  polygon: LayoutPoint[],
  actor: NestingActor,
  borderSpacing: number,
  target: LayoutPoint,
  settings: PolygonNestingSettings
): Generator<LayoutPoint> {
  const bounds = getPolygonBounds(polygon);
  const padding = actor.radius + borderSpacing;
  const minX = bounds.minX + padding;
  const maxX = bounds.maxX - padding;
  const minY = bounds.minY + padding;
  const maxY = bounds.maxY - padding;

  if (minX > maxX || minY > maxY) {
    return;
  }

  const seen = new Set<string>();
  const addCandidate = (candidate: LayoutPoint): LayoutPoint | undefined => {
    const key = `${candidate.x}:${candidate.y}`;

    if (!seen.has(key)) {
      seen.add(key);
      return candidate;
    }

    return undefined;
  };

  const firstCandidate = addCandidate(target);

  if (firstCandidate) {
    yield firstCandidate;
  }

  const columnCount = Math.floor((maxX - minX) / settings.candidateStep) + 1;
  const rowCount = Math.floor((maxY - minY) / settings.candidateStep) + 1;
  const targetColumn = Math.max(
    0,
    Math.min(
      columnCount - 1,
      Math.round((target.x - minX) / settings.candidateStep)
    )
  );
  const targetRow = Math.max(
    0,
    Math.min(
      rowCount - 1,
      Math.round((target.y - minY) / settings.candidateStep)
    )
  );
  const maximumRing = Math.max(columnCount, rowCount);

  // Visit nearby grid cells before distant fallbacks. The previous nested
  // full-grid scan evaluated the entire zone even when a nearby point fit.
  for (let ring = 0; ring < maximumRing; ring += 1) {
    const ringCandidates: LayoutPoint[] = [];

    for (let columnOffset = -ring; columnOffset <= ring; columnOffset += 1) {
      for (const rowOffset of ring === 0 ? [0] : [-ring, ring]) {
        const column = targetColumn + columnOffset;
        const row = targetRow + rowOffset;

        if (
          column >= 0 &&
          column < columnCount &&
          row >= 0 &&
          row < rowCount
        ) {
          ringCandidates.push({
            x: minX + column * settings.candidateStep,
            y: minY + row * settings.candidateStep
          });
        }
      }
    }

    for (let rowOffset = -ring + 1; rowOffset < ring; rowOffset += 1) {
      for (const columnOffset of [-ring, ring]) {
        const column = targetColumn + columnOffset;
        const row = targetRow + rowOffset;

        if (
          column >= 0 &&
          column < columnCount &&
          row >= 0 &&
          row < rowCount
        ) {
          ringCandidates.push({
            x: minX + column * settings.candidateStep,
            y: minY + row * settings.candidateStep
          });
        }
      }
    }

    ringCandidates.sort(
      (first, second) =>
        (first.x - target.x) ** 2 +
          (first.y - target.y) ** 2 -
          ((second.x - target.x) ** 2 + (second.y - target.y) ** 2) ||
        first.y - second.y ||
        first.x - second.x
    );

    for (const point of ringCandidates) {
      const candidate = addCandidate(point);

      if (candidate) {
        yield candidate;
      }
    }
  }

  // Grid stepping may not land exactly on the far bounds.
  for (const x of [minX, maxX, (minX + maxX) / 2]) {
    for (const y of [minY, maxY, (minY + maxY) / 2]) {
      const candidate = addCandidate({ x, y });

      if (candidate) {
        yield candidate;
      }
    }
  }
}
