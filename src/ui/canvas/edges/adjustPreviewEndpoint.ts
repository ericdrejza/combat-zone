import type { LayoutPoint } from "@core/layout/types";
import type { EdgePathSegment } from "@entities/edge/edgeCurveGeometry";

/** Reversing controls preserves the same Bézier while sharing both endpoint rules. */
export function reversePreviewSegments(parts: EdgePathSegment[]): EdgePathSegment[] {
  return [...parts].reverse().map(part => ({ start: part.end, end: part.start, controls: [...part.controls].reverse() }));
}

/** Forward motion consumes the outgoing span instead of connecting back through
 * the moving Zone. Other directions retain the lightweight connector preview. */
export function adjustPreviewEndpoint(parts: EdgePathSegment[], anchor: LayoutPoint): EdgePathSegment[] {
  if (!parts.length) return parts;
  const origin = parts[0].start;
  const dx = anchor.x - origin.x, dy = anchor.y - origin.y;
  if (Math.hypot(dx, dy) < 1e-6) return parts;
  const tangentPoint = [...parts[0].controls, parts[0].end].find(point => Math.hypot(point.x - origin.x, point.y - origin.y) > 1e-6);
  if (tangentPoint) {
    const tx = tangentPoint.x - origin.x, ty = tangentPoint.y - origin.y;
    if (dx * tx + dy * ty > 1e-6) {
      const index = parts.findIndex(part => (part.end.x - anchor.x) * tx + (part.end.y - anchor.y) * ty > 1e-6);
      if (index >= 0) {
        const first = parts[index];
        const shift = { x: anchor.x - first.start.x, y: anchor.y - first.start.y };
        const controls = first.controls.map((point, i) => {
          const weight = 1 - (i + 1) / (first.controls.length + 1);
          const moved = { x: point.x + shift.x * weight, y: point.y + shift.y * weight };
          // Keep a shortened curve's controls ahead of its new endpoint.
          const behind = ((moved.x - anchor.x) * tx + (moved.y - anchor.y) * ty) / (tx * tx + ty * ty);
          return behind < 0 ? { x: moved.x - tx * behind, y: moved.y - ty * behind } : moved;
        });
        return [{ start: anchor, end: first.end, controls }, ...parts.slice(index + 1)];
      }
    }
  }
  return [{ start: anchor, end: origin, controls: [] }, ...parts];
}
