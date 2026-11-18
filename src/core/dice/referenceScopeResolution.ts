import type { EncounterState } from "@core/encounter/types";
import { chooseMention } from "./referenceChoices";
import { parseReferencePath, referenceItemKey, type ReferenceItem, type ReferenceSegment } from "./referencePath";
import { referenceScopeChildren, rootReferenceScope, type ReferenceScopeNode } from "./referenceScopes";

export type ResolvedReferenceSegment = ReferenceSegment & { selected: Array<{ item: ReferenceItem; nodes: ReferenceScopeNode[] }> };
const unique = (nodes: ReferenceScopeNode[]) => Array.from(new Map(nodes.map(node => [`${node.kind}:${node.id}`, node])).values());

/** Resolve each selector against the previous scope, retaining per-item identities for duplicates. */
export function resolveReferenceScope(state: EncounterState, text: string, key: string, bindings: Record<string, string> = {}) {
  const segments = parseReferencePath(text);
  let scope = rootReferenceScope(state);
  const resolved: ResolvedReferenceSegment[] = [];
  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index];
    const selected = segment.items.map((item, itemIndex) => {
      const itemKey = referenceItemKey(key, index, itemIndex);
      let bound = bindings[itemKey];
      if (!bound && !segment.list) {
        if (index === 0 && segments.length > 1) {
          const actor = state.actors.byId[bindings[key]];
          bound = bindings[`${key}:zone`] ?? actor?.currentZoneId ?? bindings[key];
        } else bound = bindings[key];
      }
      const matches = scope.filter(node => node.name.toLocaleLowerCase() === item.name.toLocaleLowerCase());
      const factions = !item.quoted ? matches.filter(node => node.kind === "faction") : [];
      if (index === 0 && factions.length && matches.some(node => node.kind !== "faction")) {
        const chosen = chooseMention(matches.map(node => ({ ...node, detail: node.kind === "faction" ? "Faction"
          : node.kind === "zone" ? "Zone" : `Actor${node.detail ? ` in ${node.detail}` : ""}` })), item.name, itemKey, bound ? { [itemKey]: bound } : {});
        return { item, nodes: [scope.find(node => node.kind === chosen.kind && node.id === chosen.id)!] };
      }
      if (factions.length && !matches.some(node => node.kind !== "faction" && node.id === bound)) {
        if (segment.list && factions.every(node => !node.actorIds.length)) throw new Error(`No matching targets for ${item.name} in this scope.`);
        return { item, nodes: factions };
      }
      const entities = matches.filter(node => node.kind !== "faction").map(node => ({ ...node,
        detail: node.kind === "zone" ? "Zone" : `Actor${node.detail ? ` in ${node.detail}` : ""}` }));
      const chosen = chooseMention(entities, item.name, itemKey, bound ? { [itemKey]: bound } : {});
      return { item, nodes: [scope.find(node => node.kind === chosen.kind && node.id === chosen.id)!] };
    });
    resolved.push({ ...segment, selected });
    const nodes = unique(selected.flatMap(entry => entry.nodes));
    if (index === segments.length - 1) return { segments: resolved, nodes, actorIds: Array.from(new Set(nodes.flatMap(node => node.actorIds))) };
    scope = referenceScopeChildren(state, nodes);
    if (!scope.length) throw new Error(nodes.every(node => node.kind === "actor")
      ? "An Actor is a reference leaf; there are no further entities in this scope."
      : "No matching targets in the selected scope.");
  }
  throw new Error("Choose a reference name.");
}
