import { ZONELESS_ACTOR_ZONE_ID, type EncounterState } from "@core/encounter/types";
import type { JsonObject } from "@core/history/types";
import type { ValidationMessage, ValidationResult } from "./types";

export function createPayloadReader(payload: JsonObject) {
  return {
    getString(key: string) {
      const value = payload[key];
      return typeof value === "string" ? value : undefined;
    },
    getStringArray(key: string) {
      const value = payload[key];
      return Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string")
        : [];
    }
  };
}

export function result(messages: ValidationMessage[]): ValidationResult {
  return {
    valid: messages.every((message) => message.severity !== "error"),
    messages
  };
}

export function hasZone(state: EncounterState, zoneId: string | undefined) {
  return typeof zoneId === "string" && state.zones.byId[zoneId] !== undefined;
}

export function hasActor(state: EncounterState, actorId: string | undefined) {
  return typeof actorId === "string" && state.actors.byId[actorId] !== undefined;
}

export function allowsZoneless(zoneId: string | undefined) {
  return zoneId === ZONELESS_ACTOR_ZONE_ID;
}
