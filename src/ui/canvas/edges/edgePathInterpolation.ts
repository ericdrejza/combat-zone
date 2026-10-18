import type { LayoutPoint } from "@core/layout/types";
import { getEdgePathSegments } from "@entities/edge/edgeCurveGeometry";

type Cubic = [LayoutPoint, LayoutPoint, LayoutPoint, LayoutPoint];
const mix = (a: LayoutPoint, b: LayoutPoint, t: number): LayoutPoint => ({
  x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t
});

function cubics(data: string): Cubic[] {
  return getEdgePathSegments(data).map(({ start, end, controls }) => controls.length === 2
    ? [start, controls[0], controls[1], end]
    : controls.length === 1
      ? [start, mix(start, controls[0], 2 / 3), mix(end, controls[0], 2 / 3), end]
      : [start, mix(start, end, 1 / 3), mix(start, end, 2 / 3), end]);
}

function split([a, b, c, d]: Cubic, t: number): [Cubic, Cubic] {
  const ab = mix(a, b, t), bc = mix(b, c, t), cd = mix(c, d, t);
  const abc = mix(ab, bc, t), bcd = mix(bc, cd, t), middle = mix(abc, bcd, t);
  return [[a, ab, abc, middle], [middle, bcd, cd, d]];
}

/** Subdivision preserves exact geometry while giving Motion matching command counts. */
function normalize(segments: Cubic[], count: number): string {
  const result: Cubic[] = [];
  segments.forEach((segment, index) => {
    const pieces = Math.floor(count / segments.length) + (index < count % segments.length ? 1 : 0);
    let remaining = segment;
    for (let i = pieces; i > 1; i--) {
      const [part, rest] = split(remaining, 1 / i);
      result.push(part);
      remaining = rest;
    }
    result.push(remaining);
  });
  return `M ${result[0][0].x} ${result[0][0].y} ` + result.map(segment =>
    `C ${segment.slice(1).map(p => `${p.x} ${p.y}`).join(" ")}`).join(" ");
}

export function compatibleEdgePaths(from: string, to: string): [string, string] {
  const a = cubics(from), b = cubics(to);
  if (!a.length || !b.length) return [to, to];
  const count = Math.max(a.length, b.length);
  return [normalize(a, count), normalize(b, count)];
}
