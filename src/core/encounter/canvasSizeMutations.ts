import { getGridCoverage } from '@core/movement/gridCoverage';
import { unplaceOverflowingSpatialActors, type BackgroundResizeOverflowBehavior } from './backgroundResizeOverflow';
import { completeGridEdges } from '@core/movement/gridEdgeCompletion';
import type { CanvasSize } from "@core/layout/polygonCanvasBounds";
import type { EncounterState } from "./types";

export type CanvasResizeInput = {
  canvasSize: CanvasSize;
  zoneScale?: number;
  overflowBehavior?: BackgroundResizeOverflowBehavior;
};

function scaleCoordinate(value: number, scale: number): number {
  return Math.round(value * scale * 1000) / 1000;
}

/**
 * Resizes background coverage while leaving grid geometry and spatial actor placement fixed.
 * Zone geometry retains its existing uniform scaling; whole-cell completion may rebase all coordinates.
 */
export function resizeEncounterCanvas(
  encounter: EncounterState,
  { canvasSize, zoneScale, overflowBehavior = 'zoneless' }: CanvasResizeInput
): EncounterState {
  const coverage = getGridCoverage(encounter);
  const frame = { x: coverage.x, y: coverage.y, ...canvasSize };
  const scale =
    zoneScale ??
    Math.min(
      canvasSize.width / coverage.width,
      canvasSize.height / coverage.height
    );
  const byId = Object.fromEntries(
    encounter.zones.allIds.flatMap((zoneId) => {
      const zone = encounter.zones.byId[zoneId];

      return zone
        ? [[
            zoneId,
            {
              ...zone,
              polygon: zone.polygon.map((point) => ({
                x: scaleCoordinate(point.x, scale),
                y: scaleCoordinate(point.y, scale)
              }))
            }
          ]]
        : [];
    })
  );

  // Normalize binary rounding so integer scale edits remain stable in settings.
  const mapScale = Number((encounter.grid.cellSize / Math.min(
    canvasSize.width / coverage.width, canvasSize.height / coverage.height
  )).toPrecision(15));
  const needsCompletion = encounter.grid.visible || encounter.movementStrategy === 'grid' || Boolean(encounter.gridCoverage);
  const next: EncounterState = {
    ...encounter,
    grid: { ...encounter.grid, cellSize: mapScale },
    canvasSize: { width: frame.x + frame.width, height: frame.y + frame.height },
    gridCoverage: !encounter.backgroundImage && needsCompletion ? frame : undefined,
    backgroundImage: encounter.backgroundImage ? { ...encounter.backgroundImage, frame } : null,
    zones: {
      ...encounter.zones,
      byId
    }
  };
  const completed = needsCompletion ? completeGridEdges(next) : next;
  return overflowBehavior === 'zoneless' ? unplaceOverflowingSpatialActors(completed) : completed;
}
