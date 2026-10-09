import { validCounters } from "@core/entity_resources/counters";
import { validClocks } from "@core/entity_resources/statusResources";
import type { Validator } from "@core/validation/types";
import { result } from "@core/validation/validatorUtils";
import type { EncounterState } from "./types";

export const EncounterResourceValidator: Validator<EncounterState> = {
  id: "EncounterResourceValidator",
  validate(_action, { state, nextState }) {
    const candidate = nextState ?? state;
    return result(candidate.counters === undefined || candidate.clocks === undefined || !validCounters(candidate.counters) || !validClocks(candidate.clocks) ? [{
      code: "encounter.resourcesInvalid", message: "Encounter counters and clocks must contain valid values and bounds.", severity: "error"
    }] : []);
  }
};
