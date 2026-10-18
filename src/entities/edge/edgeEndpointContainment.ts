import { distanceToPolygonBoundary, distanceToSegment, isPointInPolygon, segmentsIntersect } from "@core/layout/polygonGeometry";
import type { LayoutPoint } from "@core/layout/types";

function enclosed(inner: LayoutPoint[], outer: LayoutPoint[]): boolean {
  if (!inner.length || !outer.length || !inner.every(point => isPointInPolygon(point, outer) && distanceToPolygonBoundary(point, outer) > 1e-6)) return false;
  // Checking vertices alone is insufficient for concave containers: a side
  // could leave through a notch. Boundary crossings or contacts disprove enclosure.
  return !inner.some((a, index) => {
    const b = inner[(index + 1) % inner.length];
    return outer.some((c, otherIndex) => segmentsIntersect(a, b, c, outer[(otherIndex + 1) % outer.length]) || distanceToSegment(c, a, b) < 1e-6);
  });
}

/** A route between nested endpoint boundaries must cross one of its owning Zones. */
export function hasEnclosedEdgeEndpoint(from: LayoutPoint[], to: LayoutPoint[], obstacles: LayoutPoint[][] = []): boolean {
  return enclosed(from, to) || enclosed(to, from) || obstacles.some(polygon => enclosed(from, polygon) || enclosed(to, polygon));
}
