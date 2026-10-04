import type { EncounterState } from "@core/encounter/types";
import type { Validator } from "@core/validation/types";
import { result } from "@core/validation/validatorUtils";
import { isActorStatus } from "./actorStatus";

export const ActorStatusValidator: Validator<EncounterState> = {
  id: "ActorStatusValidator",
  validate(_action, { state, nextState }) {
    const candidate = nextState ?? state;
    const invalid = candidate.actors.allIds.some((id) => {
      const status = candidate.actors.byId[id]?.status;
      return status !== undefined && !isActorStatus(status);
    });
    return result(invalid ? [{
      code: "actor.statusInvalid",
      message: "Actor status must be dead (0), unconscious / severely injured (1), injured (2), or healthy (3).",
      severity: "error"
    }] : []);
  }
};
