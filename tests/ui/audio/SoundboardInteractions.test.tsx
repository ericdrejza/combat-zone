import { act, createEvent, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAudioCue, createAudioCueGroup } from "@entities/audio/audioMutations";
import { uploadImage } from "@library/librarySlice";
import { commitEncounterChange, redoEncounterChange, undoEncounterChange } from "@store/encounterSlice";
import { store } from "@store/store";
import { renderApp } from "@tests/ui/renderApp";

class FakeAudio extends EventTarget {
  static instances: FakeAudio[] = [];
  currentTime = 0;
  duration = 120;
  loop = false;
  pause = vi.fn();
  play = vi.fn(async () => undefined);
  volume = 1;
  constructor(readonly src: string) {
    super();
    FakeAudio.instances.push(this);
  }
}

function openBoard(section: "music" | "ambiance" = "music") {
  renderApp();
  act(() => store.dispatch(uploadImage({ asset: { mediaType: "audio/mpeg", name: "Track", source: { dataUrl: "data:audio/mpeg;base64,AA==", kind: "embedded" } }, parentId: "audio-root", sectionId: "audio" })));
  const libraryNodeId = store.getState().library.sections.audio.nodesById["audio-root"].childIds![0];
  let encounter = createAudioCueGroup(store.getState().encounter.present, { id: "music", name: "Playlist", section });
  for (const id of ["first", "second"]) encounter = createAudioCue(encounter, { id, libraryNodeId, placement: { type: "group", groupId: "music" }, repeat: false, type: "track" });
  act(() => store.dispatch(commitEncounterChange({ action: { id: "setup", payload: {}, timestamp: 1, type: "test.setup" }, nextEncounter: encounter })));
  fireEvent.click(within(screen.getByLabelText("Audio panel")).getByRole("button", { name: "Open Soundboard" }));
  const board = screen.getByRole("dialog", { name: "Soundboard modal" });
  const first = board.querySelector('[data-audio-cue-id="first"]') as HTMLElement;
  return { board, first };
}

describe("Soundboard interactions", () => {
  beforeEach(() => {
    FakeAudio.instances = [];
    vi.stubGlobal("Audio", FakeAudio);
  });
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    { source: "third", target: "first", x: 120, side: "before", order: ["third", "first", "second"] },
    { source: "first", target: "second", x: 280, side: "after", order: ["second", "first", "third"] }
  ])("inserts a cue $side the target card with a vertical marker and undo/redo", ({ source, target, x, side, order }) => {
    const { board } = openBoard();
    act(() => {
      const encounter = store.getState().encounter.present;
      store.dispatch(commitEncounterChange({
        action: { id: "third-setup", payload: {}, timestamp: 2, type: "test.setup" },
        nextEncounter: createAudioCue(encounter, {
          id: "third", libraryNodeId: encounter.audioCues.byId.first.libraryNodeId,
          placement: { type: "group", groupId: "music" }, type: "track"
        })
      }));
    });
    const sourceCard = board.querySelector(`[data-audio-cue-id="${source}"]`)!;
    const targetCard = board.querySelector(`[data-audio-cue-id="${target}"]`)!;
    vi.spyOn(targetCard, "getBoundingClientRect").mockReturnValue({
      ...targetCard.getBoundingClientRect(), left: 100, width: 200, right: 300
    });
    fireEvent.dragStart(within(sourceCard as HTMLElement).getByRole("button", { name: "Reorder Track" }), { dataTransfer: { effectAllowed: "move" } });
    const over = createEvent.dragOver(targetCard);
    Object.defineProperty(over, "clientX", { value: x });
    fireEvent(targetCard, over);
    expect(within(targetCard as HTMLElement).getByRole("separator", { name: `Insert cue ${side} Track` })).toHaveAttribute("aria-orientation", "vertical");
    const drop = createEvent.drop(targetCard);
    Object.defineProperty(drop, "clientX", { value: x });
    fireEvent(targetCard, drop);
    expect(store.getState().encounter.present.audioCues.allIds).toEqual(order);
    expect(within(board).queryByTestId("cue-drop-preview")).not.toBeInTheDocument();
    act(() => store.dispatch(undoEncounterChange()));
    expect(store.getState().encounter.present.audioCues.allIds).toEqual(["first", "second", "third"]);
    act(() => store.dispatch(redoEncounterChange()));
    expect(store.getState().encounter.present.audioCues.allIds).toEqual(order);
  });

  it("keeps cue rows mounted when playback supplies a duration", async () => {
    const { board, first } = openBoard();
    await act(async () => fireEvent.click(within(first).getByRole("button", { name: "Play Track" })));
    expect(within(first).getByRole("button", { name: "Stop Track" })).toBeInTheDocument();
    expect(within(first).getByRole("slider", { name: "Playback progress for Track" })).toHaveAttribute("max", "120");
    expect(within(screen.getByLabelText("Audio panel")).getByRole("button", { name: "Stop Track" })).toBeInTheDocument();
    fireEvent.click(within(first).getByRole("button", { name: "Stop Track" }));
    expect(board).toBeInTheDocument();
    expect(within(first).getByRole("button", { name: "Play Track" })).toBeInTheDocument();
  });

  it("uses a single Play/Pause transport and lets cues be queued while paused", async () => {
    const { board, first } = openBoard();
    await act(async () => fireEvent.click(within(first).getByRole("button", { name: "Play Track" })));
    fireEvent.click(within(board).getByRole("button", { name: "Pause all audio" }));
    expect(within(board).queryByRole("button", { name: "Pause all audio" })).not.toBeInTheDocument();
    const second = board.querySelector('[data-audio-cue-id="second"]') as HTMLElement;
    expect(within(second).getByRole("button", { name: "Play Track" })).toBeEnabled();
    await act(async () => fireEvent.click(within(second).getByRole("button", { name: "Play Track" })));
    const queued = FakeAudio.instances.at(-1)!;
    expect(queued.play).not.toHaveBeenCalled();
    expect(within(second).getByText(/paused/)).toBeInTheDocument();
    await act(async () => fireEvent.click(within(board).getByRole("button", { name: "Resume paused audio" })));
    expect(queued.play).toHaveBeenCalledOnce();
    expect(within(board).getByRole("button", { name: "Pause all audio" })).toBeInTheDocument();
    expect(within(board).queryByRole("button", { name: "Resume paused audio" })).not.toBeInTheDocument();
  });

  it("applies repeat edits and their undo/redo to the currently playing Effect", async () => {
    const { first } = openBoard("ambiance");
    const panel = screen.getByLabelText("Audio panel");
    const panelCue = panel.querySelector('[data-audio-cue-id="first"]') as HTMLElement;
    expect(within(panelCue).queryByRole("img", { name: "Repeating Track" })).not.toBeInTheDocument();
    expect(within(panelCue).getByRole("button", { name: "Play Track" }).closest("header")).not.toBeNull();
    fireEvent.click(within(first).getByRole("radio", { name: "Effect" }));
    fireEvent.click(within(first).getByRole("button", { name: "Enable repeat" }));
    expect(within(panelCue).getByRole("img", { name: "Repeating Track" })).toHaveAttribute("title", "This sound repeats every 0s to 0s");
    await act(async () => fireEvent.click(within(first).getByRole("button", { name: "Play Track" })));
    const playing = FakeAudio.instances.at(-1)!;
    fireEvent.click(within(first).getByRole("button", { name: "Disable repeat" }));
    expect(within(panelCue).queryByRole("img", { name: "Repeating Track" })).not.toBeInTheDocument();
    expect(store.getState().encounter.present.audioCues.byId.first.repeat).toBe(false);
    expect(playing.pause).not.toHaveBeenCalled();
    act(() => store.dispatch(undoEncounterChange()));
    expect(store.getState().encounter.present.audioCues.byId.first.repeat).toBe(true);
    expect(within(panelCue).getByRole("img", { name: "Repeating Track" })).toHaveAttribute("title", "This sound repeats every 0s to 0s");
    act(() => store.dispatch(redoEncounterChange()));
    expect(store.getState().encounter.present.audioCues.byId.first.repeat).toBe(false);
    act(() => playing.dispatchEvent(new Event("ended")));
    expect(within(first).getByRole("button", { name: "Play Track" })).toBeInTheDocument();
    expect(within(first).queryByText(/waiting/)).not.toBeInTheDocument();
  });

  it("mutes a cue with undo/redo and closes its volume popover on outside click or blur", () => {
    const { board, first } = openBoard();
    fireEvent.click(within(first).getByRole("button", { name: /Volume for Track/ }));
    const slider = within(first).getByRole("slider", { name: "Set volume for Track" });
    fireEvent.focus(slider);
    fireEvent.change(slider, { target: { value: "0" } });
    fireEvent.pointerUp(slider);
    expect(store.getState().encounter.present.audioCues.byId.first.volume).toBe(0);
    expect(within(first).getByRole("button", { name: "Volume for Track: 0%" })).toBeInTheDocument();
    fireEvent.pointerDown(within(board).getByText("Soundboard"));
    expect(within(first).queryByRole("slider", { name: "Set volume for Track" })).not.toBeInTheDocument();
    act(() => store.dispatch(undoEncounterChange()));
    expect(store.getState().encounter.present.audioCues.byId.first.volume).toBe(0.5);
    act(() => store.dispatch(redoEncounterChange()));
    expect(store.getState().encounter.present.audioCues.byId.first.volume).toBe(0);
    fireEvent.click(within(first).getByRole("button", { name: /Volume for Track/ }));
    fireEvent.blur(within(first).getByRole("slider", { name: "Set volume for Track" }));
    expect(within(first).queryByRole("slider", { name: "Set volume for Track" })).not.toBeInTheDocument();
  });

  it("shows the volume percentage while hovering, then hides it on leave or slider open", () => {
    const { first } = openBoard();
    fireEvent.click(screen.getByRole("button", { name: "Show audio cue volumes" }));
    const panelCue = screen.getByLabelText("Audio panel").querySelector('[data-audio-cue-id="first"]') as HTMLElement;
    for (const card of [first, panelCue]) {
      const volume = within(card).getByRole("button", { name: "Volume for Track: 50%" });
      fireEvent.mouseEnter(volume);
      expect(within(card).getByRole("tooltip")).toHaveTextContent("50%");
      expect(volume).toHaveAccessibleDescription("50%");
      fireEvent.mouseLeave(volume);
      expect(within(card).queryByRole("tooltip")).not.toBeInTheDocument();
      fireEvent.mouseEnter(volume);
      fireEvent.click(volume);
      expect(within(card).getByRole("slider", { name: "Set volume for Track" })).toBeInTheDocument();
      expect(within(card).queryByRole("tooltip")).not.toBeInTheDocument();
      fireEvent.mouseEnter(volume);
      expect(within(card).queryByRole("tooltip")).not.toBeInTheDocument();
      fireEvent.mouseLeave(volume);
      fireEvent.click(volume);
    }
  });

  it("selects group names, omits Soundboard track indices, and records playlist repeat in history", () => {
    const { board } = openBoard();
    expect(within(board).getByRole("button", { name: "Music playback information" })).toHaveAttribute("title", "Only one track can play across the entire Music section. Starting another track stops the current track, including tracks in other groups.");
    const name = within(board).getByRole("textbox", { name: "Name for Playlist" }) as HTMLInputElement;
    fireEvent.focus(name);
    expect(name.selectionStart).toBe(0);
    expect(name.selectionEnd).toBe(name.value.length);
    expect(within(board).queryByLabelText("Track 1")).not.toBeInTheDocument();
    expect(within(board).queryByLabelText("Track 2")).not.toBeInTheDocument();
    fireEvent.click(within(board).getByRole("button", { name: "Enable repeat for Playlist" }));
    expect(store.getState().encounter.present.audioCueGroups.byId.music.repeat).toBe(true);
    act(() => store.dispatch(undoEncounterChange()));
    expect(store.getState().encounter.present.audioCueGroups.byId.music.repeat).toBe(false);
    act(() => store.dispatch(redoEncounterChange()));
    expect(store.getState().encounter.present.audioCueGroups.byId.music.repeat).toBe(true);
  });

  it("opens the locked Audio Library in the same overlay container as the Soundboard", () => {
    const { board } = openBoard();
    fireEvent.click(within(board).getByRole("button", { name: "Add cue to Playlist" }));
    const library = screen.getByRole("dialog", { name: "Asset Library" });
    expect(board.parentElement).toBe(library.parentElement);
    expect(within(library).getAllByRole("tab")).toHaveLength(1);
    expect(within(library).getByRole("tab", { name: "Audio" })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(within(library).getByRole("button", { name: "Close Asset Library" }));
    expect(board).toBeInTheDocument();
  });

  it("keeps the popped-out Soundboard open while choosing a cue in the main Library", () => {
    const { board } = openBoard();
    const frame = document.createElement("iframe");
    document.body.append(frame);
    const popupDocument = frame.contentDocument!;
    const popup = { document: popupDocument, closed: false, close: vi.fn(), focus: vi.fn(), addEventListener: vi.fn(), history: { replaceState: vi.fn() } };
    const open = vi.spyOn(window, "open").mockReturnValueOnce(popup as unknown as Window);
    fireEvent.click(within(board).getByRole("button", { name: "Pop out Soundboard" }));
    expect(screen.queryByRole("dialog", { name: "Soundboard modal" })).not.toBeInTheDocument();
    const popupRoot = popupDocument.getElementById("soundboard-root")!;
    fireEvent.click(within(popupRoot).getByRole("button", { name: "Add cue to Playlist" }));
    const library = screen.getByRole("dialog", { name: "Asset Library" });
    expect(within(library).getAllByRole("tab")).toHaveLength(1);
    expect(within(library).getByRole("tab", { name: "Audio" })).toHaveAttribute("aria-selected", "true");
    expect(popup.close).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "Soundboard modal" })).not.toBeInTheDocument();
    expect(within(popupRoot).getByRole("button", { name: "Dock Soundboard" })).toBeInTheDocument();
    fireEvent.click(within(library).getByRole("button", { name: "Track" }));
    fireEvent.click(within(library).getByRole("button", { name: "Add Cue" }));
    expect(store.getState().encounter.present.audioCues.allIds).toHaveLength(3);
    expect(popupRoot.querySelectorAll('[data-audio-cue-id]')).toHaveLength(3);
    expect(popup.close).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "Soundboard modal" })).not.toBeInTheDocument();
    open.mockRestore();
    frame.remove();
  });
});
