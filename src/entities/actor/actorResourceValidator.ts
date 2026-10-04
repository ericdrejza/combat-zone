import type { EncounterState } from "@core/encounter/types";
import type { Validator } from "@core/validation/types";
import { result } from "@core/validation/validatorUtils";
import { validActorResources } from "./actorResources";

export const ActorResourceValidator: Validator<EncounterState> = {
  id: "ActorResourceValidator",
  validate(_action, { state, nextState }) {
    const candidate = nextState ?? state;
    return result(candidate.actors.allIds.some((id) => !validActorResources(candidate.actors.byId[id])) ? [{
      code: "actor.resourcesInvalid", message: "Hit points and counters must contain valid whole numbers and ordered bounds.", severity: "error"
    }] : []);
  }
};
