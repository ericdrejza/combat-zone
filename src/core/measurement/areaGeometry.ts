import { cellIsCovered, touchesConeOrigin, type RulerCellCoverage, type AreaCoverageShape } from './cellCoverage';
import { polygonArea } from './coverageGeometry';
import { coneGeometry } from './coneGeometry';
import { gridLineCenters } from './gridLine';
import { cellBoundary } from './cellBoundary';
import type { LayoutPoint } from '@core/layout/types';
import type { EncounterState } from '@core/encounter/types';
import { gridToWorld, worldToGrid, snapToGrid } from '@core/movement/gridGeometry';
import { resolveGridGeometry } from '@core/movement/gridScale';
import { isSquareTopology } from '@core/movement/gridProjection';
import { canvasCellCenters, cellVertices, nearestGridVertex } from '@core/movement/gridTopology';
import { measureRoute, projectPolyline } from './distance';
import type { DiagonalCost, RulerOptions } from './types';

export type AreaMeasurement = { outlines: LayoutPoint[][]; cells: LayoutPoint[][]; area: number; distance: number; origin?: LayoutPoint; coverageShape?: AreaCoverageShape };
const epsilon = 1e-6;
const distance = (a: LayoutPoint, b: LayoutPoint) => Math.hypot(a.x - b.x, a.y - b.y);

export function rulerSnapEnabled(state: EncounterState, options: RulerOptions) {
  return state.movementRules.snapToGrid;
}
export function snapRulerOrigin(state: EncounterState, point: LayoutPoint, options: RulerOptions): LayoutPoint {
  if (!rulerSnapEnabled(state, options)) return point;
  const grid = resolveGridGeometry(state.grid);
  if (!isSquareTopology(grid.type)) return snapToGrid(grid, point, 'medium');
  if (options.shape === 'circle' || options.shape === 'rectangle') return nearestGridVertex(state, point);
  return snapToGrid(grid, point, 'medium');
}

/** Shapes and cell coverage are measured in the undistorted map, independently of display projection. */
export function measureArea(state: EncounterState, rawStart: LayoutPoint, end: LayoutPoint, options: RulerOptions,
  policy: DiagonalCost = 'one', calculateArea = true, coverage: RulerCellCoverage = 'corners-or-center'): AreaMeasurement {
  const grid = resolveGridGeometry(state.grid), s = grid.cellSize, unit = state.grid.distancePerCell ?? 5;
  const cone = options.shape === 'cone' ? coneGeometry(state, rawStart, end) : null;
  const start = cone?.origin ?? snapRulerOrigin(state, rawStart, options), a = worldToGrid(grid, start);
  const snapped = rulerSnapEnabled(state, options);
  const snappedEnd = snapped && options.shape === 'rectangle' ? nearestGridVertex(state, end) : end;
  const b = worldToGrid(grid, snappedEnd);
  const rawRadius = distance(a, b);
  const radius = snapped && (options.shape === 'circle' || options.shape === 'cone') ? Math.round(rawRadius / s) * s : rawRadius;
  const rawDirection = Math.atan2(b.y - a.y, b.x - a.x);
  const direction = cone?.direction ?? rawDirection;
  const empty: AreaMeasurement = { cells: [], outlines: [], area: 0, distance: radius / s * unit, origin: start };
  if (radius < epsilon) return empty;
  if (options.shape === 'line' && rulerSnapEnabled(state, options)) {
    const cells = gridLineCenters(state.grid, start, end).map(center => cellVertices(grid, center)).filter(polygon => polygon.every(p => p.x >= 0 && p.y >= 0 && p.x <= state.canvasSize.width && p.y <= state.canvasSize.height));
    const area = calculateArea ? cells.length * (isSquareTopology(grid.type) ? 1 : Math.sqrt(3) / 2) * unit ** 2 : 0;
    return { ...empty, outlines: cellBoundary(cells.map(points => points.map(p => worldToGrid(grid, p)))).map(points => projectPolyline(state.grid, points, true)), cells, area,
      distance: measureRoute(state.grid, [start, end], true, policy).distance };
  }
  let polygon: LayoutPoint[];
  const half = (options.angle ?? (isSquareTopology(grid.type) ? 90 : 60)) * Math.PI / 360;
  if (options.shape === 'rectangle') polygon = [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }];
  else if (options.shape === 'line') {
    const normal = { x: -Math.sin(direction) * s / 2, y: Math.cos(direction) * s / 2 };
    polygon = [{ x: a.x + normal.x, y: a.y + normal.y }, { x: b.x + normal.x, y: b.y + normal.y }, { x: b.x - normal.x, y: b.y - normal.y }, { x: a.x - normal.x, y: a.y - normal.y }];
  } else {
    const cone = options.shape === 'cone';
    const arc = Array.from({ length: 129 }, (_, i) => {
      const angle = cone ? direction - half + 2 * half * i / 128 : 2 * Math.PI * i / 128;
      return { x: a.x + radius * Math.cos(angle), y: a.y + radius * Math.sin(angle) };
    });
    polygon = cone ? [a, ...arc] : arc;
  }
  const inside = (p: LayoutPoint) => {
    const dx = p.x - a.x, dy = p.y - a.y;
    if (options.shape === 'circle') return Math.hypot(dx, dy) <= radius + epsilon;
    if (options.shape === 'cone') {
      const delta = Math.atan2(Math.sin(Math.atan2(dy, dx) - direction), Math.cos(Math.atan2(dy, dx) - direction));
      return Math.hypot(dx, dy) <= radius + epsilon && (Math.hypot(dx, dy) < epsilon || Math.abs(delta) <= half + epsilon);
    }
    if (options.shape === 'line') {
      const forward = dx * Math.cos(direction) + dy * Math.sin(direction), cross = -dx * Math.sin(direction) + dy * Math.cos(direction);
      return forward >= -epsilon && forward <= radius + epsilon && Math.abs(cross) <= s / 2 + epsilon;
    }
    return p.x >= Math.min(a.x, b.x) - epsilon && p.x <= Math.max(a.x, b.x) + epsilon && p.y >= Math.min(a.y, b.y) - epsilon && p.y <= Math.max(a.y, b.y) + epsilon;
  };
  const outline = projectPolyline(state.grid, polygon, true);
  const region = { minX: Math.max(0, Math.min(...outline.map(p => p.x))), minY: Math.max(0, Math.min(...outline.map(p => p.y))), maxX: Math.min(state.canvasSize.width, Math.max(...outline.map(p => p.x))), maxY: Math.min(state.canvasSize.height, Math.max(...outline.map(p => p.y))) };
  const coverageShape: AreaCoverageShape = { shape: options.shape, origin: a, radius, direction, halfAngle: half, polygon };
  const needsOrigin = options.shape === 'cone' && (coverage === 'corners-and-origin' || coverage === 'corners-and-adjacent');
  const source = needsOrigin ? worldToGrid(grid, snapToGrid(grid, rawStart, 'medium')) : null;
  const forward = needsOrigin && coverage === 'corners-and-origin' ? worldToGrid(grid, snapToGrid(grid, gridToWorld(grid, {
    x: a.x + Math.cos(direction) * s * 1e-5, y: a.y + Math.sin(direction) * s * 1e-5
  }), 'medium')) : null;
  const includeOriginCell = (center: LayoutPoint, vertices: LayoutPoint[]) => {
    if (!source || distance(center, source) < epsilon) return false;
    if (forward) return distance(center, forward) < epsilon;
    return coverage === 'corners-and-adjacent' && touchesConeOrigin(vertices, coverageShape);
  };
  const cells = snapped ? canvasCellCenters(state, region).flatMap(center => {
    const vertices = cellVertices(grid, center);
    if (!vertices.every(p => p.x >= -epsilon && p.y >= -epsilon && p.x <= state.canvasSize.width + epsilon && p.y <= state.canvasSize.height + epsilon)) return [];
    const localVertices = vertices.map(p => worldToGrid(grid, p)), localCenter = worldToGrid(grid, center);
    return cellIsCovered(localVertices, localCenter, inside, coverage, coverageShape, includeOriginCell(localCenter, localVertices)) ? [vertices] : [];
  }) : [];
  const geometricArea = !calculateArea ? 0 : options.shape === 'circle' ? Math.PI * radius ** 2 : options.shape === 'cone' ? radius ** 2 * half : polygonArea(polygon);
  return { ...empty, outlines: [outline], cells, coverageShape,
    area: !calculateArea ? 0 : snapped ? cells.length * (isSquareTopology(grid.type) ? 1 : Math.sqrt(3) / 2) * unit ** 2 : geometricArea / s ** 2 * unit ** 2 };
}
