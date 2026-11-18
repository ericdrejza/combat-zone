import type { EncounterState } from "@core/encounter/types";
import { resolveReferenceScope } from "./referenceScopeResolution";
export { AmbiguousMentionError, chooseMention, FACTION_REFERENCES } from "./referenceChoices";

export type EntityReference = { id: string; name: string; kind: "actor" | "zone" | "group"; detail?: string; actorIds: string[] };
/** Membership is derived at submission; saved invocations retain the resolved target snapshot. */
export function resolveEntityReference(state: EncounterState, text: string, key: string, bindings: Record<string, string> = {}): EntityReference {
  const resolved = resolveReferenceScope(state, text, key, bindings);
  const node = resolved.nodes[0];
  if (resolved.nodes.length === 1 && node.kind === "actor") return { ...node, kind: "actor", actorIds: resolved.actorIds };
  const root = resolved.segments[0].selected[0].nodes[0];
  const zone = state.zones.byId[node.zoneId ?? root.id];
  return { id: zone?.id ?? node.id, name: zone?.name ?? node.name,
    kind: resolved.nodes.length === 1 && zone ? "zone" : "group", actorIds: resolved.actorIds };
}
