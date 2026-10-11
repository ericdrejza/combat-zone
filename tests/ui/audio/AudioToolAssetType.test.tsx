import { act, fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createAudioCueGroup } from "@entities/audio/audioMutations";
import { setActiveTool, setAudioCueType, setAudioSectionType } from "@interaction/interactionState";
import { uploadImage } from "@library/librarySlice";
import { commitEncounterChange, redoEncounterChange, undoEncounterChange } from "@store/encounterSlice";
import { store } from "@store/store";
import { renderApp } from "@tests/ui/renderApp";

describe("asset cue type tool choice", () => {
  it("places the asset choice before Track and Effect, and keeps Zone/Actor effect-only", () => {
    renderApp();
    act(() => store.dispatch(setActiveTool("audio")));
    const choices = within(screen.getByRole("radiogroup", { name: "Audio cue type" })).getAllByRole("radio");
    expect(choices.map((choice) => choice.getAttribute("aria-label"))).toEqual(["Use asset cue type", "Use duration threshold", "Track cue", "Effect cue"]);
    expect(choices[0]).toHaveAttribute("title", "Use asset cue type");
    fireEvent.click(choices[1]);
    expect(store.getState().interaction.audioTool.cueTypeBySection.encounter).toBe("duration");
    expect(choices[1]).toHaveAttribute("title", "Use duration threshold");
    fireEvent.click(choices[0]);
    expect(store.getState().interaction.audioTool.cueTypeBySection.encounter).toBe("asset");
    expect(choices[0]).toBeChecked();
    for (const section of ["zone", "actor"] as const) {
      act(() => store.dispatch(setAudioSectionType(section)));
      expect(choices[0]).toBeDisabled();
      expect(choices[1]).toBeDisabled();
      expect(choices[2]).toBeDisabled();
      act(() => store.dispatch(setAudioCueType("duration")));
      expect(store.getState().interaction.audioTool.cueTypeBySection[section]).toBe("effect");
      act(() => store.dispatch(setAudioCueType("asset")));
      expect(store.getState().interaction.audioTool.cueTypeBySection[section]).toBe("effect");
    }
  });
  it.each([undefined, "music"] as const)("uses an asset marked %s when assigning from the Library", (audioIcon) => {
    renderApp();
    act(() => {
      store.dispatch(setActiveTool("audio"));
      store.dispatch(setAudioCueType("asset"));
      store.dispatch(uploadImage({ sectionId: "audio", parentId: "audio-root", asset: { name: "Sound", mediaType: "audio/mpeg", ...(audioIcon ? { audioIcon } : {}), source: { kind: "embedded", dataUrl: "data:audio/mpeg;base64,AA==" } } }));
      store.dispatch(commitEncounterChange({ action: { id: "setup", type: "test.setup", payload: {}, timestamp: 1 }, nextEncounter: createAudioCueGroup(store.getState().encounter.present, { id: "ambience", name: "Weather", section: "ambiance" }) }));
    });
    fireEvent.click(screen.getByRole("button", { name: "Library" }));
    const library = screen.getByRole("dialog", { name: "Asset Library" });
    fireEvent.click(within(library).getByRole("tab", { name: "Audio" }));
    fireEvent.click(within(library).getByRole("button", { name: "Sound" }));
    fireEvent.click(within(library).getByRole("button", { name: "Add Cue" }));
    const before = store.getState().encounter.present;
    fireEvent.click(within(screen.getByRole("dialog", { name: "Choose audio destination" })).getByRole("button", { name: "Weather" }));
    const after = store.getState().encounter.present;
    expect(Object.values(after.audioCues.byId)[0].type).toBe(audioIcon === "music" ? "track" : "effect");
    act(() => store.dispatch(undoEncounterChange()));
    expect(store.getState().encounter.present).toEqual(before);
    act(() => store.dispatch(redoEncounterChange()));
    expect(store.getState().encounter.present).toEqual(after);
  });
});
