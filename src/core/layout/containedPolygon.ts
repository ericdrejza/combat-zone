import type { LayoutPoint } from './types';
import { isSimplePolygon } from './polygonValidity';

const convexity = new WeakMap<LayoutPoint[], number>();

const cross = (a: LayoutPoint, b: LayoutPoint, p: LayoutPoint) =>
  (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);

/** A convex container contains every segment between its contained vertices.
 * Concave outlines deliberately fall back to normal collision checks: vertices
 * alone cannot prove that a reshaped edge stays inside their original outline.
 */
export function isContainedByConvexPolygon(polygon: LayoutPoint[], container: LayoutPoint[]): boolean {
  let winding = convexity.get(container);
  if (winding === undefined) {
    winding = 0;
    if (isSimplePolygon(container)) {
      for (let i = 0; i < container.length; i++) {
        const turn = Math.sign(cross(container[i], container[(i + 1) % container.length], container[(i + 2) % container.length]));
        if (!turn) continue;
        if (winding && winding !== turn) { winding = 0; break; }
        winding = turn;
      }
    }
    convexity.set(container, winding);
  }
  return !!winding && polygon.length >= 3 && polygon.every(point =>
    container.every((start, i) => winding! * cross(start, container[(i + 1) % container.length], point) >= 0));
}
