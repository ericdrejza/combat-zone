import type { EncounterState } from "@core/encounter/types";
import type { ZoneShape } from "./types";
import { createShapePolygon, getPolygonBounds } from "./zoneShapeGeometry";

/** Shape and outline change atomically; Polygon conversion retains the outline. */
export function convertZoneShape(
  state: EncounterState,
  zoneId: string,
  shape: ZoneShape
): EncounterState {
  const zone = state.zones.byId[zoneId];
  if (!zone || zone.shape === shape) return state;

  const bounds = getPolygonBounds(zone.polygon);
  const polygon = shape === "polygon"
    ? zone.polygon
    : createShapePolygon(
        shape,
        { x: bounds.x, y: bounds.y },
        { x: bounds.x + bounds.width, y: bounds.y + bounds.height }
      );

  return {
    ...state,
    zones: {
      ...state.zones,
      byId: { ...state.zones.byId, [zoneId]: { ...zone, shape, polygon } }
    }
  };
}
