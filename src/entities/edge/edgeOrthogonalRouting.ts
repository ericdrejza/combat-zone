import type { LayoutPoint } from "@core/layout/types";
import { distance } from "./edgeBoundaryGeometry";

type SegmentClear = (start: LayoutPoint, end: LayoutPoint) => boolean;

function simplifyPath(path: LayoutPoint[]): LayoutPoint[] {
  return path.reduce<LayoutPoint[]>((result, point) => {
    const previous = result.at(-1);
    if (previous && distance(previous, point) <= 0.1) return result;
    const beforePrevious = result.at(-2);
    if (beforePrevious && previous && (
      beforePrevious.x === previous.x && previous.x === point.x ||
      beforePrevious.y === previous.y && previous.y === point.y
    )) {
      result[result.length - 1] = point;
      return result;
    }
    result.push(point);
    return result;
  }, []);
}

function direction(
  start: LayoutPoint,
  end: LayoutPoint
): "horizontal" | "vertical" {
  return start.y === end.y ? "horizontal" : "vertical";
}

function score(path: LayoutPoint[]) {
  const directions = path.slice(1).map((point, index) =>
    direction(path[index], point)
  );
  const turns = directions.slice(1).filter((value, index) =>
    value !== directions[index]
  ).length;
  const length = path.slice(1).reduce((total, point, index) =>
    total + distance(path[index], point), 0
  );
  return { length, turns };
}

function betterPath(
  current: LayoutPoint[] | undefined,
  candidate: LayoutPoint[]
): LayoutPoint[] {
  if (!current) return candidate;
  const currentScore = score(current);
  const candidateScore = score(candidate);
  if (candidateScore.turns !== currentScore.turns) {
    return candidateScore.turns < currentScore.turns ? candidate : current;
  }
  return candidateScore.length < currentScore.length ? candidate : current;
}

/** Chooses valid elbow orientations by turn count, then total route length. */
export function optimizeOrthogonalPath(
  path: LayoutPoint[],
  isSegmentClear: SegmentClear
): LayoutPoint[] | undefined {
  let candidates = [path.slice(0, 1)];
  for (let index = 1; index < path.length; index += 1) {
    const start = path[index - 1];
    const end = path[index];
    const elbows = start.x === end.x || start.y === end.y
      ? [end]
      : [{ x: end.x, y: start.y }, { x: start.x, y: end.y }];
    const next = new Map<string, LayoutPoint[]>();
    candidates.forEach((candidate) => {
      elbows.forEach((elbow) => {
        if (!isSegmentClear(start, elbow) || !isSegmentClear(elbow, end)) {
          return;
        }
        const addition = distance(elbow, end) <= 0.1 ? [end] : [elbow, end];
        const combined = simplifyPath([...candidate, ...addition]);
        const incoming = combined.length < 2
          ? "none"
          : direction(combined.at(-2)!, combined.at(-1)!);
        next.set(incoming, betterPath(next.get(incoming), combined));
      });
    });
    candidates = [...next.values()];
    if (candidates.length === 0) return undefined;
  }
  return candidates.reduce<LayoutPoint[] | undefined>(betterPath, undefined);
}
