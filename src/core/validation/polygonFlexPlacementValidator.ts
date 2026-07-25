import type { EncounterState } from "../encounter/types";
import { toNestingActor } from "../layout/actorFootprints";
import { packPolygonActors } from "../layout/nesting_ts";
import {
  getPolygonFlexAffectedZoneIds,
  polygonsEqual
} from "./polygonFlexPlacement";
import type {
  ValidationAction,
  ValidationMessage,
  ValidationResult,
  Validator
} from "./types";

function result(messages: ValidationMessage[]): ValidationResult {
  return {
    valid: messages.every((message) => message.severity !== "error"),
    messages
  };
}

/**
 * Polygon layouts share a hard geometric invariant. This runs in OFF mode
 * because allowing an overlapping actor would make the derived canvas
 * placement ambiguous. Reshaping a zone or changing an actor footprint uses
 * the same fit check.
 */
export const PolygonPlacementValidator: Validator<EncounterState> = {
  id: "PolygonPlacementValidator",
  runsInOffMode: true,
  validate(action, { state, nextState }) {
    if (!nextState) {
      return result([]);
    }

    const affectedZoneIds = getPolygonFlexAffectedZoneIds(
      action,
      state,
      nextState
    );

    const messages: ValidationMessage[] = [];

    for (const zoneId of affectedZoneIds) {
      const zone = nextState.zones.byId[zoneId];

      if (!zone) {
        continue;
      }

      const previousZone = state.zones.byId[zoneId];
      const attemptedPolygon =
        action.payload.requestedPolygon ?? action.payload.polygon;
      const zoneWasAutomaticallyResized =
        action.type === "zone.reshape" &&
        previousZone &&
        Array.isArray(attemptedPolygon) &&
        !polygonsEqual(
          attemptedPolygon as { x: number; y: number }[],
          zone.polygon
        );
      const actorChangeResizedZone =
        action.type !== "zone.reshape" &&
        previousZone &&
        !polygonsEqual(previousZone.polygon, zone.polygon);

      if (zoneWasAutomaticallyResized || actorChangeResizedZone) {
        messages.push({
          code: "layout.polygonFlexZoneResized",
          message:
            action.type === "zone.reshape"
              ? `Zone ${zone.name} was enlarged to fit its actors.`
              : `Zone ${zone.name} was resized to fit the actor change.`,
          severity: "warning"
        });
      }

      const actors = nextState.actors.allIds.flatMap((actorId) => {
        const actor = nextState.actors.byId[actorId];

        return actor && actor.currentZoneId === zoneId ? [toNestingActor(actor)] : [];
      });
      const packing = packPolygonActors({
        actors,
        layoutOrientation: zone.layoutOrientation,
        layoutStrategy: zone.layoutStrategy,
        polygon: zone.polygon
      });

      if (!packing.fits) {
        messages.push({
          code: "layout.polygonFlexNoSpace",
          message: `Actors cannot fit in polygon ${zone.layoutStrategy} zone ${zone.name} without overlap.`,
          severity: "error"
        });
      }
    }

    return {
      ...result(messages),
      blocked: messages.some((message) => message.severity === "error")
    };
  }
};

/** @deprecated Use PolygonPlacementValidator. */
export const PolygonFlexPlacementValidator = PolygonPlacementValidator;
