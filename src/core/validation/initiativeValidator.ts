import type { EncounterState } from "@core/encounter/types";
import {
  INITIATIVE_MAX,
  INITIATIVE_MIN,
  sortInitiativeEntries
} from "@core/encounter/initiativeMutations";
import type { ValidationMessage, Validator } from "./types";
import { result } from "./validatorUtils";

/** Protects scoped initiative entries, ordering, and active-turn consistency. */
export const InitiativeValidator: Validator<EncounterState> = {
  id: "InitiativeValidator",
  validate(_action, { state, nextState }) {
    const candidate = nextState ?? state;
    const { entries, currentActorId, currentRound } = candidate.initiativeTracker;
    const actorIds = entries.map(({ actorId }) => actorId);
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
      sortInitiativeEntries(entries).some(
        (entry, index) => entry.actorId !== entries[index]?.actorId
      )
    ) {
      messages.push({
        code: "initiative.orderInvalid",
        message: "Initiative entries must be sorted from highest to lowest value.",
        severity: "error"
      });
    }
    if (
      entries.some(
        ({ value }) =>
          value !== undefined &&
          (!Number.isInteger(value) ||
            value < INITIATIVE_MIN ||
            value > INITIATIVE_MAX)
      )
    ) {
      messages.push({
        code: "initiative.valueInvalid",
        message: `Initiative must be a whole number from ${INITIATIVE_MIN} through ${INITIATIVE_MAX}.`,
        severity: "error"
      });
    }

    const inactiveIsConsistent = currentRound === null && currentActorId === null;
    const activeRoundIsValid =
      currentRound !== null && Number.isInteger(currentRound) && currentRound > 0;
    const activeParticipantIsConsistent =
      activeRoundIsValid &&
      ((entries.length === 0 && currentActorId === null) ||
        (entries.length > 0 &&
          currentActorId !== null &&
          actorIds.includes(currentActorId)));
    if (!inactiveIsConsistent && !activeParticipantIsConsistent) {
      messages.push({
        code: "initiative.turnInvalid",
        message: "The current initiative participant and round are inconsistent.",
        severity: "error"
      });
    }

    return result(messages);
  }
};
