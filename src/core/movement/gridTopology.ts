import { isSquareTopology } from './gridProjection';
import type { EncounterState } from '@core/encounter/types';
import type { ActorSize } from '@entities/actor/types';
import type { LayoutPoint } from '@core/layout/types';
import { resolveGridGeometry, type GridGeometry } from './gridScale';
import { gridToWorld, worldToGrid, nearbyAnchors } from './gridGeometry';
import { cellPolygon } from './gridEdgeCompletion';

export const anchorKey = (point: LayoutPoint) => `${point.x.toFixed(6)},${point.y.toFixed(6)}`;
export const pointOrder = (a: LayoutPoint, b: LayoutPoint) => a.y - b.y || a.x - b.x;
export const pointDistance = (a: LayoutPoint, b: LayoutPoint) => Math.hypot(a.x - b.x, a.y - b.y);

/** Enumerates the finite lattice covering the canvas, without persisted cell addresses. */
export function canvasCellCenters(state: EncounterState): LayoutPoint[] {
  const grid = resolveGridGeometry(state.grid), { width, height } = state.canvasSize;
  const corners = [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height }].map(p => worldToGrid(grid, p));
  if (corners.some(p => !Number.isFinite(p.x + p.y))) return [];
  const size = grid.cellSize, spacingX = isSquareTopology(grid.type) ? size : size * Math.sqrt(3) / 2;
  const minQ = Math.floor(Math.min(...corners.map(p => p.x)) / spacingX) - 3;
  const maxQ = Math.ceil(Math.max(...corners.map(p => p.x)) / spacingX) + 3;
  const minY = Math.min(...corners.map(p => p.y)), maxY = Math.max(...corners.map(p => p.y));
  const points: LayoutPoint[] = [];
  for (let q = minQ; q <= maxQ; q++) {
    const shift = isSquareTopology(grid.type) ? 0.5 : q / 2;
    for (let r = Math.floor(minY / size - shift) - 3; r <= Math.ceil(maxY / size - shift) + 3; r++) {
      points.push(gridToWorld(grid, { x: (q + (isSquareTopology(grid.type) ? 0.5 : 0)) * spacingX, y: (r + shift) * size }));
    }
  }
  return points;
}

export function cellVertices(grid: GridGeometry, center: LayoutPoint): LayoutPoint[] {
  const local = worldToGrid(grid, center), size = grid.cellSize;
  return (isSquareTopology(grid.type) ? [
    { x: local.x - size / 2, y: local.y - size / 2 }, { x: local.x + size / 2, y: local.y - size / 2 },
    { x: local.x + size / 2, y: local.y + size / 2 }, { x: local.x - size / 2, y: local.y + size / 2 }
  ] : Array.from({ length: 6 }, (_, k) => ({ x: local.x + size / Math.sqrt(3) * Math.cos(k * Math.PI / 3), y: local.y + size / Math.sqrt(3) * Math.sin(k * Math.PI / 3) }))).map(p => gridToWorld(grid, p));
}

export function canvasAnchors(state: EncounterState, size: ActorSize): LayoutPoint[] {
  const grid = resolveGridGeometry(state.grid), centers = canvasCellCenters(state);
  const points = size === 'large' ? centers.flatMap(center => cellVertices(grid, center)) : centers;
  return [...new Map(points.map(p => [anchorKey(p), p])).values()].sort(pointOrder);
}

export function nearestGridVertex(state: EncounterState, point: LayoutPoint): LayoutPoint {
  const grid = resolveGridGeometry(state.grid);
  return nearbyAnchors(grid, point, 'large', 3).sort((a, b) => pointDistance(a, point) - pointDistance(b, point) || pointOrder(a, b))[0] ?? point;
}

/** Shared actor cell neighborhoods for membership and purely visual Trim. */
export function actorAnchorCells(state: EncounterState, point: LayoutPoint, size: ActorSize) {
  const grid = resolveGridGeometry(state.grid), local = worldToGrid(grid, point);
  const centers = nearbyAnchors(grid, point, 'medium', 2).filter(center => {
    if (size === 'large') return cellVertices(grid, center).some(vertex => pointDistance(vertex, point) < 1e-5);
    const other = worldToGrid(grid, center);
    if (size === 'xLarge') return isSquareTopology(grid.type)
      ? Math.abs(other.x - local.x) <= grid.cellSize + 1e-5 && Math.abs(other.y - local.y) <= grid.cellSize + 1e-5
      : pointDistance(other, local) <= grid.cellSize + 1e-5;
    return pointDistance(other, local) < 1e-5;
  });
  return centers.map(center => ({ center, polygon: cellPolygon(grid, center) }));
}
