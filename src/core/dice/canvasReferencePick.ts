import type { EncounterState } from "@core/encounter/types";
import { formatReferenceName, splitReference } from "./referenceSyntax";
import { referenceBindingKey } from "./referencePath";

export type ReferencePick = { text: string; caret: number; bindings: Record<string, string> };
/** A canvas pick fills only a pending bare @, preserving surrounding prose/target-list structure. */
export function canvasReferencePick(state: EncounterState, draft: string, caret: number, kind: "actor" | "zone" | "engagement", id: string): ReferencePick | null {
  const before = draft.slice(0, caret);
  if (!/(?:^|[\s\[,])@$/.test(before)) return null;
  const entries = kind === "engagement"
    ? (state.engagements.byId[id]?.participantIds ?? []).map(actorId => state.actors.byId[actorId]).filter(Boolean)
    : [kind === "actor" ? state.actors.byId[id] : state.zones.byId[id]].filter(Boolean);
  if (!entries.length) return null;
  const tokens = entries.map(entry => `@${formatReferenceName(entry.name)}`);
  const insideList = splitReference(before, "[").length > splitReference(before, "]").length;
  const wrap = kind === "engagement" && !insideList;
  const replacement = `${wrap ? "[" : ""}${tokens.join(", ")}${wrap ? "]" : ""}`;
  const start = caret - 1;
  const text = draft.slice(0, start) + replacement + draft.slice(caret);
  const bindings: Record<string, string> = {};
  let position = start + (wrap ? 1 : 0);
  entries.forEach((entry, index) => {
    const key = referenceBindingKey(text, position);
    bindings[key] = entry.id;
    position += tokens[index].length + 2;
  });
  return { text, bindings, caret: start + replacement.length };
}
