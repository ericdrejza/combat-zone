import { act, fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAudioCueGroup } from "@entities/audio/audioMutations";
import type { AudioCueTypeChoice } from "@interaction/audioToolTypes";
import { createLink, uploadImage } from "@library/librarySlice";
import { commitEncounterChange, redoEncounterChange, undoEncounterChange } from "@store/encounterSlice";
import { store } from "@store/store";
import { resetAppStore } from "@tests/ui/renderApp";
import { useAudioCueCreation } from "@ui/audio/useAudioCueCreation";
import { InterfacePreferenceProvider, INTERFACE_PREFERENCES_STORAGE_KEY } from "@ui/interface_preferences/InterfacePreferenceProvider";

class MetadataAudio extends EventTarget {
  static instances: MetadataAudio[] = [];
  src = "";
  duration = 31;
  preload = "";
  removeAttribute = vi.fn();
  constructor() { super(); MetadataAudio.instances.push(this); }
}

function Harness({ choice = "asset", useAmbienceDefault = true, newGroup = false }: { choice?: AudioCueTypeChoice; useAmbienceDefault?: boolean; newGroup?: boolean }) {
  const create = useAudioCueCreation();
  return <button onClick={() => create({ nodes: Object.values(store.getState().library.sections.audio.nodesById).filter((node) => node.type !== "folder"), placement: { type: "group", groupId: newGroup ? "new-group" : "ambience" }, choice, useAmbienceDefault, ...(newGroup ? { newGroup: { id: "new-group", name: "New", section: "ambiance" as const, selectedEntityId: null } } : {}) })}>Add cues</button>;
}
function setup(mode: string, props?: { choice?: AudioCueTypeChoice; useAmbienceDefault?: boolean; newGroup?: boolean }, threshold = 30) {
  localStorage.setItem(INTERFACE_PREFERENCES_STORAGE_KEY, JSON.stringify({ audioAmbienceCueTypeDefault: mode, audioAmbienceDurationThreshold: threshold }));
  const upload = uploadImage({ sectionId: "audio", parentId: "audio-root", asset: { name: "Music", audioIcon: "music", mediaType: "audio/mpeg", source: { kind: "embedded", dataUrl: "data:audio/mpeg;base64,AA==" } } });
  store.dispatch(upload);
  store.dispatch(createLink({ sectionId: "audio", parentId: "audio-root", name: "Alias", targetId: upload.payload.id }));
  store.dispatch(commitEncounterChange({ action: { id: "setup", payload: {}, timestamp: 1, type: "test.setup" }, nextEncounter: createAudioCueGroup(store.getState().encounter.present, { id: "ambience", section: "ambiance" }) }));
  return render(<Provider store={store}><InterfacePreferenceProvider><Harness {...props} /></InterfacePreferenceProvider></Provider>);
}
function cueTypes() { return Object.values(store.getState().encounter.present.audioCues.byId).map((cue) => cue.type); }

describe("Ambience cue creation defaults", () => {
  beforeEach(() => { resetAppStore(); MetadataAudio.instances = []; vi.stubGlobal("Audio", MetadataAudio); });
  afterEach(() => { localStorage.removeItem(INTERFACE_PREFERENCES_STORAGE_KEY); vi.unstubAllGlobals(); });
  it.each([["asset_icon", "track"], ["effect", "effect"], ["track", "track"]])("creates %s cues including links in one history command", (mode, type) => {
    setup(mode);
    const before = store.getState().encounter.present;
    fireEvent.click(screen.getByText("Add cues"));
    const after = store.getState().encounter.present;
    expect(cueTypes()).toEqual([type, type]);
    expect(MetadataAudio.instances).toHaveLength(0);
    act(() => store.dispatch(undoEncounterChange()));
    expect(store.getState().encounter.present).toEqual(before);
    act(() => store.dispatch(redoEncounterChange()));
    expect(store.getState().encounter.present).toEqual(after);
  });
  it.each([["effect", "track"], ["asset", "effect"]] as const)("keeps explicit %s tool choice ahead of Defaults", (choice, defaultMode) => {
    setup(defaultMode, { choice, useAmbienceDefault: false });
    fireEvent.click(screen.getByText("Add cues"));
    expect(cueTypes()).toEqual(choice === "asset" ? ["track", "track"] : ["effect", "effect"]);
  });
  it.each([true, false])("uses the saved threshold for default or explicit duration mode (%s)", async (useAmbienceDefault) => {
    setup(useAmbienceDefault ? "duration_threshold" : "effect", { choice: "duration", useAmbienceDefault }, 45.5);
    const before = store.getState().encounter.present;
    fireEvent.click(screen.getByText("Add cues"));
    await act(async () => undefined);
    await act(async () => MetadataAudio.instances[0].dispatchEvent(new Event("loadedmetadata")));
    const after = store.getState().encounter.present;
    expect(cueTypes()).toEqual(["effect", "effect"]);
    act(() => store.dispatch(undoEncounterChange()));
    expect(store.getState().encounter.present).toEqual(before);
    act(() => store.dispatch(redoEncounterChange()));
    expect(store.getState().encounter.present).toEqual(after);
  });
  it("waits for metadata, reads links once and preserves edits made while waiting", async () => {
    setup("duration_threshold");
    fireEvent.click(screen.getByText("Add cues"));
    await act(async () => undefined);
    expect(cueTypes()).toEqual([]);
    expect(MetadataAudio.instances).toHaveLength(1);
    const next = createAudioCueGroup(store.getState().encounter.present, { id: "other", section: "ambiance" });
    act(() => store.dispatch(commitEncounterChange({ action: { id: "other", payload: {}, timestamp: 1, type: "test.setup" }, nextEncounter: next })));
    await act(async () => MetadataAudio.instances[0].dispatchEvent(new Event("loadedmetadata")));
    expect(cueTypes()).toEqual(["track", "track"]);
    expect(store.getState().encounter.present.audioCueGroups.byId.other).toBeDefined();
    act(() => store.dispatch(undoEncounterChange()));
    expect(store.getState().encounter.present).toEqual(next);
  });
  it("creates a new group and its classified directory cues atomically", async () => {
    setup("duration_threshold", { newGroup: true });
    const before = store.getState().encounter.present;
    const history = store.getState().encounter.past.length;
    fireEvent.click(screen.getByText("Add cues"));
    await act(async () => undefined);
    expect(store.getState().encounter.present).toBe(before);
    MetadataAudio.instances[0].duration = 30;
    await act(async () => MetadataAudio.instances[0].dispatchEvent(new Event("loadedmetadata")));
    const after = store.getState().encounter.present;
    expect(cueTypes()).toEqual(["effect", "effect"]);
    expect(after.audioCueGroups.byId["new-group"]).toBeDefined();
    expect(store.getState().encounter.past).toHaveLength(history + 1);
    act(() => store.dispatch(undoEncounterChange()));
    expect(store.getState().encounter.present).toEqual(before);
    act(() => store.dispatch(redoEncounterChange()));
    expect(store.getState().encounter.present).toEqual(after);
  });
  it("does not commit an outstanding metadata read after unmount", async () => {
    const view = setup("duration_threshold");
    fireEvent.click(screen.getByText("Add cues"));
    await act(async () => undefined);
    view.unmount();
    const before = store.getState().encounter;
    await act(async () => MetadataAudio.instances[0].dispatchEvent(new Event("loadedmetadata")));
    expect(store.getState().encounter).toBe(before);
  });
});
