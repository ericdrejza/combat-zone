import type { EncounterState } from "@core/encounter/types";
import type { ChatReference } from "@core/chat/types";
import { parseReferencePath, referenceTokens } from "./referencePath";
import { historicalReferenceScope } from "./historicalReferenceScope";

/** Resolve only the hovered scope so later stale Actor names do not break faction outlines. */
export function referencePreviewActorIds(state: EncounterState, message: string, references: ChatReference[], hovered: ChatReference): string[] {
  const fallback = state.actors.allIds.filter(id => state.actors.byId[id].currentZoneId === hovered.entityId);
  const token = referenceTokens(message).find(token => token.start <= hovered.start && token.end >= hovered.end);
  if (!token) return fallback;
  try {
    const path = parseReferencePath(token.text);
    const whole = hovered.start === token.start && hovered.end === token.end;
    const segmentIndex = whole ? path.length - 1 : path.findIndex((segment, index) => segment.items.some(item =>
      (index === 0 && !segment.list ? token.start : token.start + item.start) === hovered.start && token.start + item.end === hovered.end));
    if (segmentIndex < 0) return fallback;
    const itemIndex = whole ? 0 : path[segmentIndex].items.findIndex(item => token.start + item.end === hovered.end);
    const resolved = historicalReferenceScope(state, message, references, token, segmentIndex);
    return Array.from(new Set(resolved.segments[segmentIndex].selected[Math.max(0, itemIndex)].nodes.flatMap(node => node.actorIds)));
  } catch { return fallback; }
}
