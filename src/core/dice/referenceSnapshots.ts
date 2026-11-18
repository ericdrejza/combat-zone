import type { EncounterState } from "@core/encounter/types";
import type { ChatReference } from "@core/chat/types";
import { ACTOR_LAYOUT_GROUP_COLORS } from "@entities/actor/actorVisuals";
import type { Zone } from "@entities/zone/types";
import { AmbiguousMentionError } from "./referenceChoices";
import { resolveReferenceScope } from "./referenceScopeResolution";
import { referenceBindingKey, referenceTokens } from "./referencePath";

/** Chat displays visible fill at full strength; transparent fills fall back to a visible border. */
export function zoneReferenceColor(zone: Zone): string | null {
  const alpha = /^#[\da-f]{8}$/i.test(zone.colorFill) ? parseInt(zone.colorFill.slice(7), 16) : 255;
  if (zone.opacity > 0 && alpha > 0) return zone.colorFill.slice(0, 7);
  return zone.showBorder ? zone.colorBorder : null;
}
/** Snapshot each actual entity's token; union faction selectors have no single Zone identity. */
export function snapshotReferences(state: EncounterState, message: string, bindings: Record<string, string> = {}): ChatReference[] {
  const references: ChatReference[] = [];
  for (const token of referenceTokens(message)) {
    try {
      const resolved = resolveReferenceScope(state, token.text, referenceBindingKey(message, token.start), bindings);
      // Preserve existing whole-reference faction spans for ordinary @Zone.faction.
      if (resolved.segments.length === 2 && !resolved.segments.some(segment => segment.list) && resolved.nodes.length === 1 && resolved.nodes[0].kind === "faction") {
        const zone = state.zones.byId[resolved.nodes[0].zoneId!];
        references.push({ start: token.start, end: token.end, entityId: zone.id, kind: "zone", color: zoneReferenceColor(zone) });
        continue;
      }
      for (const segment of resolved.segments) for (const { item, nodes } of segment.selected) {
        const node = nodes[0];
        if (node.kind === "faction" && !node.zoneId) continue;
        if (nodes.some(candidate => candidate.zoneId !== node.zoneId)) continue;
        const kind = node.kind === "actor" ? "actor" : "zone";
        const entityId = kind === "actor" ? node.id : node.zoneId!;
        const color = kind === "actor" ? ACTOR_LAYOUT_GROUP_COLORS[state.actors.byId[entityId].layoutGroup].fill : zoneReferenceColor(state.zones.byId[entityId]);
        const start = segment === resolved.segments[0] && !segment.list ? token.start : token.start + item.start;
        references.push({ start, end: token.start + item.end, entityId, kind, color });
      }
    } catch (error) {
      if (error instanceof AmbiguousMentionError) throw error;
      // Unknown or unfinished prose references are ordinary chat, not dice syntax errors.
    }
  }
  return references;
}
