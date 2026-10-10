import type { GridGeometry } from '@core/movement/gridScale';
import type { EncounterState } from '@core/encounter/types';
import { resolveGridGeometry } from './gridScale';
import { getGridCoverage } from './gridCoverage';
import type { BackgroundFrame } from '@core/encounter/backgroundFrame';
import type { LayoutPoint } from '@core/layout/types';
import type { CanvasSize } from '@core/layout/polygonCanvasBounds';
import { gridToWorld, nearbyAnchors, worldToGrid } from './gridGeometry';

type Padding = { left: number; top: number; right: number; bottom: number };
const area = (points: LayoutPoint[]) => Math.abs(points.reduce((sum, p, i) => {
  const next = points[(i + 1) % points.length]; return sum + p.x * next.y - next.x * p.y;
}, 0)) / 2;

/** Clip cell geometry to the original canvas; eligibility never cascades during one operation. */
function clip(points: LayoutPoint[], canvas: CanvasSize) {
  for (const [axis, limit, greater] of [['x', 0, true], ['y', 0, true], ['x', canvas.width, false], ['y', canvas.height, false]] as const) {
    const output: LayoutPoint[] = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      const inside = (p: LayoutPoint) => greater ? p[axis] >= limit : p[axis] <= limit;
      if (inside(a)) output.push(a);
      if (inside(a) !== inside(b)) {
        const t = (limit - a[axis]) / (b[axis] - a[axis]);
        output.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      }
    }
    points = output;
  }
  return points;
}
export function cellPolygon(grid: GridGeometry, center: LayoutPoint) {
  const local = worldToGrid(grid, center), size = grid.cellSize;
  const vertices = grid.type === 'square' ? [
    { x: local.x - size / 2, y: local.y - size / 2 }, { x: local.x + size / 2, y: local.y - size / 2 },
    { x: local.x + size / 2, y: local.y + size / 2 }, { x: local.x - size / 2, y: local.y + size / 2 }
  ] : Array.from({ length: 6 }, (_, i) => ({ x: local.x + size / Math.sqrt(3) * Math.cos(i * Math.PI / 3), y: local.y + size / Math.sqrt(3) * Math.sin(i * Math.PI / 3) }));
  // Square edges stay straight under bilinear warps. Hex edges need curved-edge samples.
  return vertices.flatMap((a, i) => {
    const b = vertices[(i + 1) % vertices.length], count = grid.warp && grid.type !== 'square' ? 16 : 1;
    return Array.from({ length: count }, (_, step) => gridToWorld(grid, { x: a.x + (b.x - a.x) * step / count, y: a.y + (b.y - a.y) * step / count }));
  });
}

/** Exact quadratic boundaries keep warped hex cells whole rather than clipping their curves. */
export function cellBoundarySegments(grid: GridGeometry, polygon: LayoutPoint[]) {
  const stride = grid.warp && grid.type !== 'square' ? 16 : 1;
  const vertices = polygon.filter((_, index) => index % stride === 0);
  return vertices.map((start, index) => {
    const end = vertices[(index + 1) % vertices.length];
    const a = worldToGrid(grid, start), b = worldToGrid(grid, end);
    const mid = gridToWorld(grid, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    return { start, end, control: { x: 2 * mid.x - (start.x + end.x) / 2, y: 2 * mid.y - (start.y + end.y) / 2 } };
  });
}
function cellExtrema(grid: GridGeometry, polygon: LayoutPoint[]) {
  if (!grid.warp || grid.type === 'square') return polygon;
  return cellBoundarySegments(grid, polygon).flatMap(({ start, end, control }) => {
    const points = [start, end];
    for (const axis of ['x', 'y'] as const) {
      const t = (start[axis] - control[axis]) / (start[axis] - 2 * control[axis] + end[axis]);
      if (t > 0 && t < 1) points.push({ x: (1 - t) ** 2 * start.x + 2 * t * (1 - t) * control.x + t * t * end.x,
        y: (1 - t) ** 2 * start.y + 2 * t * (1 - t) * control.y + t * t * end.y });
    }
    return points;
  });
}

/** Perimeter cells plus the original rectangle form the completed grid footprint. */
export function completedBoundaryCells(grid: GridGeometry, frame: BackgroundFrame): LayoutPoint[][] {
  const seen = new Set<string>(), cells: LayoutPoint[][] = [];
  const inspect = (point: LayoutPoint) => {
    for (const center of nearbyAnchors(grid, point, 'medium', 1)) {
      const key = `${center.x.toFixed(6)},${center.y.toFixed(6)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const polygon = cellPolygon(grid, center);
      const relative = polygon.map(p => ({ x: p.x - frame.x, y: p.y - frame.y }));
      if (area(clip(relative, frame)) > 1e-8) cells.push(polygon);
    }
  };
  const visit = (a: LayoutPoint, b: LayoutPoint, depth = 0) => {
    const localA = worldToGrid(grid, a), localB = worldToGrid(grid, b);
    if (![localA.x, localA.y, localB.x, localB.y].every(Number.isFinite)) return;
    if (depth < 20 && Math.hypot(localB.x - localA.x, localB.y - localA.y) > grid.cellSize / 2) {
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      visit(a, mid, depth + 1); visit(mid, b, depth + 1);
    } else { inspect(a); inspect(b); }
  };
  const corners = [{ x: frame.x, y: frame.y }, { x: frame.x + frame.width, y: frame.y },
    { x: frame.x + frame.width, y: frame.y + frame.height }, { x: frame.x, y: frame.y + frame.height }];
  corners.forEach((a, i) => visit(a, corners[(i + 1) % 4]));
  return cells;
}

/** Finish the original coverage area once, avoiding newly exposed cells and cumulative expansion. */
export function getGridEdgePadding(grid: GridGeometry, canvas: CanvasSize, origin: LayoutPoint = { x: 0, y: 0 }): Padding {
  const padding = { left: 0, top: 0, right: 0, bottom: 0 };
  if (grid.type === 'square' && !grid.warp && Math.abs(grid.rotation % 90) < 1e-8) {
    const sides = (gridOrigin: number, start: number, extent: number) => {
      const cell = grid.cellSize;
      const first = gridOrigin + Math.floor((start - gridOrigin) / cell + 1e-9) * cell;
      const last = gridOrigin + Math.ceil((start + extent - gridOrigin) / cell - 1e-9) * cell;
      return [Math.max(0, start - first), Math.max(0, last - start - extent)];
    };
    [padding.left, padding.right] = sides(grid.origin.x, origin.x, canvas.width);
    [padding.top, padding.bottom] = sides(grid.origin.y, origin.y, canvas.height);
  } else {
    for (const polygon of completedBoundaryCells(grid, { ...canvas, ...origin })) for (const p of cellExtrema(grid, polygon)) {
      padding.left = Math.max(padding.left, origin.x - p.x); padding.top = Math.max(padding.top, origin.y - p.y);
      padding.right = Math.max(padding.right, p.x - origin.x - canvas.width); padding.bottom = Math.max(padding.bottom, p.y - origin.y - canvas.height);
    }
  }
  for (const side of ['left', 'top', 'right', 'bottom'] as const) if (padding[side] < 1e-7) padding[side] = 0;
  return padding;
}

export function completeGridEdges(state: EncounterState): EncounterState {
  const frame = getGridCoverage(state);
  const padding = getGridEdgePadding(resolveGridGeometry(state.grid), frame, frame);
  const width = frame.width + padding.left + padding.right, height = frame.height + padding.top + padding.bottom;
  const dx = padding.left - frame.x, dy = padding.top - frame.y;
  if (Math.abs(width - state.canvasSize.width) < 1e-7 && Math.abs(height - state.canvasSize.height) < 1e-7 && Math.abs(dx) < 1e-7 && Math.abs(dy) < 1e-7) return state;
  const shift = (p: LayoutPoint) => ({ x: p.x + dx, y: p.y + dy });
  return { ...state,
    canvasSize: { width, height },
    gridCoverage: state.backgroundImage ? undefined : { ...frame, ...shift(frame) },
    grid: { ...state.grid, origin: shift(state.grid.origin) },
    backgroundImage: state.backgroundImage ? { ...state.backgroundImage, frame: { ...frame, ...shift(frame) } } : null,
    actors: { ...state.actors, byId: Object.fromEntries(state.actors.allIds.map(id => {
      const actor = state.actors.byId[id]; return [id, actor.spatialPosition ? { ...actor, spatialPosition: shift(actor.spatialPosition) } : actor];
    })) },
    zones: { ...state.zones, byId: Object.fromEntries(state.zones.allIds.map(id => {
      const zone = state.zones.byId[id]; return [id, { ...zone, polygon: zone.polygon.map(shift) }];
    })) }
  };
}
