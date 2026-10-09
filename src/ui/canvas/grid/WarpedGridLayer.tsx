import { useId, useMemo } from 'react';
import type { EncounterState } from '@core/encounter/types';
import type { GridConfiguration } from '@core/movement/types';
import type { LayoutPoint } from '@core/layout/types';
import { gridToWorld, worldToGrid } from '@core/movement/gridGeometry';

function segment(grid: GridConfiguration, a: LayoutPoint, b: LayoutPoint) {
  const start = gridToWorld(grid, a), end = gridToWorld(grid, b);
  const midpoint = gridToWorld(grid, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  // Bilinear transforms map oblique straight edges to exact quadratic curves.
  const control = { x: 2 * midpoint.x - (start.x + end.x) / 2, y: 2 * midpoint.y - (start.y + end.y) / 2 };
  return `M${start.x},${start.y}Q${control.x},${control.y} ${end.x},${end.y}`;
}
function warpedPaths(grid: GridConfiguration, canvas: EncounterState['canvasSize']) {
  const corners = [0, canvas.width / 2, canvas.width].flatMap(x => [0, canvas.height / 2, canvas.height].map(y => worldToGrid(grid, { x, y })));
  if (corners.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return '';
  const cell = grid.cellSize;
  const minX = Math.floor(Math.min(...corners.map(p => p.x)) / cell) - 3, maxX = Math.ceil(Math.max(...corners.map(p => p.x)) / cell) + 3;
  const minY = Math.floor(Math.min(...corners.map(p => p.y)) / cell) - 3, maxY = Math.ceil(Math.max(...corners.map(p => p.y)) / cell) + 3;
  const paths: string[] = [];
  if (grid.type === 'square') {
    for (let x = minX; x <= maxX; x++) paths.push(segment(grid, { x: x * cell, y: minY * cell }, { x: x * cell, y: maxY * cell }));
    for (let y = minY; y <= maxY; y++) paths.push(segment(grid, { x: minX * cell, y: y * cell }, { x: maxX * cell, y: y * cell }));
  } else {
    const radius = cell / Math.sqrt(3);
    const qMin = Math.floor(minX * cell / (1.5 * radius)), qMax = Math.ceil(maxX * cell / (1.5 * radius));
    for (let q = qMin; q <= qMax; q++) {
      for (let r = Math.floor(minY - q / 2); r <= Math.ceil(maxY - q / 2); r++) {
        const x = q * 1.5 * radius, y = (r + q / 2) * cell;
        const vertices = Array.from({ length: 6 }, (_, k) => ({ x: x + radius * Math.cos(k * Math.PI / 3), y: y + radius * Math.sin(k * Math.PI / 3) }));
        // One half of each cell boundary avoids drawing shared edges twice.
        for (let k = 0; k < 3; k++) paths.push(segment(grid, vertices[k], vertices[k + 1]));
      }
    }
  }
  return paths.join('');
}
export function WarpedGridLayer({ grid, canvas }: { grid: GridConfiguration; canvas: EncounterState['canvasSize'] }) {
  const id = useId().replace(/:/g, '');
  const path = useMemo(() => warpedPaths(grid, canvas), [grid, canvas]);
  return <g aria-label="Warped grid overlay" pointerEvents="none">
    <defs><clipPath id={id}><rect width={canvas.width} height={canvas.height} /></clipPath></defs>
    <path d={path} clipPath={`url(#${id})`} fill="none" stroke={grid.color} strokeWidth={1} opacity={grid.opacity} />
  </g>;
}
