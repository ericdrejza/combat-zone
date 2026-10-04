import { describe, expect, it } from "vitest";

import { createEncounterState } from "@core/encounter/createEncounterState";
import type { EncounterState } from "@core/encounter/types";
import type { EncounterRecord } from "@core/persistence";
import { createAudioCue, createAudioCueGroup } from "@entities/audio/audioMutations";
import type { LibrarySection } from "@library/types";
import { getAudioDeletionImpact } from "@ui/library/audioDeletionImpact";

const library: LibrarySection = {
  id: "audio", name: "Audio", rootId: "audio-root", nodesById: {
    "audio-root": { id: "audio-root", name: "Audio", type: "folder", sectionId: "audio", parentId: null, childIds: ["source", "link"] },
    source: { id: "source", name: "Source", type: "image", sectionId: "audio", parentId: "audio-root" },
    link: { id: "link", name: "Link", type: "link", sectionId: "audio", parentId: "audio-root", targetId: "source" }
  }
};
function withCue(id: string, libraryNodeId = "source") {
  const state = createAudioCueGroup(createEncounterState({ id, name: id }), { id: "group", section: "music" });
  return createAudioCue(state, { id: "cue", type: "track", libraryNodeId, placement: { type: "group", groupId: "group" } });
}
function record(state: EncounterState): EncounterRecord {
  return { id: state.id, state, folderId: null, revision: 1, createdAt: 1, updatedAt: 1 };
}

describe("audio deletion impact across encounters", () => {
  it("checks every saved encounter including indirect link references", () => {
    const current = createEncounterState({ id: "current", name: "Current" });
    const saved = [record(withCue("one")), record(withCue("two", "link")), record(withCue("three", "other"))];
    expect(getAudioDeletionImpact(library, library.nodesById.source, current, saved)).toEqual({ cueCount: 2, linkCount: 1 });
  });
  it("counts a live/saved cue once but the same cue ID in another encounter separately", () => {
    const current = withCue("current");
    expect(getAudioDeletionImpact(library, library.nodesById.source, current, [record(current), record(withCue("other"))])).toEqual({ cueCount: 2, linkCount: 1 });
  });
  it("still warns about saved sources after unsaved removal or relinking", () => {
    const saved = record(withCue("current"));
    const removed = createEncounterState({ id: "current", name: "Current" });
    expect(getAudioDeletionImpact(library, library.nodesById.source, removed, [saved]).cueCount).toBe(1);
    expect(getAudioDeletionImpact(library, library.nodesById.source, withCue("current", "other"), [saved]).cueCount).toBe(1);
  });
});
