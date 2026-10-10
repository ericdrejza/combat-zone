import { useMemo } from 'react';
import type { EncounterState } from '@core/encounter/types';
import type { GridConfiguration } from '@core/movement/types';
import { completedBoundaryCells, cellBoundarySegments } from '@core/movement/gridEdgeCompletion';
import { getGridCoverage } from '@core/movement/gridCoverage';

/** A union of the original map and whole perimeter cells hides newly exposed fragments. */
export function CompletedGridClip({ id, grid, encounter }: { id: string; grid: GridConfiguration; encounter: EncounterState }) {
  const coverage = getGridCoverage(encounter);
  const straight = grid.type === 'square' && !grid.warp && Math.abs(grid.rotation % 90) < 1e-8;
  const path = useMemo(() => straight ? '' : completedBoundaryCells(grid, coverage).map(points => {
    const segments = cellBoundarySegments(grid, points), first = segments[0].start;
    return `M${first.x},${first.y}${segments.map(({ control, end }) => `Q${control.x},${control.y} ${end.x},${end.y}`).join('')}Z`;
  }).join(''),
    [straight, grid, coverage.x, coverage.y, coverage.width, coverage.height]);
  return <clipPath id={id} clipPathUnits="userSpaceOnUse">
    {straight ? <rect width={encounter.canvasSize.width} height={encounter.canvasSize.height} /> : <>
      <rect x={coverage.x} y={coverage.y} width={coverage.width} height={coverage.height} />
      <path d={path} />
    </>}
  </clipPath>;
}
