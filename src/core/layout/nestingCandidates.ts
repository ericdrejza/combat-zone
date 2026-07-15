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

  const xValues = new Set([
    (bounds.minX + bounds.maxX) / 2,
    minX,
    maxX
  ]);
  const yValues = new Set([
    (bounds.minY + bounds.maxY) / 2,
    minY,
    maxY
  ]);

  for (let x = minX; x <= maxX; x += settings.candidateStep) {
    xValues.add(x);
  }
  for (let y = minY; y <= maxY; y += settings.candidateStep) {
    yValues.add(y);
  }

  for (const x of xValues) {
    for (const y of yValues) {
      const candidate = addCandidate({ x, y });

      if (candidate) {
        yield candidate;
      }
    }
  }
}
