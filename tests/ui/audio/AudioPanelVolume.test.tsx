import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createAudioCue, createAudioCueGroup } from "@entities/audio/audioMutations";
import { setActiveTool } from "@interaction/interactionState";
import { uploadImage } from "@library/librarySlice";
import { commitEncounterChange } from "@store/encounterSlice";
import { store } from "@store/store";
import { renderApp } from "@tests/ui/renderApp";
import { INTERFACE_PREFERENCES_STORAGE_KEY } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { THEME_STORAGE_KEY } from "@ui/theme/ThemeProvider";

describe("Audio panel volume controls", () => {
  afterEach(() => vi.restoreAllMocks());

  it("commits a cue volume to encounter history only when the slider is released", () => {
    renderApp();
    act(() => {
      store.dispatch(uploadImage({
        asset: {
          mediaType: "audio/mpeg",
          name: "Rain",
          source: { dataUrl: "data:audio/mpeg;base64,AA==", kind: "embedded" }
        },
        parentId: "audio-root",
        sectionId: "audio"
      }));
    });
    const nodeId = store.getState().library.sections.audio.nodesById["audio-root"].childIds?.[0] as string;
    act(() => {
      store.dispatch(commitEncounterChange({
        action: { id: "setup", payload: {}, timestamp: 1, type: "test.setup" },
        nextEncounter: createAudioCue(createAudioCueGroup(store.getState().encounter.present, { id: "ambience", name: "Ambience", section: "ambiance" }), {
          id: "rain-cue",
          libraryNodeId: nodeId,
          placement: { type: "group", groupId: "ambience" },
          type: "loop"
        })
      }));
    });

    const volumeToggle = screen.getByRole("button", { name: "Show audio cue volumes" });
    const audioPanel = screen.getByLabelText("Audio panel");
    const soundboardButton = within(audioPanel).getByRole("button", { name: "Open Soundboard" });
    const reorderButton = within(audioPanel).getByRole("button", { name: "Reorder Audio panel" });
    expect(soundboardButton.nextElementSibling).toBe(volumeToggle);
    expect(volumeToggle.nextElementSibling).toBe(reorderButton);
    expect(volumeToggle).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(volumeToggle);
    expect(screen.getByRole("button", { name: "Hide audio cue volumes" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: /Volume for Rain/ }));
    const slider = screen.getByRole("slider", { name: "Set volume for Rain" });
    const historyLength = store.getState().encounter.past.length;

    fireEvent.change(slider, { target: { value: "35" } });

    expect(slider).toHaveValue("35");
    expect(store.getState().encounter.present.audioCues.byId["rain-cue"].volume).toBe(0.5);
    expect(store.getState().encounter.past).toHaveLength(historyLength);

    fireEvent.pointerUp(slider);

    expect(store.getState().encounter.present.audioCues.byId["rain-cue"].volume).toBe(0.35);
    expect(store.getState().encounter.past).toHaveLength(historyLength + 1);

    fireEvent.blur(slider);
    expect(store.getState().encounter.past).toHaveLength(historyLength + 1);
  });

  it("defers the master-volume preference write until release", () => {
    renderApp();
    expect(screen.queryByRole("slider", { name: "Audio panel master volume" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show audio cue volumes" }));
    const slider = screen.getByRole("slider", { name: "Audio panel master volume" });
    const storedBeforeDrag = localStorage.getItem(INTERFACE_PREFERENCES_STORAGE_KEY);

    fireEvent.change(slider, { target: { value: "42" } });

    expect(slider).toHaveValue("42");
    expect(localStorage.getItem(INTERFACE_PREFERENCES_STORAGE_KEY)).toBe(storedBeforeDrag);

    fireEvent.pointerUp(slider);

    const stored = JSON.parse(localStorage.getItem(INTERFACE_PREFERENCES_STORAGE_KEY) ?? "{}") as {
      audioMasterVolume?: number;
    };
    expect(stored.audioMasterVolume).toBe(0.42);
  });

  it("shows section-specific movement triggers and Effect-only Zone and Actor cards", () => {
    renderApp();
    act(() => {
      store.dispatch(uploadImage({ asset: { mediaType: "audio/mpeg", name: "Step", source: { dataUrl: "data:audio/mpeg;base64,AA==", kind: "embedded" } }, parentId: "audio-root", sectionId: "audio" }));
    });
    const nodeId = store.getState().library.sections.audio.nodesById["audio-root"].childIds?.[0] as string;
    let encounter = createAudioCueGroup(store.getState().encounter.present, { id: "zone-fx", name: "Zone FX", section: "zone" });
    encounter = createAudioCueGroup(encounter, { id: "actor-fx", name: "Actor FX", section: "actor" });
    encounter = createAudioCue(encounter, { id: "zone-step", libraryNodeId: nodeId, placement: { type: "group", groupId: "zone-fx" }, type: "one_shot" });
    encounter = createAudioCue(encounter, { id: "actor-step", libraryNodeId: nodeId, placement: { type: "group", groupId: "actor-fx" }, type: "one_shot" });
    act(() => store.dispatch(commitEncounterChange({ action: { id: "setup-triggers", payload: {}, timestamp: 1, type: "test.setup" }, nextEncounter: encounter })));

    fireEvent.click(within(screen.getByLabelText("Audio panel")).getByRole("button", { name: "Open Soundboard" }));
    const modal = screen.getByRole("dialog", { name: "Soundboard modal" });
    for (const label of ["Entering zone", "Leaving zone", "Actor enters zone", "Actor leaves zone"]) expect(within(modal).queryByRole("checkbox", { name: label })).not.toBeInTheDocument();
    const zoneCard = within(modal).getByLabelText("Name for Zone FX").closest("article") as HTMLElement;
    const actorCard = within(modal).getByLabelText("Name for Actor FX").closest("article") as HTMLElement;
    for (const card of [zoneCard, actorCard]) {
      expect(within(card).getByRole("radio", { name: "Effect" })).toBeInTheDocument();
      expect(within(card).queryByRole("radio", { name: "Loop" })).not.toBeInTheDocument();
      expect(within(card).getByRole("button", { name: "Enable repeat" }).querySelector(".lucide-repeat-1")).not.toBeNull();
      fireEvent.click(within(card).getByRole("button", { name: "Enable triggers" }));
    }
    for (const label of ["Entering zone", "Leaving zone", "Actor enters zone", "Actor leaves zone"]) expect(within(modal).getByRole("checkbox", { name: label })).toBeInTheDocument();
  });

  it("opens the Soundboard in a modal and can pop it out and back in", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    const popupDocument = document.implementation.createHTMLDocument("Soundboard");
    const focus = vi.fn();
    const close = vi.fn();
    const replaceState = vi.fn();
    const popup = {
      addEventListener: vi.fn(),
      closed: false,
      close,
      document: popupDocument,
      focus,
      history: { replaceState }
    } as unknown as Window;
    const open = vi.spyOn(window, "open").mockReturnValue(popup);
    renderApp();
    act(() => {
      store.dispatch(uploadImage({
        asset: {
          mediaType: "audio/mpeg",
          name: "Music bed",
          source: { dataUrl: "data:audio/mpeg;base64,AA==", kind: "embedded" }
        },
        parentId: "audio-root",
        sectionId: "audio"
      }));
      store.dispatch(setActiveTool("audio"));
    });

    const audioPanel = screen.getByLabelText("Audio panel");
    const panelLauncher = within(audioPanel).getByRole("button", { name: "Open Soundboard" });
    const toolbarLauncher = screen.getAllByRole("button", { name: "Open Soundboard" })
      .find((button) => button !== panelLauncher);

    fireEvent.click(panelLauncher);
    const soundboardModal = screen.getByRole("dialog", { name: "Soundboard modal" });
    expect(within(soundboardModal).getByText("Encounter")).toBeTruthy();
    expect(open).not.toHaveBeenCalled();
    fireEvent.click(within(soundboardModal).getByRole("button", { name: "Pop out Soundboard" }));
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith("", "combat-zone-soundboard", expect.stringContaining("toolbar=no"));
    expect(replaceState).toHaveBeenCalledWith(null, "", expect.stringContaining("view=soundboard"));
    const soundboardRoot = popupDocument.getElementById("soundboard-root") as HTMLElement;
    expect(soundboardRoot).not.toBeNull();
    expect(within(soundboardRoot).getByText("Encounter")).toBeTruthy();
    expect(within(soundboardRoot).getByText("Music")).toBeTruthy();
    expect(within(soundboardRoot).getByText("Zones")).toBeTruthy();
    expect(within(soundboardRoot).getByText("Actors")).toBeTruthy();
    expect(within(soundboardRoot).getByLabelText("Soundboard master volume")).toBeTruthy();
    const soundboardHeaderButtons = soundboardRoot.querySelectorAll("header button");
    expect(soundboardHeaderButtons.item(soundboardHeaderButtons.length - 1).getAttribute("aria-label")).toBe("Dock Soundboard");
    expect(popupDocument.documentElement.classList.contains("dark")).toBe(true);
    expect(popupDocument.documentElement.getAttribute("data-theme")).toBe("dark");
    localStorage.removeItem(THEME_STORAGE_KEY);
    expect(panelLauncher).toHaveAttribute("aria-pressed", "true");
    expect(toolbarLauncher).toHaveAttribute("aria-pressed", "true");

    expect(soundboardRoot.querySelector('[aria-label^="Add cue to"]')).toBeNull();
    const ambienceSubsection = [...soundboardRoot.querySelectorAll("h3")].find((heading) => heading.textContent === "Ambience")?.closest("section") as HTMLElement;
    const addAmbienceGroup = [...ambienceSubsection.querySelectorAll("button")].find((button) => button.textContent?.includes("Add new group")) as HTMLButtonElement;
    act(() => addAmbienceGroup.click());
    const ambienceGroupId = store.getState().encounter.present.audioCueGroups.allIds.find((id) => store.getState().encounter.present.audioCueGroups.byId[id].section === "ambiance") as string;
    act(() => (soundboardRoot.querySelector('[aria-label="Add cue to New Ambience Group"]') as HTMLButtonElement).click());
    expect(close).toHaveBeenCalledTimes(1);
    const soundboardBehindLibrary = screen.getByRole("dialog", { name: "Soundboard modal" });
    const libraryDialog = screen.getByRole("dialog", { name: "Asset Library" });
    expect(within(libraryDialog).getAllByRole("tab")).toHaveLength(1);
    expect(within(libraryDialog).getByRole("tab", { name: "Audio" })).toHaveAttribute("aria-selected", "true");
    fireEvent.doubleClick(within(libraryDialog).getByRole("button", { name: "Music bed" }));
    expect(Object.values(store.getState().encounter.present.audioCues.byId)).toEqual(expect.arrayContaining([
      expect.objectContaining({ placement: { type: "group", groupId: ambienceGroupId } })
    ]));
    expect(within(soundboardBehindLibrary).getByRole("radiogroup", { name: /Type for/ })).toBeInTheDocument();
    act(() => fireEvent.click(within(soundboardBehindLibrary).getByRole("radio", { name: "Effect" })));
    expect(within(soundboardBehindLibrary).getAllByRole("option", { name: "15m" })).toHaveLength(2);

    act(() => fireEvent.click(within(soundboardBehindLibrary).getByRole("button", { name: "Collapse Ambience subsection" })));
    expect(addAmbienceGroup).not.toBeNull();
    expect(within(soundboardBehindLibrary).queryByRole("button", { name: "Collapse New Ambience Group" })).not.toBeInTheDocument();
    act(() => fireEvent.click(within(soundboardBehindLibrary).getByRole("button", { name: "Expand Ambience subsection" })));
    expect(within(soundboardBehindLibrary).getByRole("button", { name: "Collapse New Ambience Group" })).toBeInTheDocument();

    act(() => fireEvent.click(within(soundboardBehindLibrary).getByRole("button", { name: "Collapse Encounter" })));
    expect(within(soundboardBehindLibrary).queryByRole("button", { name: "Add cue to New Ambience Group" })).not.toBeInTheDocument();
    act(() => fireEvent.click(within(soundboardBehindLibrary).getByRole("button", { name: "Expand Encounter" })));

    fireEvent.click(within(soundboardBehindLibrary).getByRole("button", { name: "Pop out Soundboard" }));
    expect(open).toHaveBeenCalledTimes(2);

    fireEvent.click(toolbarLauncher as HTMLButtonElement);
    expect(open).toHaveBeenCalledTimes(2);
    expect(focus).toHaveBeenCalledTimes(1);

    const reopenedSoundboardRoot = popupDocument.getElementById("soundboard-root") as HTMLElement;
    act(() => (reopenedSoundboardRoot.querySelector('[aria-label="Dock Soundboard"]') as HTMLButtonElement).click());
    expect(close).toHaveBeenCalledTimes(2);
    const dockedModal = screen.getByRole("dialog", { name: "Soundboard modal" });
    expect(dockedModal).toBeInTheDocument();
    fireEvent.mouseDown(dockedModal);
    expect(screen.queryByRole("dialog", { name: "Soundboard modal" })).not.toBeInTheDocument();
    expect(panelLauncher).toHaveAttribute("aria-pressed", "false");
  });
});
