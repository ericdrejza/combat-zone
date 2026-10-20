import type { LayoutPoint } from '@core/layout/types';
const key = (p: LayoutPoint) => `${p.x.toFixed(5)},${p.y.toFixed(5)}`;

/** Cancel shared edges so cell-shaped AoE and movement envelopes share one outer outline. */
export function cellBoundary(cells: LayoutPoint[][]): LayoutPoint[][] {
  const edges = new Map<string, [LayoutPoint, LayoutPoint]>();
  for (const cell of cells) for (let i = 0; i < cell.length; i++) {
    const a = cell[i], b = cell[(i + 1) % cell.length], id = [key(a), key(b)].sort().join(':');
    if (edges.has(id)) edges.delete(id); else edges.set(id, [a, b]);
  }
  const outlines: LayoutPoint[][] = [];
  while (edges.size) {
    const [id, [first, second]] = edges.entries().next().value!;
    edges.delete(id); const points = [first, second];
    let end = second;
    while (key(end) !== key(first)) {
      const next = [...edges.entries()].find(([, [a]]) => key(a) === key(end));
      if (!next) break;
      edges.delete(next[0]); end = next[1][1]; points.push(end);
    }
    outlines.push(points);
  }
  return outlines;
}
