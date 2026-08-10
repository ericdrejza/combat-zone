import type { EncounterState } from "@core/encounter/types";
import type { ValidationMessage, Validator } from "./types";
import {
  allowsZoneless,
  createPayloadReader,
  hasActor,
  hasZone,
  result
} from "./validatorUtils";

export const MovementValidator: Validator<EncounterState> = {
  id: "MovementValidator",
  validate(action, { state }) {
    if (
      action.type !== "actor.move" &&
      action.type !== "actor.moveMany" &&
      action.type !== "actor.create"
    ) {
      return result([]);
    }

    const payload = createPayloadReader(action.payload);
    const actorId = payload.getString("actorId");
    const actorIds = payload.getStringArray("actorIds");
    const movedActorIds = actorIds.length > 0
      ? actorIds
      : actorId
        ? [actorId]
        : [];
    const destinationZoneId = payload.getString("destinationZoneId");
    const messages: ValidationMessage[] = [];

    if (
      (action.type === "actor.move" || action.type === "actor.moveMany") &&
      (movedActorIds.length === 0 ||
        movedActorIds.some((movedActorId) => !hasActor(state, movedActorId)))
    ) {
      messages.push({
        code: "movement.actorMissing",
        message: "Movement references an actor that does not exist.",
        severity: "error"
      });
    }

    if (!allowsZoneless(destinationZoneId) && !hasZone(state, destinationZoneId)) {
      messages.push({
        code: "movement.destinationZoneMissing",
        message: "Movement references a destination zone that does not exist.",
        severity: "error"
      });
    }

    return result(messages);
  }
};
