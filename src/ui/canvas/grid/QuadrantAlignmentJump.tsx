import type { EncounterState } from '@core/encounter/types';
import { getGridCoverage } from '@core/movement/gridCoverage';
import { useCanvasViewport } from '../CanvasViewportContext';
import { alignmentButton } from './AlignmentPanel';

const quadrants = ['top left', 'top right', 'bottom right', 'bottom left'];

/** Navigate to the current sampling corner, advancing after each completed cell. */
export function QuadrantAlignmentJump({ encounter, pointCount, cellPoints }: {
  encounter: EncounterState; pointCount: number; cellPoints: number;
}) {
  const { panToPoint } = useCanvasViewport();
  const index = Math.floor(pointCount / cellPoints);
  if (index >= 4) return null;
  const frame = getGridCoverage(encounter);
  const right = index === 1 || index === 2;
  const bottom = index >= 2;
  return <button type="button" className={alignmentButton}
    title={`Keep zoom and jump to the far ${quadrants[index]} corner for the next cell samples`}
    onClick={() => panToPoint({ x: frame.x + (right ? frame.width : 0), y: frame.y + (bottom ? frame.height : 0) })}>
    Jump to {quadrants[index]} quadrant
  </button>;
}
