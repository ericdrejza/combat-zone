import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useContext } from "react";
import { Provider } from "react-redux";
import { describe, expect, it } from "vitest";

import { createAudioCue, createAudioCueGroup } from "@entities/audio/audioMutations";
import { createFolder, createLink, deleteNode, moveNode, uploadImage } from "@library/librarySlice";
import { commitEncounterChange, redoEncounterChange, undoEncounterChange } from "@store/encounterSlice";
import { store } from "@store/store";
import { renderApp } from "@tests/ui/renderApp";
import type { EncounterRecord } from "@core/persistence";
import { AssetLibraryModal } from "@ui/library/AssetLibraryModal";
import { PersistenceContext } from "@ui/persistence/PersistenceContext";

function SavedSourcesLibrary({ records }: { records: EncounterRecord[] }) {
  const persistence = useContext(PersistenceContext);
  return <PersistenceContext.Provider value={{ ...persistence, encounters: records }}>
    <AssetLibraryModal currentFolderBySection={{}} initialSectionId="audio" onClose={() => undefined} onCurrentFolderChange={() => undefined} onBackgroundDoubleClick={() => undefined} onTokenDoubleClick={() => undefined} />
  </PersistenceContext.Provider>;
}

function setup() {
  renderApp();
  const source = uploadImage({ parentId: "audio-root", sectionId: "audio", asset: { name: "Original", mediaType: "audio/mpeg", source: { kind: "embedded", dataUrl: "data:audio/mpeg;base64,AA==" } } });
  const replacement = uploadImage({ parentId: "audio-root", sectionId: "audio", asset: { name: "Replacement", mediaType: "audio/mpeg", source: { kind: "embedded", dataUrl: "data:audio/mpeg;base64,AQ==" } } });
  const link = createLink({ parentId: "audio-root", sectionId: "audio", targetId: source.payload.id, name: "Linked" });
  act(() => {
    store.dispatch(source);
    store.dispatch(replacement);
    store.dispatch(link);
    let encounter = createAudioCueGroup(store.getState().encounter.present, { id: "group", name: "Playlist", section: "music" });
    for (const [id, libraryNodeId] of [["original", source.payload.id], ["linked", link.payload.id], ["valid", replacement.payload.id]]) {
      encounter = createAudioCue(encounter, { id, libraryNodeId, placement: { type: "group", groupId: "group" }, type: "track", volume: 0.3, repeat: false });
    }
    store.dispatch(commitEncounterChange({ action: { id: "setup", type: "test.setup", timestamp: 1, payload: {} }, nextEncounter: encounter }));
  });
  return { sourceId: source.payload.id, replacementId: replacement.payload.id, linkId: link.payload.id };
}

function openLibrary() {
  fireEvent.click(screen.getByRole("button", { name: "Library" }));
  const library = screen.getByRole("dialog", { name: "Asset Library" });
  fireEvent.click(within(library).getByRole("tab", { name: "Audio" }));
  return library;
}

function openBoard() {
  fireEvent.click(within(screen.getByLabelText("Audio panel")).getByRole("button", { name: "Open Soundboard" }));
  return screen.getByRole("dialog", { name: "Soundboard modal" });
}

describe("missing audio sources", () => {
  it("warns for an asset used only in a saved encounter", () => {
    const { sourceId } = setup();
    const state = { ...store.getState().encounter.present, id: "saved-only" };
    const records: EncounterRecord[] = [{ id: state.id, state, revision: 1, folderId: null, createdAt: 1, updatedAt: 1 }];
    cleanup();
    act(() => {
      const current = store.getState().encounter.present;
      store.dispatch(commitEncounterChange({ action: { id: "clear", type: "test.clear", timestamp: 2, payload: {} }, nextEncounter: { ...current, audioCues: { byId: {}, allIds: [] } } }));
      // Remove the Library link too, so only saved cues require confirmation.
      const link = Object.values(store.getState().library.sections.audio.nodesById).find((node) => node.type === "link");
      if (link) store.dispatch(deleteNode({ nodeId: link.id, sectionId: "audio" }));
    });
    render(<Provider store={store}><SavedSourcesLibrary records={records} /></Provider>);
    const library = screen.getByRole("dialog", { name: "Asset Library" });
    fireEvent.contextMenu(within(library).getByRole("button", { name: "Original" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    const warning = screen.getByRole("dialog", { name: "Confirm audio deletion" });
    expect(within(warning).getByText(/1 sound cue across the current and saved encounters and 0 linked assets/)).toBeInTheDocument();
    fireEvent.click(within(warning).getByRole("button", { name: "Cancel" }));
    expect(store.getState().library.sections.audio.nodesById[sourceId]).toBeDefined();
    expect(records[0].state).toBe(state);
  });
  it("warns before deleting a directory containing a source referenced outside it", () => {
    const { sourceId } = setup();
    const folder = createFolder({ name: "Sources", parentId: "audio-root", sectionId: "audio" });
    act(() => {
      store.dispatch(folder);
      store.dispatch(moveNode({ nodeId: sourceId, targetFolderId: folder.payload.id, sectionId: "audio" }));
    });
    const library = openLibrary();
    fireEvent.contextMenu(within(library).getByRole("button", { name: "Sources" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    const warning = screen.getByRole("dialog", { name: "Confirm audio deletion" });
    expect(within(warning).getByText(/2 sound cues across the current and saved encounters and 1 linked asset/)).toBeInTheDocument();
    fireEvent.click(within(warning).getByRole("button", { name: "Delete" }));
    expect(store.getState().library.sections.audio.nodesById[sourceId]).toBeUndefined();
    expect(store.getState().library.sections.audio.nodesById[folder.payload.id]).toBeUndefined();
    expect(store.getState().encounter.present.audioCues.allIds).toHaveLength(3);
  });

  it("warns when a source is used only by a Library link", () => {
    setup();
    act(() => {
      const encounter = store.getState().encounter.present;
      store.dispatch(commitEncounterChange({ action: { id: "clear", type: "test.clear", timestamp: 2, payload: {} }, nextEncounter: { ...encounter, audioCues: { byId: {}, allIds: [] } } }));
    });
    const library = openLibrary();
    fireEvent.contextMenu(within(library).getByRole("button", { name: "Original" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(within(screen.getByRole("dialog", { name: "Confirm audio deletion" })).getByText(/0 sound cues across the current and saved encounters and 1 linked asset/)).toBeInTheDocument();
  });

  it("warns about direct cues, linked cues and links before deleting and supports cancellation", () => {
    const { sourceId, linkId } = setup();
    const library = openLibrary();
    fireEvent.contextMenu(within(library).getByRole("button", { name: "Original" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    const warning = screen.getByRole("dialog", { name: "Confirm audio deletion" });
    expect(within(warning).getByText(/2 sound cues across the current and saved encounters and 1 linked asset/)).toBeInTheDocument();
    expect(store.getState().library.sections.audio.nodesById[sourceId]).toBeDefined();
    fireEvent.click(within(warning).getByRole("button", { name: "Cancel" }));
    expect(store.getState().library.sections.audio.nodesById[sourceId]).toBeDefined();
    fireEvent.contextMenu(within(library).getByRole("button", { name: "Original" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Confirm audio deletion" })).getByRole("button", { name: "Delete" }));
    expect(store.getState().library.sections.audio.nodesById[sourceId]).toBeUndefined();
    expect(store.getState().library.sections.audio.nodesById[linkId]).toBeDefined();
    expect(store.getState().encounter.present.audioCues.allIds).toHaveLength(3);
  });

  it("relinks from a missing card with a locked Audio Library, preserving config and undo/redo", () => {
    const { sourceId, replacementId } = setup();
    act(() => store.dispatch(deleteNode({ nodeId: sourceId, sectionId: "audio" })));
    const before = store.getState().encounter.present;
    const board = openBoard();
    const card = board.querySelector('[data-audio-cue-id="original"]') as HTMLElement;
    expect(within(card).queryByRole("button", { name: /^Play / })).not.toBeInTheDocument();
    fireEvent.click(within(card).getByRole("button", { name: "Relink Missing audio" }));
    const library = screen.getByRole("dialog", { name: "Asset Library" });
    expect(within(library).getByRole("tab", { name: "Audio" })).toHaveAttribute("aria-selected", "true");
    expect(within(library).getAllByRole("tab")).toHaveLength(1);
    fireEvent.click(within(library).getByRole("button", { name: "Replacement" }));
    fireEvent.click(within(library).getByRole("button", { name: "Relink Cue" }));
    expect(screen.queryByRole("dialog", { name: "Asset Library" })).not.toBeInTheDocument();
    const after = store.getState().encounter.present;
    expect(after.audioCues.byId.original).toEqual({ ...before.audioCues.byId.original, libraryNodeId: replacementId });
    act(() => store.dispatch(undoEncounterChange()));
    expect(store.getState().encounter.present).toEqual(before);
    act(() => store.dispatch(redoEncounterChange()));
    expect(store.getState().encounter.present).toEqual(after);
  });

  it("counts missing sources and deletes only those cues as one undoable action", () => {
    const { sourceId } = setup();
    const board = openBoard();
    expect(within(board).queryByRole("button", { name: "Click to see warnings" })).not.toBeInTheDocument();
    act(() => store.dispatch(deleteNode({ nodeId: sourceId, sectionId: "audio" })));
    const before = store.getState().encounter.present;
    const history = store.getState().encounter.past.length;
    fireEvent.click(within(board).getByRole("button", { name: "Click to see warnings" }));
    const menu = within(board).getByRole("menu", { name: "Soundboard warnings" });
    expect(within(menu).getByText("2 cues are without sources.")).toBeInTheDocument();
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Delete all unlinked sound cues" }));
    const after = store.getState().encounter.present;
    expect(after.audioCues.allIds).toEqual(["valid"]);
    expect(after.audioCueGroups).toEqual(before.audioCueGroups);
    expect(store.getState().encounter.past).toHaveLength(history + 1);
    expect(within(board).queryByRole("button", { name: "Click to see warnings" })).not.toBeInTheDocument();
    act(() => store.dispatch(undoEncounterChange()));
    expect(store.getState().encounter.present).toEqual(before);
    act(() => store.dispatch(redoEncounterChange()));
    expect(store.getState().encounter.present).toEqual(after);
  });
});
