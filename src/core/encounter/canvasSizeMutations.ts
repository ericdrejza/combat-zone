import { completeGridEdges } from '@core/movement/gridEdgeCompletion';
import type { CanvasSize } from "@core/layout/polygonCanvasBounds";
import type { EncounterState } from "./types";

export type CanvasResizeInput = {
  canvasSize: CanvasSize;
  zoneScale?: number;
};

function scaleCoordinate(value: number, scale: number): number {
  return Math.round(value * scale * 1000) / 1000;
}

/**
 * Resizes the logical canvas and uniformly scales persisted zone geometry
 * from the top-left origin. Actor, engagement, and edge geometry is derived.
 */
export function resizeEncounterCanvas(
  encounter: EncounterState,
  { canvasSize, zoneScale }: CanvasResizeInput
): EncounterState {
  const scale =
    zoneScale ??
    Math.min(
      canvasSize.width / encounter.canvasSize.width,
      canvasSize.height / encounter.canvasSize.height
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

  const next: EncounterState = {
    ...encounter,
    canvasSize,
    gridCoverage: encounter.gridCoverage ? { x: encounter.gridCoverage.x * scale, y: encounter.gridCoverage.y * scale, width: encounter.gridCoverage.width * scale, height: encounter.gridCoverage.height * scale } : undefined,
    backgroundImage: encounter.backgroundImage?.frame ? { ...encounter.backgroundImage,
      frame: { x: encounter.backgroundImage.frame.x * scale, y: encounter.backgroundImage.frame.y * scale,
        width: encounter.backgroundImage.frame.width * scale, height: encounter.backgroundImage.frame.height * scale }
    } : encounter.backgroundImage,
    grid: { ...encounter.grid, cellSize: encounter.grid.cellSize * scale,
      origin: { x: encounter.grid.origin.x * scale, y: encounter.grid.origin.y * scale } },
    actors: !encounter.actors.allIds.some(id => encounter.actors.byId[id].spatialPosition) ? encounter.actors : { ...encounter.actors, byId: Object.fromEntries(encounter.actors.allIds.map(id => {
      const actor = encounter.actors.byId[id];
      return [id, actor.spatialPosition ? { ...actor, spatialPosition: {
        x: actor.spatialPosition.x * scale, y: actor.spatialPosition.y * scale } } : actor];
    })) },
    zones: {
      ...encounter.zones,
      byId
    }
  };
  return next.grid.visible || next.movementStrategy === 'grid' || next.gridCoverage ? completeGridEdges(next) : next;
}
