import type { LayoutPoint } from '@core/layout/types';
import type { GridLineStyle } from '@core/movement/types';

export function gridStrokeStyle(style: GridLineStyle = 'solid') {
  return { strokeDasharray: style === 'dashed' ? '8 6' : style === 'dotted' ? '1 6' : undefined,
    strokeLinecap: style === 'dotted' ? 'round' as const : 'butt' as const };
}
/** Crosshairs retain exactly the outer quarters of each logical cell edge. */
export function gridEdgeSegments(a: LayoutPoint, b: LayoutPoint, style: GridLineStyle = 'solid'): [LayoutPoint, LayoutPoint][] {
  const at = (t: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  return style === 'crosshair' ? [[a, at(0.25)], [at(0.75), b]] : [[a, b]];
}
export function regularGridEdgePath(vertices: LayoutPoint[], style: GridLineStyle = 'solid', close = true): string {
  return vertices.slice(0, close ? vertices.length : -1).flatMap((a, i) =>
    gridEdgeSegments(a, vertices[(i + 1) % vertices.length], style)
      .map(([p, q]) => `M${p.x},${p.y}L${q.x},${q.y}`)).join('');
}
