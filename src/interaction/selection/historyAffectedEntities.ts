import type { EncounterState } from "@core/encounter/types";
import type { EntitySelection, SelectableEntityType } from "@interaction/selection/types";

const COLLECTIONS = {
  actor: "actors",
  zone: "zones",
  edge: "edges",
  engagement: "engagements",
  annotation: "annotations"
} as const;

/** Only entities present in the restored snapshot can become selection targets. */
export function getAffectedHistoryEntities(before: EncounterState, after: EncounterState): EntitySelection[] {
  return (Object.keys(COLLECTIONS) as SelectableEntityType[]).flatMap(entityType => {
    const key = COLLECTIONS[entityType];
    const ids = after[key].allIds.filter(id => {
      const previous = before[key].byId[id];
      const current = after[key].byId[id];
      return current && previous !== current && JSON.stringify(previous) !== JSON.stringify(current);
    });
    return ids.length ? [{ entityType, ids }] : [];
  });
}
