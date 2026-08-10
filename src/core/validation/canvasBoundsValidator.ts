import type { EncounterState } from "@core/encounter/types";
import { isPolygonWithinCanvas } from "@core/layout/polygonCanvasBounds";
import type { Validator } from "./types";
import { result } from "./validatorUtils";

/** Canvas mutations may not leave persisted zone geometry outside its bounds. */
export const CanvasBoundsValidator: Validator<EncounterState> = {
  id: "CanvasBoundsValidator",
  runsInOffMode: true,
  validate(action, { nextState }) {
    if (!nextState || !["canvas.resize", "background.add", "background.replace"].includes(action.type)) {
      return result([]);
    }
    const outsideZone = nextState.zones.allIds
      .map((zoneId) => nextState.zones.byId[zoneId])
      .find((zone) => zone && !isPolygonWithinCanvas(zone.polygon, nextState.canvasSize));
    const messages = outsideZone
      ? [{
          code: "canvas.zoneOutsideBounds",
          message: `Zone ${outsideZone.name} would be outside the resized canvas.`,
          severity: "error" as const
        }]
      : [];
    return { ...result(messages), blocked: messages.length > 0 };
  }
};
