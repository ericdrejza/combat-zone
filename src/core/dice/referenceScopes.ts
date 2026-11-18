import type { EncounterState } from "@core/encounter/types";
import type { Actor } from "@entities/actor/types";
import { FACTION_REFERENCES } from "./referenceChoices";

export type ReferenceScopeNode = {
  id: string; name: string; kind: "actor" | "zone" | "faction";
  actorIds: string[]; zoneId?: string; detail?: string;
};
const unique = (nodes: ReferenceScopeNode[]) => Array.from(new Map(nodes.map(node => [`${node.kind}:${node.id}`, node])).values());
export function actorScopeNode(state: EncounterState, actor: Actor): ReferenceScopeNode {
  return { id: actor.id, name: actor.name, kind: "actor", actorIds: [actor.id], zoneId: actor.currentZoneId,
    detail: state.zones.byId[actor.currentZoneId]?.name };
}
export function rootReferenceScope(state: EncounterState): ReferenceScopeNode[] {
  return [
    ...state.actors.allIds.map(id => actorScopeNode(state, state.actors.byId[id])),
    ...state.zones.allIds.map(id => ({ id, name: state.zones.byId[id].name, kind: "zone" as const, zoneId: id,
      actorIds: state.actors.allIds.filter(actorId => state.actors.byId[actorId].currentZoneId === id) })),
    ...FACTION_REFERENCES.map(faction => ({ id: `faction:global:${faction.group}`, name: faction.name, kind: "faction" as const,
      actorIds: state.actors.allIds.filter(id => state.actors.byId[id].layoutGroup === faction.group) }))
  ];
}
/** Scope is a union of children; Actor leaves cannot suggest another entity level. */
export function referenceScopeChildren(state: EncounterState, parents: ReferenceScopeNode[]): ReferenceScopeNode[] {
  return unique(parents.flatMap(parent => {
    if (parent.kind === "actor") return [];
    const actors = parent.actorIds.map(id => state.actors.byId[id]).filter(Boolean);
    const children = actors.map(actor => actorScopeNode(state, actor));
    if (parent.kind === "faction") return children;
    return [
      ...FACTION_REFERENCES.map(faction => ({ id: `faction:${parent.id}:${faction.group}`, name: faction.name,
        kind: "faction" as const, zoneId: parent.id,
        actorIds: actors.filter(actor => actor.layoutGroup === faction.group).map(actor => actor.id) })),
      ...children
    ];
  }));
}
