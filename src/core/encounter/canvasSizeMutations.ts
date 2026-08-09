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

  return {
    ...encounter,
    canvasSize,
    zones: {
      ...encounter.zones,
      byId
    }
  };
}
