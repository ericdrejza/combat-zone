import type { EncounterState } from '@core/encounter/types';
import type { LayoutPoint } from '@core/layout/types';
import { isPointWithinCanvas } from '@core/layout/polygonCanvasBounds';
import { distanceToPolygonBoundary, isPointInPolygon } from '@core/layout/polygonGeometry';
import { doPolygonsOverlap } from '@core/layout/polygonCollision';
import { isSimplePolygon } from '@core/layout/polygonValidity';
import { resolveGridGeometry } from './gridScale';
import { anchorKey, canvasCellCenters, cellVertices, pointOrder } from './gridTopology';

const cross = (a: LayoutPoint, b: LayoutPoint, c: LayoutPoint) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
function intersects(a: LayoutPoint, b: LayoutPoint, c: LayoutPoint, d: LayoutPoint) {
  return cross(a, b, c) * cross(a, b, d) < -1e-8 && cross(c, d, a) * cross(c, d, b) < -1e-8;
}
export function validTracedPolygon(state: EncounterState, polygon: LayoutPoint[]): boolean {
  if (!isSimplePolygon(polygon) || !polygon.every(p => isPointWithinCanvas(p, state.canvasSize))) return false;
  return !state.zones.allIds.some(id => doPolygonsOverlap(polygon, state.zones.byId[id].polygon));
}

/** Only turns are materialized; straight runs remain one polygon side. */
export function compressCellRoute(route: LayoutPoint[]): LayoutPoint[] {
  return route.filter((point, index) => index === 0 || index === route.length - 1 || Math.abs(cross(route[index - 1], point, route[index + 1])) > 1e-6);
}

export type CellGraph = { points: Map<string, LayoutPoint>; neighbors: Map<string, string[]> };
export function buildCellGraph(state: Pick<EncounterState, "grid" | "canvasSize">, region?: { minX: number; minY: number; maxX: number; maxY: number }): CellGraph {
  const points = new Map<string, LayoutPoint>(), neighbors = new Map<string, Set<string>>();
  const grid = resolveGridGeometry(state.grid);
  for (const center of canvasCellCenters(state, region)) {
    const vertices = cellVertices(grid, center);
    for (let i = 0; i < vertices.length; i++) {
      const a = vertices[i], b = vertices[(i + 1) % vertices.length];
      if (!isPointWithinCanvas(a, state.canvasSize) || !isPointWithinCanvas(b, state.canvasSize)) continue;
      const first = anchorKey(a), last = anchorKey(b); points.set(first, a); points.set(last, b);
      if (!neighbors.has(first)) neighbors.set(first, new Set());
      if (!neighbors.has(last)) neighbors.set(last, new Set());
      neighbors.get(first)!.add(last); neighbors.get(last)!.add(first);
    }
  }
  return { points, neighbors: new Map([...neighbors].map(([id, adjacent]) => [id, [...adjacent].sort((a, b) => pointOrder(points.get(a)!, points.get(b)!))])) };
}

/** Breadth-first edge routing minimizes edge count, then turns and stable vertex order. */
export function traceCellRoute(state: EncounterState, start: LayoutPoint, goal: LayoutPoint, draft: LayoutPoint[] = [], policy: 'reject' | 'detour' = 'reject', closing = false, graph = buildCellGraph(state)): LayoutPoint[] | null {
  if (state.grid.warp) return null;
  const first = anchorKey(start), last = anchorKey(goal);
  if (!graph.points.has(first) || !graph.points.has(last)) return null;
  if (first === last) return [start];
  type Route = { ids: string[]; turns: number; direction?: string };
  let frontier: Route[] = [{ ids: [first], turns: 0 }];
  const seen = new Map<string, { steps: number; turns: number }>();
  function crossesZone(a: LayoutPoint, b: LayoutPoint) {
    const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    return state.zones.allIds.some(id => {
      const polygon = state.zones.byId[id].polygon;
      return [a, midpoint, b].some(point => isPointInPolygon(point, polygon) && distanceToPolygonBoundary(point, polygon) > 1e-6) ||
        polygon.some((point, i) => intersects(a, b, point, polygon[(i + 1) % polygon.length]));
    });
  }
  function acceptable(route: Route) {
    const raw = route.ids.map(id => graph.points.get(id)!);
    for (let index = 1; index < raw.length; index++) {
      const a = raw[index - 1], b = raw[index];
      if (crossesZone(a, b)) return false;
      if (draft.some((point, i) => i > 0 && intersects(a, b, draft[i - 1], point))) return false;
    }
    const generated = compressCellRoute(route.ids.map(id => graph.points.get(id)!));
    const polygon = [...draft, ...generated.slice(1)];
    if (closing) polygon.pop();
    if (!closing) {
      if (new Set(polygon.map(anchorKey)).size !== polygon.length) return false;
      for (let i = 1; i < polygon.length; i++) for (let j = i + 2; j < polygon.length; j++) {
        if (intersects(polygon[i - 1], polygon[i], polygon[j - 1], polygon[j])) return false;
      }
      return true;
    }
    return validTracedPolygon(state, polygon);
  }
  while (frontier.length) {
    frontier.sort((a, b) => a.turns - b.turns || compareRoutes(a.ids, b.ids, graph));
    const completed = frontier.filter(route => route.ids.at(-1) === last);
    if (completed.length) {
      const selected = completed.find(acceptable);
      if (selected) {
        const route = compressCellRoute(selected.ids.map(id => graph.points.get(id)!));
        route[0] = start; route[route.length - 1] = goal;
        return route;
      }
      if (policy === 'reject') return null;
    }
    const next: Route[] = [];
    for (const route of frontier) {
      const currentId = route.ids.at(-1)!;
      if (currentId === last) continue;
      const a = graph.points.get(currentId)!;
      for (const id of graph.neighbors.get(currentId) ?? []) {
        if (route.ids.includes(id)) continue;
        const b = graph.points.get(id)!, direction = `${Math.round(Math.atan2(b.y - a.y, b.x - a.x) * 1e6)}`;
        if (policy === 'detour') {
          if (crossesZone(a, b)) continue;
          if (draft.some((p, index) => index > 0 && intersects(a, b, draft[index - 1], p))) continue;
        }
        const turns = route.turns + (route.direction && route.direction !== direction ? 1 : 0);
        const key = `${id}:${direction}`, previous = seen.get(key), steps = route.ids.length;
        if (previous && (previous.steps < steps || previous.steps === steps && previous.turns <= turns)) continue;
        seen.set(key, { steps, turns }); next.push({ ids: [...route.ids, id], turns, direction });
      }
    }
    frontier = next;
  }
  return null;
}
function compareRoutes(first: string[], second: string[], graph: CellGraph) {
  for (let i = 0; i < Math.min(first.length, second.length); i++) {
    const order = pointOrder(graph.points.get(first[i])!, graph.points.get(second[i])!); if (order) return order;
  }
  return first.length - second.length;
}
