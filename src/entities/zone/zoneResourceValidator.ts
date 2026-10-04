import type { EncounterState } from "@core/encounter/types";
import type { Validator } from "@core/validation/types";
import { result } from "@core/validation/validatorUtils";
import { validZoneResources } from "./zoneStatus";

export const ZoneResourceValidator: Validator<EncounterState> = {
  id: "ZoneResourceValidator",
  validate(_action, { state, nextState }) {
    const candidate = nextState ?? state;
    return result(candidate.zones.allIds.some((id) => !validZoneResources(candidate.zones.byId[id])) ? [{
      code: "zone.resourcesInvalid", message: "Zone counters, clocks, tags, and notes must contain valid values and bounds.", severity: "error"
    }] : []);
  }
};
