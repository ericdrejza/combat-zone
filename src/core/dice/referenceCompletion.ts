import type { EncounterState } from "@core/encounter/types";
import type { ChatSuggestion } from "./chatSuggestions";
import { formatReferenceName, referenceName, referenceQuote, REFERENCE_COMPONENT, splitReference } from "./referenceSyntax";
import { referenceBindingKey, referenceItemKey, referenceTokens } from "./referencePath";
import { resolveReferenceScope } from "./referenceScopeResolution";
import { referenceScopeChildren, rootReferenceScope } from "./referenceScopes";
import { suggestionSearchText } from "./suggestionMatching";

export function ranked<T extends { name: string }>(choices: T[], fragment: string, compact = false): T[] {
  const query = suggestionSearchText(fragment, compact);
  return choices.filter(choice => suggestionSearchText(choice.name, compact).includes(query))
    .sort((a, b) => Number(suggestionSearchText(b.name, compact).startsWith(query)) - Number(suggestionSearchText(a.name, compact).startsWith(query)));
}
export function fragmentName(raw: string) {
  try { return referenceName(raw); } catch { return raw.replace(/^["']/, ""); }
}
export function completionEnd(draft: string, start: number, caret: number) {
  const match = draft.slice(start).match(new RegExp(`^${REFERENCE_COMPONENT}`));
  return Math.max(caret, start + (match?.[0].length ?? 0));
}
/** The next list item or path segment sees only children of the resolved preceding scope. */
export function referenceSuggestions(state: EncounterState, draft: string, caret: number, bindings: Record<string, string>, selectedActorIds: readonly string[]): ChatSuggestion[] {
  const token = referenceTokens(draft.slice(0, caret), true).at(-1);
  if (!token || token.end !== caret) return [];
  const parts = splitReference(token.text.slice(1), ".");
  const segmentIndex = parts.length - 1;
  const raw = parts.at(-1)!;
  const list = raw.startsWith("[");
  if (list && raw.endsWith("]")) return [];
  const items = list ? splitReference(raw.slice(1), ",") : [raw];
  const fragment = items.at(-1)!.trimStart();
  const quote = referenceQuote(fragment);
  const closed = quote ? fragment.match(new RegExp(`^${REFERENCE_COMPONENT}`)) : null;
  if ((!quote && /[\s/\[\],!?;:<>]/.test(fragment)) || closed && closed[0].length < fragment.length) return [];
  const key = referenceBindingKey(draft, token.start);
  let scope = rootReferenceScope(state);
  if (segmentIndex) {
    try { scope = referenceScopeChildren(state, resolveReferenceScope(state, `@${parts.slice(0, -1).join(".")}`, key, bindings).nodes); }
    catch { return []; }
  }
  const itemStart = caret - fragment.length;
  const prefix = segmentIndex === 0 && !list ? "@" : "";
  const start = prefix ? token.start : itemStart;
  // The same faction across several selected Zones is one union suggestion.
  const merged = new Map<string, ChatSuggestion>();
  for (const node of scope) {
    if (node.kind === "faction" && !node.actorIds.length) continue;
    const candidateKey = node.kind === "faction" ? `faction:${node.name}` : `${node.kind}:${node.id}`;
    const previous = merged.get(candidateKey);
    if (previous) { previous.actorIds = Array.from(new Set([...previous.actorIds, ...node.actorIds])); continue; }
    merged.set(candidateKey, { kind: node.kind, key: candidateKey, name: node.name, detail: node.kind === "actor" ? node.detail : undefined,
      actorIds: node.actorIds, start, end: completionEnd(draft, itemStart, caret),
      text: prefix + formatReferenceName(node.name, quote), binding: { key: referenceItemKey(key, segmentIndex, items.length - 1), id: node.id } });
  }
  const matches = ranked(Array.from(merged.values()), fragmentName(fragment), !quote);
  if (fragment || segmentIndex || list) return matches;
  const activeId = state.initiativeTracker.currentRound !== null ? state.initiativeTracker.currentActorId : null;
  const priority = (choice: ChatSuggestion) => choice.kind !== "actor" ? 2 : choice.binding?.id === activeId ? 0 : selectedActorIds.includes(choice.binding!.id) ? 1 : 2;
  return matches.sort((a, b) => priority(a) - priority(b));
}
