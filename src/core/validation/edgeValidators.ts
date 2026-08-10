import type { EncounterState } from "@core/encounter/types";
import { getUnroutableEdgeIds } from "@entities/edge/edgeRouting";
import type { ValidationMessage, Validator } from "./types";
import { createPayloadReader, hasZone, result } from "./validatorUtils";

export const EdgeValidator: Validator<EncounterState> = {
  id: "EdgeValidator",
  validate(action, { state, nextState }) {
    if (!["edge.create", "edge.replace", "edge.update", "edge.updateProperties"].includes(action.type)) {
      return result([]);
    }
    const candidate = nextState ?? state;
    const messages: ValidationMessage[] = [];
    if (!nextState) {
      const payload = createPayloadReader(action.payload);
      const fromZoneId = payload.getString("fromZoneId");
      const toZoneId = payload.getString("toZoneId");
      if (!hasZone(state, fromZoneId)) messages.push({ code: "edge.fromZoneMissing", message: "Edge references a source zone that does not exist.", severity: "error" });
      if (!hasZone(state, toZoneId)) messages.push({ code: "edge.toZoneMissing", message: "Edge references a destination zone that does not exist.", severity: "error" });
      if (fromZoneId !== undefined && fromZoneId === toZoneId) messages.push({ code: "edge.selfReference", message: "Edge source and destination zones must be different.", severity: "error" });
      return result(messages.filter((message, index, all) => all.findIndex(({ code }) => code === message.code) === index));
    }
    const occupiedSlots = new Set<string>();
    for (const edgeId of candidate.edges.allIds) {
      const edge = candidate.edges.byId[edgeId];
      if (!edge) continue;
      if (!hasZone(candidate, edge.fromZoneId)) messages.push({ code: "edge.fromZoneMissing", message: "Edge references a source zone that does not exist.", severity: "error" });
      if (!hasZone(candidate, edge.toZoneId)) messages.push({ code: "edge.toZoneMissing", message: "Edge references a destination zone that does not exist.", severity: "error" });
      if (edge.fromZoneId === edge.toZoneId) messages.push({ code: "edge.selfReference", message: "Edge source and destination zones must be different.", severity: "error" });
      const slot = edge.directionality === "bilateral"
        ? `bilateral:${[edge.fromZoneId, edge.toZoneId].sort().join("<->")}`
        : `unilateral:${edge.fromZoneId}->${edge.toZoneId}`;
      if (occupiedSlots.has(slot)) messages.push({ code: "edge.slotOccupied", message: "A zone pair may have only one Edge in each directionality slot.", severity: "error" });
      occupiedSlots.add(slot);
    }
    return result(messages);
  }
};

/** Emits render diagnostics without making Edge graph validity geometric. */
export const EdgeRouteDiagnosticValidator: Validator<EncounterState> = {
  id: "EdgeRouteDiagnosticValidator",
  runsInOffMode: true,
  validate(action, { nextState, state }) {
    if (!action.type.startsWith("edge.") && action.type !== "zone.move" && action.type !== "zone.reshape") {
      return result([]);
    }
    const edgeIds = getUnroutableEdgeIds(nextState ?? state);
    return result(edgeIds.length === 0 ? [] : [{
      code: "edge.routeUnavailable",
      message: `${edgeIds.length} edge route${edgeIds.length === 1 ? " is" : "s are"} unavailable; the graph relationship remains active.`,
      severity: "warning"
    }]);
  }
};
