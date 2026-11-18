import type { EncounterState } from "@core/encounter/types";
import type { ChatReference } from "@core/chat/types";
import { ACTOR_LAYOUT_GROUP_COLORS } from "@entities/actor/actorVisuals";
import { FACTION_REFERENCES } from "./referenceChoices";
import { historicalReferenceScope } from "./historicalReferenceScope";
import { parseReferencePath, referenceTokens } from "./referencePath";

export type FactionSelector = { start: number; end: number; actorIds: string[]; stale: boolean; color: string | null; automaticColor: boolean };
/** Factions select actors in their current scope, using saved parent identities when qualified. */
export function factionSelectors(state: EncounterState, message: string, references: readonly ChatReference[]): FactionSelector[] {
  const groups: FactionSelector[] = [];
  for (const token of referenceTokens(message)) {
    try {
      const path = parseReferencePath(token.text);
      path.forEach((segment, index) => segment.items.forEach((item, itemIndex) => {
        const faction = !item.quoted && FACTION_REFERENCES.find(faction => faction.name === item.name.toLowerCase());
        if (!faction) return;
        const itemStart = index === 0 && !segment.list ? token.start : token.start + item.start;
        const itemEnd = token.start + item.end;
        const span = references.find(span => span.start <= itemStart && span.end >= itemEnd);
        // Explicit same-named entities remain entity references, not faction selectors.
        if (span?.kind === "actor" || index === 0 && span) return;
        if (index > 0 && !references.some(span => path[0].items.some(root =>
          span.start === (path[0].list ? token.start + root.start : token.start)))) {
          // A global faction root supplies its own stable virtual scope.
          if (path[0].items.some(root => root.quoted || !FACTION_REFERENCES.some(f => f.name === root.name.toLowerCase()))) return;
        }
        const stale = references.some(span => path[0].items.some(root =>
          span.start === (path[0].list ? token.start + root.start : token.start))
          && !(span.kind === "zone" ? state.zones : state.actors).byId[span.entityId]);
        let actorIds: string[] = [];
        try {
          const scope = historicalReferenceScope(state, message, references, token, index);
          const selected = scope.segments[index].selected[itemIndex].nodes;
          if (!selected.every(node => node.kind === "faction")) return;
          actorIds = Array.from(new Set(selected.flatMap(node => node.actorIds)));
        } catch { if (!stale) return; }
        groups.push({ start: span?.start ?? itemStart, end: span?.end ?? itemEnd, actorIds, stale,
          color: span?.color ?? (index === 0 ? ACTOR_LAYOUT_GROUP_COLORS[faction.group].fill : null), automaticColor: index === 0 });
      }));
    } catch { /* Unresolved prose stays ordinary text. */ }
  }
  return groups;
}
