import { measureEdgeRouting } from "./edgeRoutingMetrics";
import { distanceToPolygonBoundary, distanceToSegment, isPointInPolygon, segmentsIntersect } from "@core/layout/polygonGeometry";
import type { LayoutPoint } from "@core/layout/types";
import { getEdgePathSegments, type EdgePathSegment } from "./edgeCurveGeometry";
import { areEdgeControlHullsClear } from "./edgeCurveSeparation";

function interpolate(a: LayoutPoint, b: LayoutPoint): LayoutPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
function flatten(points: LayoutPoint[], output: LayoutPoint[], depth = 0, lengthOnly = false): void {
  const start = points[0], end = points.at(-1)!;
  const chord = Math.hypot(end.x - start.x, end.y - start.y);
  const length = points.slice(1).reduce((sum, point, index) => sum + Math.hypot(point.x - points[index].x, point.y - points[index].y), 0);
  if (depth >= 16 || (length - chord < 0.01 && (lengthOnly || length <= 2))) { output.push(end); return; }
  const left = [start], right = [end];
  let row = points;
  while (row.length > 1) {
    row = row.slice(1).map((point, index) => interpolate(row[index], point));
    left.push(row[0]); right.unshift(row.at(-1)!);
  }
  flatten(left, output, depth + 1, lengthOnly); flatten(right, output, depth + 1, lengthOnly);
}
function samples(segment: EdgePathSegment, depth = 0): LayoutPoint[] {
  if (!segment.controls.length) return [segment.start, interpolate(segment.start, segment.end), segment.end];
  const result = [segment.start];
  flatten([segment.start, ...segment.controls, segment.end], result, depth);
  if (result.length === 2) {
    let row = [segment.start, ...segment.controls, segment.end];
    while (row.length > 1) row = row.slice(1).map((point, index) => interpolate(row[index], point));
    result.splice(1, 0, row[0]);
  }
  return result;
}

export type PathSpace = {
  polygons: LayoutPoint[][];
  obstaclePolygons: LayoutPoint[][];
  clearance: number;
  bounds: { x: number; y: number; width: number; height: number };
};

/** Validate the actual Bézier path, including smoothing between routed waypoints. */
function checkEdgePath(data: string, space: PathSpace, sampleDepth = 0): boolean {
  const parts = getEdgePathSegments(data);
  if (!parts.length) return false;
  if (areEdgeControlHullsClear(parts, space)) return true;
  const polygons = space.polygons.map(polygon => ({ polygon,
    minX: Math.min(...polygon.map(point => point.x)), maxX: Math.max(...polygon.map(point => point.x)),
    minY: Math.min(...polygon.map(point => point.y)), maxY: Math.max(...polygon.map(point => point.y)) }));
  const nearby = (point: LayoutPoint, entry: typeof polygons[number], margin = 0) => point.x >= entry.minX - margin && point.x <= entry.maxX + margin && point.y >= entry.minY - margin && point.y <= entry.maxY + margin;
  const obstacles = polygons.filter(entry => space.obstaclePolygons.includes(entry.polygon));
  const interior = (point: LayoutPoint) => polygons.some(entry => nearby(point, entry) && isPointInPolygon(point, entry.polygon) && distanceToPolygonBoundary(point, entry.polygon) > 1e-6);
  // Reject inward endpoint tangents before flattening potentially large curves.
  for (const [segment, t] of [[parts[0], 0.001], [parts.at(-1)!, 0.999]] as const) {
    let row = [segment.start, ...segment.controls, segment.end];
    while (row.length > 1) row = row.slice(1).map((point, index) => ({ x: row[index].x * (1 - t) + point.x * t, y: row[index].y * (1 - t) + point.y * t }));
    if (interior(row[0])) return false;
  }
  return parts.every((segment, partIndex) => {
    if (!segment.controls.length && obstacles.some(entry => entry.polygon.some((a, index) => {
      const b = entry.polygon[(index + 1) % entry.polygon.length];
      const separation = Math.min(distanceToSegment(a, segment.start, segment.end), distanceToSegment(b, segment.start, segment.end), distanceToSegment(segment.start, a, b), distanceToSegment(segment.end, a, b));
      return separation < Math.max(0.25, space.clearance) - 0.01;
    }))) return false;
    let points = samples(segment, sampleDepth);
    if (!segment.controls.length) {
      // Vertex contacts can enter a polygon without a proper edge crossing.
      // Check every resulting interval rather than sampling by world distance.
      const a = segment.start, b = segment.end, dx = b.x - a.x, dy = b.y - a.y;
      const squared = dx * dx + dy * dy;
      const cuts = [0, 1, ...space.polygons.flatMap(polygon => polygon.filter(point => distanceToSegment(point, a, b) < 1e-6)
        .map(point => squared ? ((point.x - a.x) * dx + (point.y - a.y) * dy) / squared : 0))].sort((x, y) => x - y);
      points = cuts.flatMap((t, index) => index ? [(cuts[index - 1] + t) / 2, t] : [t]).map(t => ({ x: a.x + dx * t, y: a.y + dy * t }));
    }
    return points.every((point, index) => {
      if (index > 0 && polygons.some(entry => {
        const previous = points[index - 1];
        if (Math.max(previous.x, point.x) < entry.minX || Math.min(previous.x, point.x) > entry.maxX || Math.max(previous.y, point.y) < entry.minY || Math.min(previous.y, point.y) > entry.maxY) return false;
        return entry.polygon.some((vertex, vertexIndex) => segmentsIntersect(previous, point, vertex, entry.polygon[(vertexIndex + 1) % entry.polygon.length]));
      })) return false;
      if ((partIndex === 0 && index === 0) || (partIndex === parts.length - 1 && index === points.length - 1)) return true;
      const { bounds } = space;
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < bounds.x || point.y < bounds.y || point.x > bounds.x + bounds.width || point.y > bounds.y + bounds.height) return false;
      if (polygons.some(entry => nearby(point, entry) && isPointInPolygon(point, entry.polygon) && distanceToPolygonBoundary(point, entry.polygon) > 1e-6)) return false;
      const clearance = Math.max(0.25, space.clearance) - 0.01;
      return !obstacles.some(entry => nearby(point, entry, clearance) && distanceToPolygonBoundary(point, entry.polygon) < clearance);
    });
  });
}

/** Rounded corners preserve tangent direction across the complete obstacle route. */
export function getRoundedEdgePath(path: LayoutPoint[], fraction: number): string {
  if (path.length < 2) return "";
  const commands = [`M ${path[0].x} ${path[0].y}`];
  let current = path[0];
  function straight(end: LayoutPoint) {
    const a = { x: current.x + (end.x - current.x) / 3, y: current.y + (end.y - current.y) / 3 };
    const b = { x: current.x + (end.x - current.x) * 2 / 3, y: current.y + (end.y - current.y) * 2 / 3 };
    commands.push(`C ${a.x} ${a.y} ${b.x} ${b.y} ${end.x} ${end.y}`);
    current = end;
  }
  for (let index = 1; index < path.length - 1; index++) {
    const previous = path[index - 1], corner = path[index], next = path[index + 1];
    const incoming = Math.hypot(corner.x - previous.x, corner.y - previous.y);
    const outgoing = Math.hypot(next.x - corner.x, next.y - corner.y);
    const radius = Math.min(incoming, outgoing) * fraction;
    if (!incoming || !outgoing) continue;
    const entry = { x: corner.x + (previous.x - corner.x) * radius / incoming, y: corner.y + (previous.y - corner.y) * radius / incoming };
    const exit = { x: corner.x + (next.x - corner.x) * radius / outgoing, y: corner.y + (next.y - corner.y) * radius / outgoing };
    straight(entry);
    commands.push(`Q ${corner.x} ${corner.y} ${exit.x} ${exit.y}`);
    current = exit;
  }
  straight(path.at(-1)!);
  return commands.join(" ");
}

/** Arc length scoring compares candidate attachments using their rendered curve. */
function calculatePathLength(data: string): number {
  return getEdgePathSegments(data).reduce((total, segment) => {
    const points = [segment.start];
    flatten([segment.start, ...segment.controls, segment.end], points, 0, true);
    return total + points.slice(1).reduce((sum, point, index) => sum + Math.hypot(point.x - points[index].x, point.y - points[index].y), 0);
  }, 0);
}

function segmentData(segment: EdgePathSegment): string {
  return `M ${segment.start.x} ${segment.start.y} ${segment.controls.length === 2 ? "C" : "Q"} ${[...segment.controls, segment.end].map(point => `${point.x} ${point.y}`).join(" ")}`;
}

/** Prove clear subcurves with their hulls; sample only unresolved neighborhoods. */
function checkCurveSegment(segment: EdgePathSegment, space: PathSpace, depth = 0): boolean {
  if (areEdgeControlHullsClear([segment], space)) return true;
  const points = [segment.start, ...segment.controls, segment.end];
  const length = points.slice(1).reduce((sum, point, index) => sum + Math.hypot(point.x - points[index].x, point.y - points[index].y), 0);
  if (depth >= 16 || length <= 2) return checkEdgePath(segmentData(segment), space, depth);
  const left = [points[0]], right = [points.at(-1)!];
  let row = points;
  while (row.length > 1) {
    row = row.slice(1).map((point, index) => interpolate(row[index], point));
    left.push(row[0]); right.unshift(row.at(-1)!);
  }
  const part = (p: LayoutPoint[]): EdgePathSegment => ({ start: p[0], end: p.at(-1)!, controls: p.slice(1, -1) });
  return checkCurveSegment(part(left), space, depth + 1) && checkCurveSegment(part(right), space, depth + 1);
}

/** Timings distinguish repeated collision checks from attachment-length scoring. */
export function isEdgePathClear(data: string, space: PathSpace): boolean {
  return measureEdgeRouting("collision", () => {
    const parts = getEdgePathSegments(data);
    if (!parts.length) return false;
    if (areEdgeControlHullsClear(parts, space)) return true;
    // Reject inward endpoint tangents before subdividing candidate curves.
    for (const [segment, t] of [[parts[0], 0.001], [parts.at(-1)!, 0.999]] as const) {
      let row = [segment.start, ...segment.controls, segment.end];
      while (row.length > 1) row = row.slice(1).map((point, index) => ({ x: row[index].x * (1 - t) + point.x * t, y: row[index].y * (1 - t) + point.y * t }));
      if (space.polygons.some(polygon => isPointInPolygon(row[0], polygon) && distanceToPolygonBoundary(row[0], polygon) > 1e-6)) return false;
    }
    // Preserve exact interval/contact checks for line segments. Curves can be
    // certified in large clear spans instead of sampling their entire length.
    return parts.every(part => part.controls.length ? checkCurveSegment(part, space)
      : checkEdgePath(`M ${part.start.x} ${part.start.y} L ${part.end.x} ${part.end.y}`, space));
  });
}
export function getEdgePathLength(data: string): number {
  return measureEdgeRouting("lengthScoring", () => calculatePathLength(data));
}
