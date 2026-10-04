import type { EncounterState } from "@core/encounter/types";
import type { EncounterRecord } from "@core/persistence";
import type { LibraryNode, LibrarySection } from "@library/types";

/** Includes links outside a removed folder whose original sources are deleted. */
export function getAudioDeletionImpact(section: LibrarySection, node: LibraryNode, encounter: EncounterState, savedEncounters: readonly EncounterRecord[] = []) {
  const removed = new Set<string>();
  function visit(id: string) {
    if (removed.has(id)) return;
    removed.add(id);
    for (const childId of section.nodesById[id]?.childIds ?? []) visit(childId);
  }
  visit(node.id);
  const links = Object.values(section.nodesById).filter((item) => item.type === "link" && item.targetId && removed.has(item.targetId));
  const affected = new Set([...removed, ...links.map((item) => item.id)]);
  // Saved references still matter after unsaved edits; identical live/saved cues count once.
  const affectedCues = new Set<string>();
  for (const state of [encounter, ...savedEncounters.map((record) => record.state)]) {
    for (const cueId of state.audioCues.allIds) {
      if (affected.has(state.audioCues.byId[cueId].libraryNodeId)) affectedCues.add(JSON.stringify([state.id, cueId]));
    }
  }
  return { cueCount: affectedCues.size, linkCount: links.length };
}
