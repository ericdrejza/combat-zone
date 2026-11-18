import type { ChatMessage, ChatReference } from "@core/chat/types";
import { parseReferencePath, referenceBindingKey, referenceItemKey, referenceTokens } from "./referencePath";
import { FACTION_REFERENCES } from "./referenceChoices";

/** Restore each list item's saved identity without choosing duplicate names arbitrarily. */
export function referenceTextBindings(text: string, references: readonly ChatReference[] = []): Record<string, string> {
  const bindings: Record<string, string> = {};
  for (const token of referenceTokens(text)) {
    const key = referenceBindingKey(text, token.start);
    try {
      const path = parseReferencePath(token.text);
      path.forEach((segment, index) => segment.items.forEach((item, itemIndex) => {
        const start = index === 0 && !segment.list ? token.start : token.start + item.start;
        const span = references.find(reference => reference.start === start && (reference.end === token.start + item.end
          || index === 0 && reference.kind === "zone" && reference.end === token.end));
        if (!span) {
          const faction = index === 0 && !item.quoted && FACTION_REFERENCES.find(faction => faction.name === item.name.toLowerCase());
          if (faction) bindings[referenceItemKey(key, index, itemIndex)] = `faction:global:${faction.group}`;
          return;
        }
        bindings[referenceItemKey(key, index, itemIndex)] = span.entityId;
        if (index === 0 && span.kind === "zone" && !segment.list) bindings[`${key}:zone`] = span.entityId;
        if (!segment.list && (span.kind === "actor" || path.length === 1)) bindings[key] = span.entityId;
      }));
    } catch { /* Unfinished prose has no identities to restore. */ }
  }
  return bindings;
}
/** Replays retain choices while current names and scope still match the saved reference. */
export function messageBindings(message: ChatMessage): Record<string, string> {
  return { ...referenceTextBindings(message.message, message.references), ...(message.invocation ? {
    source: message.invocation.actorId, rollable: message.invocation.rollable.id
  } : {}) };
}
