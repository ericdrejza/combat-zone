import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { createAudioCueGroup } from "@entities/audio/audioMutations";
import { uploadImage } from "@library/librarySlice";
import { commitEncounterChange, redoEncounterChange, undoEncounterChange } from "@store/encounterSlice";
import { store } from "@store/store";
import { renderApp } from "@tests/ui/renderApp";
import { INTERFACE_PREFERENCES_STORAGE_KEY } from "@ui/interface_preferences/InterfacePreferenceProvider";

function openLibrary(type: "loop" | "one_shot") {
  localStorage.setItem(INTERFACE_PREFERENCES_STORAGE_KEY, JSON.stringify({
    audioCueTypeDefaults: { encounter: type }, audioCueVolumeDefault: 0,
    audioRepeatDelayDefaults: { minimumDelaySeconds: 0, maximumDelaySeconds: 120 }
  }));
  renderApp();
  act(() => {
    store.dispatch(uploadImage({
      asset: { mediaType: "audio/mpeg", name: "Theme", source: { dataUrl: "data:audio/mpeg;base64,AA==", kind: "embedded" } },
      parentId: "audio-root", sectionId: "audio"
    }));
    let encounter = createAudioCueGroup(store.getState().encounter.present, { id: "ambience", name: "Weather", section: "ambiance" });
    encounter = createAudioCueGroup(encounter, { id: "music", name: "Playlist", section: "music" });
    store.dispatch(commitEncounterChange({ action: { id: "setup", payload: {}, timestamp: 1, type: "test.setup" }, nextEncounter: encounter }));
  });
  fireEvent.click(screen.getByRole("button", { name: "Library" }));
  const library = screen.getByRole("dialog", { name: "Asset Library" });
  fireEvent.click(within(library).getByRole("tab", { name: "Audio" }));
  fireEvent.click(within(library).getByRole("button", { name: "Theme" }));
  fireEvent.click(within(library).getByRole("button", { name: "Add Cue" }));
  expect(screen.queryByRole("dialog", { name: "Asset Library" })).not.toBeInTheDocument();
  return screen.getByRole("dialog", { name: "Choose audio destination" });
}

describe("normal Library audio assignment", () => {
  afterEach(() => localStorage.removeItem(INTERFACE_PREFERENCES_STORAGE_KEY));
  it("offers existing and new Ambience and Music groups for Loops, with atomic undo/redo", () => {
    const dialog = openLibrary("loop");
    expect(within(dialog).getByRole("button", { name: "Weather" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Playlist" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Create new Ambience group" })).toBeInTheDocument();
    const before = store.getState().encounter.present;
    const historyLength = store.getState().encounter.past.length;
    fireEvent.click(within(dialog).getByRole("button", { name: "Create new Music group" }));
    const naming = screen.getByRole("dialog", { name: "Name new cue group" });
    expect(screen.queryByRole("dialog", { name: "Choose audio destination" })).not.toBeInTheDocument();
    expect(store.getState().encounter.present).toBe(before);
    const name = within(naming).getByRole("textbox", { name: "Group name" });
    expect(name).toHaveAttribute("placeholder", "New Music Group");
    expect(name).toHaveFocus();
    fireEvent.change(name, { target: { value: "  Battle tracks  " } });
    fireEvent.click(within(naming).getByRole("button", { name: "Create" }));
    expect(screen.queryByRole("dialog", { name: "Name new cue group" })).not.toBeInTheDocument();
    const added = store.getState().encounter.present;
    const cue = added.audioCues.byId[added.audioCues.allIds[0]];
    expect(cue).toMatchObject({ type: "loop", volume: 0, repeatDelay: { minimumDelaySeconds: 0, maximumDelaySeconds: 120 } });
    expect(added.audioCueGroups.byId[cue.placement.groupId]).toMatchObject({ section: "music", name: "Battle tracks" });
    expect(store.getState().encounter.past).toHaveLength(historyLength + 1);
    act(() => store.dispatch(undoEncounterChange()));
    expect(store.getState().encounter.present).toEqual(before);
    act(() => store.dispatch(redoEncounterChange()));
    expect(store.getState().encounter.present).toEqual(added);
  });
  it("offers only Ambience destinations for Effects and applies defaults to an existing group", () => {
    const dialog = openLibrary("one_shot");
    expect(within(dialog).queryByRole("button", { name: "Playlist" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Create new Music group" })).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Create new Ambience group" })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Weather" }));
    const encounter = store.getState().encounter.present;
    expect(encounter.audioCues.byId[encounter.audioCues.allIds[0]]).toMatchObject({
      placement: { type: "group", groupId: "ambience" }, type: "one_shot", volume: 0
    });
  });
  it.each(["", "   "])("uses the placeholder name when Create is submitted with %j", (name) => {
    const dialog = openLibrary("one_shot");
    fireEvent.click(within(dialog).getByRole("button", { name: "Create new Ambience group" }));
    const naming = screen.getByRole("dialog", { name: "Name new cue group" });
    const field = within(naming).getByRole("textbox", { name: "Group name" });
    const defaultName = field.getAttribute("placeholder");
    expect(field).toHaveValue("");
    fireEvent.change(field, { target: { value: name } });
    fireEvent.click(within(naming).getByRole("button", { name: "Create" }));
    const encounter = store.getState().encounter.present;
    const cue = encounter.audioCues.byId[encounter.audioCues.allIds[0]];
    expect(encounter.audioCueGroups.byId[cue.placement.groupId]).toMatchObject({ name: defaultName, section: "ambiance" });
  });
  it("returns Back to destination choices without creating anything", () => {
    const dialog = openLibrary("loop");
    const before = store.getState().encounter;
    fireEvent.click(within(dialog).getByRole("button", { name: "Create new Music group" }));
    const naming = screen.getByRole("dialog", { name: "Name new cue group" });
    fireEvent.change(within(naming).getByRole("textbox", { name: "Group name" }), { target: { value: "Draft name" } });
    fireEvent.click(within(naming).getByRole("button", { name: "Back" }));
    const destinations = screen.getByRole("dialog", { name: "Choose audio destination" });
    expect(store.getState().encounter).toBe(before);
    fireEvent.click(within(destinations).getByRole("button", { name: "Weather" }));
    const encounter = store.getState().encounter.present;
    expect(encounter.audioCueGroups.allIds).toEqual(before.present.audioCueGroups.allIds);
    expect(encounter.audioCues.byId[encounter.audioCues.allIds[0]].placement.groupId).toBe("ambience");
  });
});
