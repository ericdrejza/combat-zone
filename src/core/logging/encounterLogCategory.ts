import type { EncounterLogCategory } from "./types";

export function getEncounterLogCategory(
  actionType: string
): EncounterLogCategory {
  const prefix = actionType.split(".")[0];
  switch (prefix) {
    case "actor":
    case "zone":
    case "engagement":
    case "edge":
    case "annotation":
    case "initiative":
    case "background":
      return prefix;
    default:
      return "encounter";
  }
}
