import { describe, expect, it } from "vitest";
import reducer, { createLink, resolveLibraryAsset, setAudioAssetIcon, uploadImage } from "@library/librarySlice";
import { InMemoryWorkspaceRepository } from "@core/persistence/memoryRepository";
import { assertLibraryState } from "@core/persistence/envelope";

function audioLibrary() {
  let state = reducer(undefined, uploadImage({
    sectionId: "audio", parentId: "audio-root",
    asset: { mediaType: "audio/mpeg", name: "Theme", source: { kind: "embedded", dataUrl: "data:audio/mpeg;base64,AA==" } }
  }));
  const originalId = state.sections.audio.nodesById["audio-root"].childIds![0];
  state = reducer(state, createLink({ sectionId: "audio", parentId: "audio-root", targetId: originalId, name: "Alias" }));
  const linkId = state.sections.audio.nodesById["audio-root"].childIds![1];
  return { state, originalId, linkId };
}

describe("audio asset icon preference", () => {
  it("updates the original through a link without duplicating metadata", () => {
    const { state, originalId, linkId } = audioLibrary();
    const music = reducer(state, setAudioAssetIcon({ sectionId: "audio", nodeId: linkId, icon: "music" }));
    expect(resolveLibraryAsset(music.sections.audio, originalId)?.audioIcon).toBe("music");
    expect(resolveLibraryAsset(music.sections.audio, linkId)).toEqual(resolveLibraryAsset(music.sections.audio, originalId));
    expect(music.sections.audio.nodesById[linkId]).not.toHaveProperty("asset");
    const audio = reducer(music, setAudioAssetIcon({ sectionId: "audio", nodeId: originalId, icon: "audio" }));
    expect(resolveLibraryAsset(audio.sections.audio, linkId)).not.toHaveProperty("audioIcon");
    expect(state.sections.audio.nodesById[originalId].asset).not.toHaveProperty("audioIcon");
    expect(reducer(state, setAudioAssetIcon({ sectionId: "audio", nodeId: "audio-root", icon: "music" }))).toBe(state);
  });

  it("persists and exports the preference and rejects unsupported icon values", async () => {
    const { state, originalId } = audioLibrary();
    const music = reducer(state, setAudioAssetIcon({ sectionId: "audio", nodeId: originalId, icon: "music" }));
    const repository = new InMemoryWorkspaceRepository();
    await repository.saveLibrary(music);
    expect((await repository.getLibrary()).state).toEqual(music);
    expect((await repository.exportWorkspace()).workspace.library.state).toEqual(music);
    expect(() => assertLibraryState(music)).not.toThrow();
    const invalid = structuredClone(music);
    Object.assign(invalid.sections.audio.nodesById[originalId].asset!, { audioIcon: "image" });
    expect(() => assertLibraryState(invalid)).toThrow(/audio icon/);
    expect((await repository.getLibrary()).state).toEqual(music);
  });
});
