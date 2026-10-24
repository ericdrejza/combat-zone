import type { LayoutPoint } from '@core/layout/types';

/** Bounded follower chain: the pointer stays precise while the tail flows behind it. */
export function advanceFocusTrail(points: LayoutPoint[], target: LayoutPoint, delta: number, length: number) {
  const blend = length === 0 ? 1 : 1 - Math.exp(-Math.min(64, Math.max(0, delta)) / (12 + length * 1.4));
  let previous = target;
  return points.map(point => {
    const next = { x: point.x + (previous.x - point.x) * blend, y: point.y + (previous.y - point.y) * blend };
    previous = next;
    return next;
  });
}

/** Quadratic joins keep rapid changes of direction smooth rather than angular. */
export function focusTrailPath(head: LayoutPoint, points: LayoutPoint[]) {
  let path = `M ${head.x} ${head.y}`;
  points.forEach((point, index) => {
    const next = points[index + 1] ?? point;
    path += ` Q ${point.x} ${point.y} ${(point.x + next.x) / 2} ${(point.y + next.y) / 2}`;
  });
  return path;
}
