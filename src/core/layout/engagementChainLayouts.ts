import type { LayoutPoint } from './types';
import { ENGAGEMENT_TOKEN_RADIUS } from './engagementGeometryConstants';

const DISTANCE_EPSILON = 0.01;

export type EngagementChainLayout = {
  points: LayoutPoint[];
  token: LayoutPoint;
};

function getGridDimensions(
  participantCount: number,
  orientation: 'LEFT_RIGHT' | 'TOP_BOTTOM'
): Array<{ columns: number; rows: number }> {
  const cellCount = participantCount + 1;
  const dimensions = Array.from(
    { length: Math.max(1, Math.ceil(Math.sqrt(cellCount)) + 2) },
    (_, index) => {
      const shortSide = index + 1;
      const longSide = Math.ceil(cellCount / shortSide);
      return orientation === 'LEFT_RIGHT'
        ? { columns: longSide, rows: shortSide }
        : { columns: shortSide, rows: longSide };
    }
  );

  return Array.from(
    new Map(
      dimensions.map((dimension) => [
        `${dimension.columns}:${dimension.rows}`,
        dimension
      ])
    ).values()
  );
}

/**
 * Produces token-anchored serpentine grids from elongated through compact.
 * The reserved token cell gives connector routing a visible entry point, and
 * adjacent cells allow the network to continue actor-to-actor.
 */
export function getEngagementChainCandidateLayouts(
  center: LayoutPoint,
  radii: readonly number[],
  orientation: 'LEFT_RIGHT' | 'TOP_BOTTOM',
  clearance: number
): EngagementChainLayout[] {
  if (!radii.length) return [];
  const largestRadius = Math.max(...radii);
  const step =
    Math.max(
      largestRadius * 2 + clearance,
      largestRadius + ENGAGEMENT_TOKEN_RADIUS + clearance
    ) + DISTANCE_EPSILON;

  return getGridDimensions(radii.length, orientation).map(
    ({ columns, rows }) => {
      const tokenColumn = Math.floor((columns - 1) / 2);
      const tokenRow = Math.floor((rows - 1) / 2);
      const cells: Array<{ column: number; row: number }> = [];

      for (let row = 0; row < rows; row += 1) {
        const rowCells = Array.from({ length: columns }, (_, column) => ({
          column,
          row
        }));
        if (row % 2 === 1) rowCells.reverse();
        cells.push(...rowCells);
      }

      const participantCells = cells.filter(
        ({ column, row }) =>
          column !== tokenColumn || row !== tokenRow
      );
      const toPoint = ({ column, row }: { column: number; row: number }) => ({
        x: center.x + (column - tokenColumn) * step,
        y: center.y + (row - tokenRow) * step
      });

      return {
        points: participantCells.slice(0, radii.length).map(toPoint),
        token: { ...center }
      };
    }
  );
}
