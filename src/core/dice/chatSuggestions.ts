import type { EncounterState } from "@core/encounter/types";
import { resolveEntityReference } from "./references";
import { formatReferenceName, referenceQuote, splitReference } from "./referenceSyntax";
import { completionEnd, fragmentName, ranked, referenceSuggestions } from "./referenceCompletion";
import { DICE_COMMANDS } from "./commands";
export type ChatSuggestion = {
  kind: "actor" | "zone" | "faction" | "rollable" | "command";
  key: string; name: string; detail?: string; text: string; start: number; end: number;
  actorIds: string[]; binding?: { key: string; id: string };
};
/** Commands, Rollables, and hierarchical entity paths share ranking and replacement semantics. */
export function chatSuggestions(state: EncounterState, draft: string, caret = draft.length, sourceId?: string, selectedActorIds: readonly string[] = [], bindings: Record<string, string> = {}): ChatSuggestion[] {
  const before = draft.slice(0, caret);
  const command = before.match(/^\/([^\s/]*)$/);
  if (command) return ranked(DICE_COMMANDS.map(name => ({ name })), command[1]).map(({ name }) => ({ kind: "command", key: `command:${name}`, name: `/${name}`, text: `/${name} `, start: 0, end: completionEnd(draft, 1, caret), actorIds: [] }));
  const choices = { ...(sourceId ? { source: sourceId } : {}), ...bindings };
  const invocation = splitReference(before, "/");
  const sourceText = invocation[0].trim();
  if (splitReference(before, "->").length === 1 && invocation.length === 2 && sourceText.startsWith("@")) {
    let actor;
    try {
      const source = resolveEntityReference(state, sourceText, "source", choices);
      if (source.actorIds.length !== 1) return [];
      actor = state.actors.byId[source.actorIds[0]];
    } catch { return []; }
    const raw = invocation[1];
    if (/\s/.test(raw) && !referenceQuote(raw)) return [];
    return ranked((actor?.rollables?.allIds ?? []).map(id => actor!.rollables!.byId[id]), fragmentName(raw), !referenceQuote(raw))
      .map(rollable => ({ kind: "rollable" as const, key: `rollable:${rollable.id}`, name: rollable.name,
        text: formatReferenceName(rollable.name, referenceQuote(raw)), start: before.length - raw.length,
        end: completionEnd(draft, before.length - raw.length, caret), actorIds: [actor!.id], binding: { key: "rollable", id: rollable.id } }));
  }
  return referenceSuggestions(state, draft, caret, choices, selectedActorIds);
}
