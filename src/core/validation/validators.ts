import { ZONELESS_ACTOR_ZONE_ID } from "../encounter/types";
import type { EncounterState } from "../encounter/types";
import type { JsonObject } from "../history/types";
import { PolygonPlacementValidator } from "./polygonFlexPlacementValidator";
import {
  isZonePolygonSizeValid,
  ZONE_MINIMUM_SIZE_VALIDATION_CODE
} from "./zoneSize";
import type {
  ValidationAction,
  ValidationMessage,
  ValidationResult,
  Validator
} from "./types";

type PayloadReader = {
  getString(key: string): string | undefined;
  getStringArray(key: string): string[];
};

function createPayloadReader(payload: JsonObject): PayloadReader {
  return {
    getString(key) {
      const value = payload[key];

      return typeof value === "string" ? value : undefined;
    },
    getStringArray(key) {
      const value = payload[key];

      return Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string")
        : [];
    }
  };
}

function result(messages: ValidationMessage[]): ValidationResult {
  return {
    valid: messages.every((message) => message.severity !== "error"),
    messages
  };
}

function hasZone(state: EncounterState, zoneId: string | undefined): boolean {
  return typeof zoneId === "string" && state.zones.byId[zoneId] !== undefined;
}

function hasActor(state: EncounterState, actorId: string | undefined): boolean {
  return typeof actorId === "string" && state.actors.byId[actorId] !== undefined;
}

function allowsZoneless(zoneId: string | undefined): boolean {
  return zoneId === ZONELESS_ACTOR_ZONE_ID;
}

export const MovementValidator: Validator<EncounterState> = {
  id: "MovementValidator",
  validate(action, { state }) {
    if (action.type !== "actor.move" && action.type !== "actor.create") {
      return result([]);
    }

    const payload = createPayloadReader(action.payload);
    const actorId = payload.getString("actorId");
    const destinationZoneId = payload.getString("destinationZoneId");
    const messages: ValidationMessage[] = [];

    if (action.type === "actor.move" && !hasActor(state, actorId)) {
      messages.push({
        code: "movement.actorMissing",
        message: "Movement references an actor that does not exist.",
        severity: "error"
      });
    }

    if (
      !allowsZoneless(destinationZoneId) &&
      !hasZone(state, destinationZoneId)
    ) {
      messages.push({
        code: "movement.destinationZoneMissing",
        message: "Movement references a destination zone that does not exist.",
        severity: "error"
      });
    }

    return result(messages);
  }
};

/**
 * Zone creation is a hard geometric invariant. Reshaping reports an
 * undersized request, while the validated-change preparation step corrects
 * it before this validator inspects the resulting zone.
 */
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
          : result([
              {
                code: ZONE_MINIMUM_SIZE_VALIDATION_CODE,
                message: "The resized zone was enlarged to the minimum size.",
                severity: "warning"
              }
            ]);
      }
    }

    if (requestedPolygonIsValid) {
      return result([]);
    }

    return {
      blocked: true,
      messages: [
        {
          code: ZONE_MINIMUM_SIZE_VALIDATION_CODE,
          message: "Zones must be at least as wide and tall as a small actor.",
          severity: "error"
        }
      ],
      valid: false
    };
  }
};

export const EdgeValidator: Validator<EncounterState> = {
  id: "EdgeValidator",
  validate(action, { state }) {
    if (action.type !== "edge.create" && action.type !== "edge.update") {
      return result([]);
    }

    const payload = createPayloadReader(action.payload);
    const fromZoneId = payload.getString("fromZoneId");
    const toZoneId = payload.getString("toZoneId");
    const messages: ValidationMessage[] = [];

    if (!hasZone(state, fromZoneId)) {
      messages.push({
        code: "edge.fromZoneMissing",
        message: "Edge references a source zone that does not exist.",
        severity: "error"
      });
    }

    if (!hasZone(state, toZoneId)) {
      messages.push({
        code: "edge.toZoneMissing",
        message: "Edge references a destination zone that does not exist.",
        severity: "error"
      });
    }

    if (fromZoneId !== undefined && fromZoneId === toZoneId) {
      messages.push({
        code: "edge.selfReference",
        message: "Edge source and destination zones must be different.",
        severity: "error"
      });
    }

    return result(messages);
  }
};

export const EngagementValidator: Validator<EncounterState> = {
  id: "EngagementValidator",
  validate(action, { state }) {
    if (
      action.type !== "engagement.create" &&
      action.type !== "engagement.update"
    ) {
      return result([]);
    }

    const payload = createPayloadReader(action.payload);
    const parentZoneId = payload.getString("parentZoneId");
    const participantIds = payload.getStringArray("participantIds");
    const messages: ValidationMessage[] = [];

    if (!hasZone(state, parentZoneId)) {
      messages.push({
        code: "engagement.parentZoneMissing",
        message: "Engagement references a parent zone that does not exist.",
        severity: "error"
      });
    }

    if (participantIds.length < 2) {
      messages.push({
        code: "engagement.tooFewParticipants",
        message: "Engagements must contain at least two participants.",
        severity: "error"
      });
    }

    for (const participantId of participantIds) {
      if (!hasActor(state, participantId)) {
        messages.push({
          code: "engagement.participantMissing",
          message: `Engagement references missing participant ${participantId}.`,
          severity: "error"
        });
      }
    }

    return result(messages);
  }
};

export const ZoneIntegrityValidator: Validator<EncounterState> = {
  id: "ZoneIntegrityValidator",
  validate(_action: ValidationAction, { state }) {
    const messages: ValidationMessage[] = [];

    for (const actorId of state.actors.allIds) {
      const actor = state.actors.byId[actorId];

      if (
        actor &&
        !allowsZoneless(actor.currentZoneId) &&
        !hasZone(state, actor.currentZoneId)
      ) {
        messages.push({
          code: "zoneIntegrity.actorZoneMissing",
          message: `Actor ${actor.id} references a zone that does not exist.`,
          severity: "error"
        });
      }
    }

    for (const edgeId of state.edges.allIds) {
      const edge = state.edges.byId[edgeId];

      if (!edge) {
        continue;
      }

      if (!hasZone(state, edge.fromZoneId)) {
        messages.push({
          code: "zoneIntegrity.edgeFromZoneMissing",
          message: `Edge ${edge.id} references a source zone that does not exist.`,
          severity: "error"
        });
      }

      if (!hasZone(state, edge.toZoneId)) {
        messages.push({
          code: "zoneIntegrity.edgeToZoneMissing",
          message: `Edge ${edge.id} references a destination zone that does not exist.`,
          severity: "error"
        });
      }
    }

    for (const engagementId of state.engagements.allIds) {
      const engagement = state.engagements.byId[engagementId];

      if (!engagement) {
        continue;
      }

      if (!hasZone(state, engagement.parentZoneId)) {
        messages.push({
          code: "zoneIntegrity.engagementParentZoneMissing",
          message: `Engagement ${engagement.id} references a parent zone that does not exist.`,
          severity: "error"
        });
      }

      for (const participantId of engagement.participantIds) {
        if (!hasActor(state, participantId)) {
          messages.push({
            code: "zoneIntegrity.engagementParticipantMissing",
            message: `Engagement ${engagement.id} references missing participant ${participantId}.`,
            severity: "error"
          });
        }
      }
    }

    return result(messages);
  }
};

export const MVP_VALIDATORS: Validator<EncounterState>[] = [
  MovementValidator,
  ZoneSizeValidator,
  PolygonPlacementValidator,
  EdgeValidator,
  EngagementValidator,
  ZoneIntegrityValidator
];
