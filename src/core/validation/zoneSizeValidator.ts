import type { EncounterState } from "@core/encounter/types";
import type { Validator } from "./types";
import {
  isZonePolygonSizeValid,
  ZONE_MINIMUM_SIZE_VALIDATION_CODE
} from "./zoneSize";
import { result } from "./validatorUtils";

/** Enforces minimum geometry while reporting assisted reshape corrections. */
export const ZoneSizeValidator: Validator<EncounterState> = {
  id: "ZoneSizeValidator",
  runsInOffMode: true,
  validate(action, { nextState }) {
    if (action.type !== "zone.create" && action.type !== "zone.reshape") {
      return result([]);
    }

    const polygon = action.payload.polygon;
    const requestedPolygonIsValid =
      Array.isArray(polygon) &&
      polygon.every(
        (point): point is { x: number; y: number } =>
          typeof point === "object" &&
          point !== null &&
          !Array.isArray(point) &&
          typeof point.x === "number" &&
          typeof point.y === "number"
      ) &&
      isZonePolygonSizeValid(polygon);

    if (action.type === "zone.reshape") {
      const zoneId = action.payload.zoneId;
      const correctedPolygon =
        typeof zoneId === "string"
          ? nextState?.zones.byId[zoneId]?.polygon
          : undefined;

      if (correctedPolygon && isZonePolygonSizeValid(correctedPolygon)) {
        return requestedPolygonIsValid
          ? result([])
          : result([{
              code: ZONE_MINIMUM_SIZE_VALIDATION_CODE,
              message: "The resized zone was enlarged to the minimum size.",
              severity: "warning"
            }]);
      }
    }

    if (requestedPolygonIsValid) {
      return result([]);
    }

    return {
      blocked: true,
      messages: [{
        code: ZONE_MINIMUM_SIZE_VALIDATION_CODE,
        message: "Zones must be at least as wide and tall as a small actor.",
        severity: "error"
      }],
      valid: false
    };
  }
};
