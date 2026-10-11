import { act, fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAudioCueGroup } from "@entities/audio/audioMutations";
import { uploadImage } from "@library/librarySlice";
import { commitEncounterChange, redoEncounterChange, undoEncounterChange } from "@store/encounterSlice";
import { store } from "@store/store";
import { resetAppStore } from "@tests/ui/renderApp";
import { AudioPlaybackProvider } from "@ui/audio/AudioPlaybackProvider";
import { useAudioCueAssignment } from "@ui/audio/useAudioCueAssignment";
import { InterfacePreferenceProvider, INTERFACE_PREFERENCES_STORAGE_KEY } from "@ui/interface_preferences/InterfacePreferenceProvider";

class MetadataAudio extends EventTarget {
  static instances: MetadataAudio[] = [];
  duration = 31;
  src = "";
  preload = "";
  removeAttribute = vi.fn();
  constructor() { super(); MetadataAudio.instances.push(this); }
}

function Harness({ soundboard = false }: { soundboard?: boolean }) {
  const assignment = useAudioCueAssignment();
  const node = Object.values(store.getState().library.sections.audio.nodesById).find((node) => node.type === "image")!;
  return <><button onClick={() => soundboard
    ? assignment.addToGroup(node, { type: "group", groupId: "ambience" })
    : assignment.requestDestination(node, { cueType: "duration" })}>Add</button>{assignment.dialog}</>;
}

function setup(threshold: number, soundboard = false) {
  localStorage.setItem(INTERFACE_PREFERENCES_STORAGE_KEY, JSON.stringify({ audioAmbienceCueTypeDefault: soundboard ? "duration_threshold" : "effect", audioAmbienceDurationThreshold: threshold }));
  store.dispatch(uploadImage({ sectionId: "audio", parentId: "audio-root", asset: { name: "Sound", audioIcon: "music", mediaType: "audio/mpeg", source: { kind: "embedded", dataUrl: "data:audio/mpeg;base64,AA==" } } }));
  let encounter = createAudioCueGroup(store.getState().encounter.present, { id: "ambience", name: "Weather", section: "ambiance" });
  encounter = createAudioCueGroup(encounter, { id: "music", name: "Score", section: "music" });
  store.dispatch(commitEncounterChange({ action: { id: "setup", payload: {}, timestamp: 1, type: "test.setup" }, nextEncounter: encounter }));
  return render(<Provider store={store}><InterfacePreferenceProvider><AudioPlaybackProvider><Harness soundboard={soundboard} /></AudioPlaybackProvider></InterfacePreferenceProvider></Provider>);
}

describe("duration-based cue assignment", () => {
  beforeEach(() => { resetAppStore(); MetadataAudio.instances = []; vi.stubGlobal("Audio", MetadataAudio); });
  afterEach(() => { localStorage.removeItem(INTERFACE_PREFERENCES_STORAGE_KEY); vi.unstubAllGlobals(); });

  it.each([[45.5, "effect"], [15, "track"]])("uses threshold %s to show compatible destinations and commit once", async (threshold, type) => {
    setup(Number(threshold));
    const before = store.getState().encounter.present;
    const history = store.getState().encounter.past.length;
    fireEvent.click(screen.getByText("Add"));
    await act(async () => undefined);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await act(async () => MetadataAudio.instances[0].dispatchEvent(new Event("loadedmetadata")));
    expect(screen.queryByRole("button", { name: "Score" }) !== null).toBe(type === "track");
    fireEvent.click(screen.getByRole("button", { name: "Weather" }));
    const after = store.getState().encounter.present;
    expect(Object.values(after.audioCues.byId)[0].type).toBe(type);
    expect(MetadataAudio.instances).toHaveLength(1);
    expect(store.getState().encounter.past).toHaveLength(history + 1);
    act(() => store.dispatch(undoEncounterChange()));
    expect(store.getState().encounter.present).toEqual(before);
    act(() => store.dispatch(redoEncounterChange()));
    expect(store.getState().encounter.present).toEqual(after);
  });

  it("uses the same saved threshold for additions to a Soundboard group", async () => {
    setup(45.5, true);
    fireEvent.click(screen.getByText("Add"));
    await act(async () => undefined);
    await act(async () => MetadataAudio.instances[0].dispatchEvent(new Event("loadedmetadata")));
    expect(Object.values(store.getState().encounter.present.audioCues.byId)[0].type).toBe("effect");
  });

  it("falls back to the asset mark if metadata fails", async () => {
    setup(45.5);
    fireEvent.click(screen.getByText("Add"));
    await act(async () => undefined);
    await act(async () => MetadataAudio.instances[0].dispatchEvent(new Event("error")));
    expect(screen.getByRole("button", { name: "Score" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Weather" }));
    expect(Object.values(store.getState().encounter.present.audioCues.byId)[0].type).toBe("track");
  });

  it("ignores a stale read when a new assignment is requested", async () => {
    setup(45.5);
    fireEvent.click(screen.getByText("Add"));
    await act(async () => undefined);
    fireEvent.click(screen.getByText("Add"));
    await act(async () => undefined);
    await act(async () => MetadataAudio.instances[0].dispatchEvent(new Event("loadedmetadata")));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await act(async () => MetadataAudio.instances[1].dispatchEvent(new Event("loadedmetadata")));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
