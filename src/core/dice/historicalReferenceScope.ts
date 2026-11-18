import type { EncounterState } from "@core/encounter/types";
import type { ChatReference } from "@core/chat/types";
import { referenceTextBindings } from "./messageBindings";
import { parseReferencePath, referenceBindingKey, type ReferenceToken } from "./referencePath";
import { resolveReferenceScope } from "./referenceScopeResolution";
import { formatReferenceName, referenceQuote } from "./referenceSyntax";

/** Use saved identities with current names; never substitute a new same-named entity for a deleted parent. */
export function historicalReferenceScope(state: EncounterState, message: string, references: readonly ChatReference[], token: ReferenceToken, through: number) {
  const path = parseReferencePath(token.text);
  const prefix = path.slice(0, through + 1).map((segment, index) => {
    const names = segment.items.map(item => {
      const start = index === 0 && !segment.list ? token.start : token.start + item.start;
      const span = references.find(span => span.start === start && (span.end === token.start + item.end
        || index === 0 && span.kind === "zone" && span.end === token.end));
      const entity = span?.kind === "actor" ? state.actors.byId[span.entityId] : index === 0 && span ? state.zones.byId[span.entityId] : undefined;
      if (span && (span.kind === "actor" || index === 0) && !entity) throw new Error("Stale reference");
      return entity ? formatReferenceName(entity.name, referenceQuote(item.raw)) : item.raw;
    });
    return segment.list ? `[${names.join(",")}]` : names[0];
  }).join(".");
  return resolveReferenceScope(state, `@${prefix}`, referenceBindingKey(message, token.start), referenceTextBindings(message, references));
}
