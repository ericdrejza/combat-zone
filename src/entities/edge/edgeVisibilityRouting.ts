import type { LayoutPoint } from "@core/layout/types";
import { center, distance } from "./edgeBoundaryGeometry";
import { createEdgeSegmentChecker } from "./edgeSegmentCollision";

export function segmentClear(
  start: LayoutPoint,
  end: LayoutPoint,
  obstacles: LayoutPoint[][],
  clearance: number
): boolean {
  return createEdgeSegmentChecker(obstacles, clearance)(start, end);
}

export function expandedCandidates(polygon: LayoutPoint[], clearance: number): LayoutPoint[] {
  const polygonCenter = center(polygon);
  return polygon.map((point) => {
    const dx = point.x - polygonCenter.x;
    const dy = point.y - polygonCenter.y;
    const length = Math.hypot(dx, dy) || 1;
    const normalX = dx / length;
    const normalY = dy / length;
    // Zero-clearance validation still keeps a small numerical gap. Candidate
    // waypoints must stay outside that gap rather than on an unusable boundary.
    const scale = Math.max(0.25, clearance) / Math.max(Math.min(Math.abs(normalX) || 1, Math.abs(normalY) || 1), 0.25);
    return { x: point.x + normalX * scale, y: point.y + normalY * scale };
  });
}

export function shortestVisibilityPath(
  start: LayoutPoint,
  end: LayoutPoint,
  obstacles: LayoutPoint[][],
  clearance: number,
  bounds: { height: number; width: number; x: number; y: number }
): LayoutPoint[] | undefined {
  const withinBounds = (point: LayoutPoint) => point.x >= bounds.x && point.y >= bounds.y && point.x <= bounds.x + bounds.width && point.y <= bounds.y + bounds.height;
  const clear = createEdgeSegmentChecker(obstacles, clearance);
  if (!withinBounds(start) || !withinBounds(end) || !clear(start, start) || !clear(end, end)) return undefined;
  const nodes = [start, end, ...obstacles.flatMap((polygon) => expandedCandidates(polygon, clearance)).filter(withinBounds)];
  const remaining = nodes.map(node => distance(node, end));
  const costs = nodes.map(() => Number.POSITIVE_INFINITY);
  const previous = nodes.map(() => -1);
  const visited = new Set<number>();
  costs[0] = 0;
  while (visited.size < nodes.length) {
    let current = -1;
    nodes.forEach((_, index) => {
      if (!visited.has(index) && (current < 0 || costs[index] + remaining[index] < costs[current] + remaining[current])) current = index;
    });
    if (current < 0 || !Number.isFinite(costs[current])) break;
    if (current === 1) break;
    visited.add(current);
    nodes.forEach((node, index) => {
      if (visited.has(index) || !withinBounds(node)) return;
      const nextCost = costs[current] + distance(nodes[current], node);
      if (nextCost < costs[index] && nextCost + remaining[index] <= costs[1] && clear(nodes[current], node)) {
        costs[index] = nextCost;
        previous[index] = current;
      }
    });
  }
  if (!Number.isFinite(costs[1])) return undefined;
  const path: LayoutPoint[] = [];
  for (let index = 1; index >= 0; index = previous[index]) {
    path.unshift(nodes[index]);
    if (index === 0) break;
  }
  return path;
}
