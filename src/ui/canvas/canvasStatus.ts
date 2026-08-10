import type { RootState } from "@store/store";
import { getEdgeStatusSummary } from "./edges/edgeStatusSummary";

type Encounter = RootState["encounter"]["present"];
type Selection = RootState["interaction"]["selection"];

/** Resolves status-badge text from normalized encounter state without storing duplicates. */
export function getCanvasStatus(
  encounter: Encounter,
  selection: Selection,
  hoveredActorId: string | null
) {
  const selectedActorNames =
    selection.selectedEntityType === "actor"
      ? selection.selectedIds
          .map((actorId) => encounter.actors.byId[actorId]?.name)
          .filter((name): name is string => Boolean(name))
          .sort((left, right) => left.localeCompare(right))
      : [];
  const hoveredActorName = hoveredActorId
    ? encounter.actors.byId[hoveredActorId]?.name
    : undefined;

  return {
    actorNames:
      selectedActorNames.length > 0
        ? selectedActorNames
        : hoveredActorName
          ? [hoveredActorName]
          : [],
    edgeStatuses:
      selection.selectedEntityType === "edge"
        ? selection.selectedIds
            .map((edgeId) => encounter.edges.byId[edgeId])
            .filter((edge): edge is NonNullable<typeof edge> => Boolean(edge))
            .map((edge) => getEdgeStatusSummary(edge, encounter))
        : [],
    zoneStatuses:
      selection.selectedEntityType === "zone"
        ? selection.selectedIds
            .map((zoneId) => encounter.zones.byId[zoneId])
            .filter((zone): zone is NonNullable<typeof zone> => Boolean(zone))
            .map((zone) =>
              zone.tags.length > 0
                ? `${zone.name}: ${zone.tags.join(", ")}`
                : zone.name
            )
        : []
  };
}
