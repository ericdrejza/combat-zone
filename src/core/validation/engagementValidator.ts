import type { EncounterState } from "@core/encounter/types";
import type { ValidationMessage, Validator } from "./types";
import { createPayloadReader, hasActor, hasZone, result } from "./validatorUtils";

export const EngagementValidator: Validator<EncounterState> = {
  id: "EngagementValidator",
  validate(action, { state, nextState }) {
    if (!["engagement.create", "engagement.update", "engagement.join", "engagement.merge", "engagement.groupSelected"].includes(action.type)) {
      return result([]);
    }

    const payload = createPayloadReader(action.payload);
    const parentZoneId = payload.getString("parentZoneId");
    const participantIds = payload.getStringArray("participantIds");
    const messages: ValidationMessage[] = [];

    if (parentZoneId !== undefined && !hasZone(state, parentZoneId)) {
      messages.push({ code: "engagement.parentZoneMissing", message: "Engagement references a parent zone that does not exist.", severity: "error" });
    }
    if (participantIds.length > 0 && participantIds.length < 2) {
      messages.push({ code: "engagement.tooFewParticipants", message: "Engagements must contain at least two participants.", severity: "error" });
    }
    for (const participantId of participantIds) {
      if (!hasActor(state, participantId)) {
        messages.push({ code: "engagement.participantMissing", message: `Engagement references missing participant ${participantId}.`, severity: "error" });
      }
    }

    if (nextState) {
      const ownerByActorId = new Map<string, string>();
      for (const engagementId of nextState.engagements.allIds) {
        const engagement = nextState.engagements.byId[engagementId];
        if (!engagement) continue;
        if (engagement.participantIds.length < 2) {
          messages.push({ code: "engagement.tooFewParticipants", message: "Engagements must contain at least two participants.", severity: "error" });
        }
        if (new Set(engagement.participantIds).size !== engagement.participantIds.length) {
          messages.push({ code: "engagement.duplicateParticipant", message: "An engagement cannot contain the same participant twice.", severity: "error" });
        }
        for (const actorId of engagement.participantIds) {
          const actor = nextState.actors.byId[actorId];
          if (!actor || actor.currentZoneId !== engagement.parentZoneId) {
            messages.push({ code: "engagement.participantOutsideParentZone", message: "Engagement participants must be in the engagement's zone.", severity: "error" });
          }
          const owner = ownerByActorId.get(actorId);
          if (owner && owner !== engagement.id) {
            messages.push({ code: "engagement.participantInMultipleGroups", message: "An actor can belong to only one engagement.", severity: "error" });
          }
          ownerByActorId.set(actorId, engagement.id);
        }
      }
    }
    return result(messages);
  }
};
