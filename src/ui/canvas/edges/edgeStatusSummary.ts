import type { EncounterState } from "@core/encounter/types";
import type { Edge, EdgeMovementRule } from "@entities/edge/types";

const movementLabels: Record<EdgeMovementRule, string> = {
  blocked: "blocked",
  difficult: "difficult",
  skillCheck: "skill check"
};

/** Formats every requested Edge field without exposing render-only shape. */
export function getEdgeStatusSummary(
  edge: Edge,
  encounter: EncounterState
): string {
  const source = encounter.zones.byId[edge.fromZoneId]?.name ?? edge.fromZoneId;
  const target = encounter.zones.byId[edge.toZoneId]?.name ?? edge.toZoneId;
  const movement = edge.movementRules.length > 0
    ? edge.movementRules.map((rule) => movementLabels[rule]).join(", ")
    : "unrestricted";
  return [
    `Source: ${source}`,
    `Target: ${target}`,
    `Movement: ${movement}`,
    `Visibility: ${edge.visibilityRule}`,
    `Tags: ${edge.interactionTags.join(", ") || "none"}`,
    `Notes: ${edge.notes || "none"}`
  ].join(" · ");
}
