import { act, fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createAudioCueGroup } from "@entities/audio/audioMutations";
import { createFolder, createLink, uploadImage } from "@library/librarySlice";
import { commitEncounterChange, redoEncounterChange, undoEncounterChange } from "@store/encounterSlice";
import { store } from "@store/store";
import { renderApp } from "@tests/ui/renderApp";

function setup(nested = true, empty = false) {
  renderApp();
  const folder = createFolder({ name: "Collection", parentId: "audio-root", sectionId: "audio" });
  act(() => {
    store.dispatch(folder);
    function upload(parentId: string, name: string) {
      const action = uploadImage({ parentId, sectionId: "audio", asset: { name, mediaType: "audio/mpeg", source: { kind: "embedded", dataUrl: "data:audio/mpeg;base64,AA==" } } });
      store.dispatch(action);
      return action.payload.id;
    }
    if (!empty) {
      const first = upload(folder.payload.id, "First");
      store.dispatch(createLink({ parentId: folder.payload.id, sectionId: "audio", targetId: first, name: "Linked first" }));
      if (nested) {
        const child = createFolder({ name: "Nested", parentId: folder.payload.id, sectionId: "audio" });
        store.dispatch(child);
        upload(child.payload.id, "Nested track");
      }
    }
    const encounter = createAudioCueGroup(store.getState().encounter.present, { id: "playlist", name: "Playlist", section: "music" });
    store.dispatch(commitEncounterChange({ action: { id: "setup", type: "test.setup", timestamp: 1, payload: {} }, nextEncounter: encounter }));
  });
  return folder.payload.id;
}

function selectFolder() {
  const library = screen.getByRole("dialog", { name: "Asset Library" });
  fireEvent.click(within(library).getByRole("tab", { name: "Audio" }));
  fireEvent.click(within(library).getByRole("button", { name: "Collection" }));
  return within(library).getByRole("button", { name: "Add all cues from directory" });
}

function openFolder() {
  fireEvent.click(screen.getByRole("button", { name: "Library" }));
  fireEvent.click(selectFolder());
}

describe("directory cue assignment", () => {
  it.each([false, true])("adds one batch with recursive=%s and supports undo/redo", (recursive) => {
    setup();
    const before = store.getState().encounter.present;
    const history = store.getState().encounter.past.length;
    openFolder();
    const prompt = screen.getByRole("dialog", { name: "Include audio subdirectories" });
    fireEvent.click(within(prompt).getByRole("button", { name: recursive ? "Include all subdirectories (3 cues)" : "This directory only (2 cues)" }));
    const destination = screen.getByRole("dialog", { name: "Choose audio destination" });
    fireEvent.click(within(destination).getByRole("button", { name: "Playlist" }));
    expect(screen.queryByRole("dialog", { name: "Choose audio destination" })).not.toBeInTheDocument();
    const added = store.getState().encounter.present;
    expect(added.audioCues.allIds).toHaveLength(recursive ? 3 : 2);
    expect(added.audioCues.allIds.map((id) => store.getState().library.sections.audio.nodesById[added.audioCues.byId[id].libraryNodeId].name)).toEqual(recursive ? ["First", "Linked first", "Nested track"] : ["First", "Linked first"]);
    expect(store.getState().encounter.past).toHaveLength(history + 1);
    act(() => store.dispatch(undoEncounterChange()));
    expect(store.getState().encounter.present).toEqual(before);
    act(() => store.dispatch(redoEncounterChange()));
    expect(store.getState().encounter.present).toEqual(added);
  });

  it("skips the recursion prompt without subfolders and names a new group once", () => {
    setup(false);
    const before = store.getState().encounter.present;
    openFolder();
    expect(screen.queryByRole("dialog", { name: "Include audio subdirectories" })).not.toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("dialog", { name: "Choose audio destination" })).getByRole("button", { name: "Create new Music group" }));
    const naming = screen.getByRole("dialog", { name: "Name new cue group" });
    fireEvent.change(within(naming).getByRole("textbox", { name: "Group name" }), { target: { value: "Collection playlist" } });
    fireEvent.click(within(naming).getByRole("button", { name: "Create" }));
    const added = store.getState().encounter.present;
    expect(added.audioCues.allIds).toHaveLength(2);
    const groupId = added.audioCues.byId[added.audioCues.allIds[0]].placement.groupId;
    expect(added.audioCueGroups.byId[groupId].name).toBe("Collection playlist");
    expect(added.audioCues.allIds.every((id) => added.audioCues.byId[id].placement.groupId === groupId)).toBe(true);
    act(() => store.dispatch(undoEncounterChange()));
    expect(store.getState().encounter.present).toEqual(before);
  });

  it("cancels recursion without creating cues", () => {
    setup();
    const before = store.getState().encounter;
    openFolder();
    fireEvent.click(within(screen.getByRole("dialog", { name: "Include audio subdirectories" })).getByRole("button", { name: "Cancel" }));
    expect(store.getState().encounter).toBe(before);
  });

  it("uses an existing Soundboard group without asking for a destination again", () => {
    setup();
    fireEvent.click(within(screen.getByLabelText("Audio panel")).getByRole("button", { name: "Open Soundboard" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Soundboard modal" })).getByRole("button", { name: "Add cue to Playlist" }));
    fireEvent.click(selectFolder());
    fireEvent.click(within(screen.getByRole("dialog", { name: "Include audio subdirectories" })).getByRole("button", { name: "Include all subdirectories (3 cues)" }));
    expect(screen.queryByRole("dialog", { name: "Choose audio destination" })).not.toBeInTheDocument();
    const encounter = store.getState().encounter.present;
    expect(encounter.audioCues.allIds).toHaveLength(3);
    expect(encounter.audioCues.allIds.every((id) => encounter.audioCues.byId[id].placement.groupId === "playlist")).toBe(true);
  });

  it("disables adding an empty directory", () => {
    setup(false, true);
    fireEvent.click(screen.getByRole("button", { name: "Library" }));
    expect(selectFolder()).toBeDisabled();
  });
});
