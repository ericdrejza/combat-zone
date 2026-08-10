import type { EncounterState } from "@core/encounter/types";
import type { ValidationAction, ValidationMessage, Validator } from "./types";
import { allowsZoneless, hasActor, hasZone, result } from "./validatorUtils";

export const ZoneIntegrityValidator: Validator<EncounterState> = {
  id: "ZoneIntegrityValidator",
  validate(_action: ValidationAction, { state }) {
    const messages: ValidationMessage[] = [];

    for (const actorId of state.actors.allIds) {
      const actor = state.actors.byId[actorId];
      if (actor && !allowsZoneless(actor.currentZoneId) && !hasZone(state, actor.currentZoneId)) {
        messages.push({ code: "zoneIntegrity.actorZoneMissing", message: `Actor ${actor.id} references a zone that does not exist.`, severity: "error" });
      }
    }
    for (const edgeId of state.edges.allIds) {
      const edge = state.edges.byId[edgeId];
      if (!edge) continue;
      if (!hasZone(state, edge.fromZoneId)) {
        messages.push({ code: "zoneIntegrity.edgeFromZoneMissing", message: `Edge ${edge.id} references a source zone that does not exist.`, severity: "error" });
      }
      if (!hasZone(state, edge.toZoneId)) {
        messages.push({ code: "zoneIntegrity.edgeToZoneMissing", message: `Edge ${edge.id} references a destination zone that does not exist.`, severity: "error" });
      }
    }
    for (const engagementId of state.engagements.allIds) {
      const engagement = state.engagements.byId[engagementId];
      if (!engagement) continue;
      if (!hasZone(state, engagement.parentZoneId)) {
        messages.push({ code: "zoneIntegrity.engagementParentZoneMissing", message: `Engagement ${engagement.id} references a parent zone that does not exist.`, severity: "error" });
      }
      for (const participantId of engagement.participantIds) {
        if (!hasActor(state, participantId)) {
          messages.push({ code: "zoneIntegrity.engagementParticipantMissing", message: `Engagement ${engagement.id} references missing participant ${participantId}.`, severity: "error" });
        }
        const participant = state.actors.byId[participantId];
        if (participant && participant.currentZoneId !== engagement.parentZoneId) {
          messages.push({ code: "zoneIntegrity.engagementParticipantOutsideParentZone", message: `Engagement ${engagement.id} contains an actor outside its parent zone.`, severity: "error" });
        }
      }
    }
    return result(messages);
  }
};
