import type { EncounterState } from "@core/encounter/types";
import {
  INITIATIVE_MAX,
  INITIATIVE_MIN,
  sortInitiativeActorIds
} from "@core/encounter/initiativeMutations";
import type { ValidationMessage, Validator } from "./types";
import { result } from "./validatorUtils";

/** Protects initiative references, ordering, score range, and turn consistency. */
export const InitiativeValidator: Validator<EncounterState> = {
  id: "InitiativeValidator",
  validate(_action, { state, nextState }) {
    const candidate = nextState ?? state;
    const { actorIds, currentActorId, currentRound } = candidate.initiativeTracker;
    const messages: ValidationMessage[] = [];

    if (new Set(actorIds).size !== actorIds.length) {
      messages.push({
        code: "initiative.duplicateActor",
        message: "The initiative list cannot contain the same actor more than once.",
        severity: "error"
      });
    }
    if (actorIds.some((actorId) => !candidate.actors.byId[actorId])) {
      messages.push({
        code: "initiative.actorMissing",
        message: "The initiative list references an actor that does not exist.",
        severity: "error"
      });
    }
    if (
      sortInitiativeActorIds(candidate, actorIds).some(
        (actorId, index) => actorId !== actorIds[index]
      )
    ) {
      messages.push({
        code: "initiative.orderInvalid",
        message: "Initiative entries must be sorted from highest to lowest value.",
        severity: "error"
      });
    }

    for (const actorId of candidate.actors.allIds) {
      const initiative = candidate.actors.byId[actorId]?.initiative;
      if (
        initiative !== undefined &&
        (!Number.isInteger(initiative) ||
          initiative < INITIATIVE_MIN ||
          initiative > INITIATIVE_MAX)
      ) {
        messages.push({
          code: "initiative.valueInvalid",
          message: `Initiative must be a whole number from ${INITIATIVE_MIN} through ${INITIATIVE_MAX}.`,
          severity: "error"
        });
        break;
      }
    }

    const activeFieldsMatch =
      (currentActorId === null && currentRound === null) ||
      (currentActorId !== null &&
        currentRound !== null &&
        Number.isInteger(currentRound) &&
        currentRound > 0 &&
        actorIds.includes(currentActorId));
    if (!activeFieldsMatch) {
      messages.push({
        code: "initiative.turnInvalid",
        message: "The current initiative actor and round are inconsistent.",
        severity: "error"
      });
    }

    return result(messages);
  }
};
