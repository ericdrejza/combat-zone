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
  volume = 1;
  pause = vi.fn();
  play = vi.fn(async () => undefined);
  constructor(readonly src: string) { super(); FakeAudio.instances.push(this); }
}

function setup() {
  renderApp();
  act(() => store.dispatch(uploadImage({ asset: { mediaType: "audio/mpeg", name: "Track", source: { dataUrl: "data:audio/mpeg;base64,AA==", kind: "embedded" } }, parentId: "audio-root", sectionId: "audio" })));
  const libraryNodeId = store.getState().library.sections.audio.nodesById["audio-root"].childIds![0];
  let encounter = store.getState().encounter.present;
  for (const id of ["a", "b", "c"]) {
    encounter = createAudioCueGroup(encounter, { id, name: id.toUpperCase(), section: "music" });
    encounter = createAudioCue(encounter, { id: `${id}-cue`, libraryNodeId, placement: { type: "group", groupId: id }, type: "loop", repeat: true });
  }
  encounter = createAudioCueGroup(encounter, { id: "ambient", name: "Rain", section: "ambiance" });
  encounter = createAudioCue(encounter, { id: "rain", libraryNodeId, placement: { type: "group", groupId: "ambient" }, type: "loop" });
  for (const section of ["zone", "actor"] as const) {
    encounter = createAudioCueGroup(encounter, { id: section, name: section, section });
    encounter = createAudioCue(encounter, { id: `${section}-cue`, libraryNodeId, placement: { type: "group", groupId: section }, type: "one_shot", repeat: true });
  }
  act(() => store.dispatch(commitEncounterChange({ action: { id: "setup", type: "test.setup", payload: {}, timestamp: 1 }, nextEncounter: encounter })));
  const panel = screen.getByLabelText("Audio panel");
  fireEvent.click(within(panel).getByRole("button", { name: "Open Soundboard" }));
  return { panel, board: screen.getByRole("dialog", { name: "Soundboard modal" }) };
}

describe("Audio group and section controls", () => {
  beforeEach(() => { FakeAudio.instances = []; vi.stubGlobal("Audio", FakeAudio); });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it.each([
    { source: "c", target: "a", y: 120, side: "before", order: ["c", "a", "b"] },
    { source: "a", target: "b", y: 280, side: "after", order: ["b", "a", "c"] }
  ])("moves a group $side the target, including a drop over its cue, with undo/redo", ({ source, target, y, side, order }) => {
    const { board } = setup();
    Object.defineProperty(within(board).getByRole("heading", { name: "Soundboard" }).closest("header")!.parentElement, "scrollBy", { configurable: true, value: vi.fn() });
    const targetGroup = board.querySelector(`[data-audio-group-id="${target}"]`) as HTMLElement;
    const targetCue = targetGroup.querySelector("[data-audio-cue-id]")!;
    vi.spyOn(targetGroup, "getBoundingClientRect").mockReturnValue({ ...targetGroup.getBoundingClientRect(), top: 100, height: 200, bottom: 300 });
    fireEvent.dragStart(within(board).getByRole("button", { name: `Reorder ${source.toUpperCase()}` }), { dataTransfer: { effectAllowed: "move" } });
    for (const type of ["dragOver", "drop"] as const) {
      const event = createEvent[type](targetCue);
      Object.defineProperty(event, "clientY", { value: y });
      fireEvent(targetCue, event);
      if (type === "dragOver") expect(within(targetGroup).getByRole("separator", { name: `Insert group ${side} ${target.toUpperCase()}` })).toHaveAttribute("aria-orientation", "horizontal");
    }
    expect(store.getState().encounter.present.musicGroupIds).toEqual(order);
    act(() => store.dispatch(undoEncounterChange()));
    expect(store.getState().encounter.present.musicGroupIds).toEqual(["a", "b", "c"]);
    act(() => store.dispatch(redoEncounterChange()));
    expect(store.getState().encounter.present.musicGroupIds).toEqual(order);
  });

  it("shows collapsed-group counts, panel section disclosures, inline Loop repeat, and movement boundaries", () => {
    const { panel, board } = setup();
    fireEvent.click(within(board).getByRole("button", { name: "Collapse A" }));
    expect(within(board).getByLabelText("1 cues in A")).toHaveTextContent("1");
    fireEvent.click(within(board).getByRole("button", { name: "Expand A" }));
    expect(within(board).queryByLabelText("1 cues in A")).not.toBeInTheDocument();
    expect(within(panel).queryByLabelText("Track 1")).not.toBeInTheDocument();
    const cue = panel.querySelector('[data-audio-cue-id="a-cue"]') as HTMLElement;
    expect(within(cue).getByRole("img", { name: "Repeating Track" }).parentElement).toHaveTextContent("Loop");
    expect(within(panel).getByRole("button", { name: "Move A up" })).toBeDisabled();
    expect(within(panel).getByRole("button", { name: "Move C down" })).toBeDisabled();
    fireEvent.click(within(panel).getByRole("button", { name: "Move A down" }));
    expect(store.getState().encounter.present.musicGroupIds).toEqual(["b", "a", "c"]);
    act(() => store.dispatch(undoEncounterChange()));
    expect(store.getState().encounter.present.musicGroupIds).toEqual(["a", "b", "c"]);
    act(() => store.dispatch(redoEncounterChange()));
    expect(store.getState().encounter.present.musicGroupIds).toEqual(["b", "a", "c"]);
    for (const label of ["Music subsection", "Encounter", "Zones", "Actors"]) {
      fireEvent.click(within(panel).getByRole("button", { name: `Collapse ${label}` }));
      expect(within(panel).getByRole("button", { name: `Expand ${label}` })).toHaveAttribute("aria-expanded", "false");
      fireEvent.click(within(panel).getByRole("button", { name: `Expand ${label}` }));
    }
  });

  it("shares navigation/global transport between headers and keeps Music pause independent of Ambience", async () => {
    const { panel, board } = setup();
    const play = async (id: string) => { await act(async () => fireEvent.click(within(panel.querySelector(`[data-audio-cue-id="${id}"]`) as HTMLElement).getByRole("button", { name: "Play Track" }))); };
    await play("rain");
    await play("a-cue");
    fireEvent.click(within(board).getByRole("button", { name: "Pause music" }));
    expect(within(panel.querySelector('[data-audio-cue-id="a-cue"]') as HTMLElement).getByText(/paused/)).toBeInTheDocument();
    expect(within(panel.querySelector('[data-audio-cue-id="rain"]') as HTMLElement).queryByText(/paused/)).not.toBeInTheDocument();
    await act(async () => fireEvent.click(within(panel).getByRole("button", { name: "Resume music" })));
    const active = FakeAudio.instances.at(-1)!;
    active.currentTime = 5;
    await act(async () => fireEvent.click(within(board).getByRole("button", { name: "Previous music track" })));
    expect(active.currentTime).toBe(0);
    await act(async () => fireEvent.click(within(panel).getByRole("button", { name: "Next music track" })));
    expect(within(panel.querySelector('[data-audio-cue-id="a-cue"]') as HTMLElement).getByRole("button", { name: "Play Track" })).toBeInTheDocument();
    await play("b-cue");
    fireEvent.click(within(panel).getByRole("button", { name: "Pause all audio" }));
    expect(within(board).getByRole("button", { name: "Resume paused audio" })).toBeInTheDocument();
    fireEvent.click(within(board).getByRole("button", { name: "Stop all audio" }));
    expect(within(panel).getByRole("button", { name: "Next music track" })).toBeDisabled();
  });

  it("pauses each Soundboard section independently, including waits and queued cues", async () => {
    const { panel, board } = setup();
    const card = (id: string) => within(panel.querySelector(`[data-audio-cue-id="${id}"]`) as HTMLElement);
    for (const id of ["rain", "a-cue", "zone-cue", "actor-cue"]) {
      await act(async () => fireEvent.click(card(id).getByRole("button", { name: "Play Track" })));
    }
    const zoneAudio = FakeAudio.instances.at(-2)!;
    const actorAudio = FakeAudio.instances.at(-1)!;
    act(() => zoneAudio.dispatchEvent(new Event("ended")));
    expect(card("zone-cue").getByText(/waiting/)).toBeInTheDocument();
    fireEvent.click(within(board).getByRole("button", { name: "Pause zones" }));
    expect(card("zone-cue").getByText(/paused/)).toBeInTheDocument();
    expect(actorAudio.pause).not.toHaveBeenCalled();
    fireEvent.click(within(board).getByRole("button", { name: "Pause actors" }));
    expect(actorAudio.pause).toHaveBeenCalledOnce();
    fireEvent.click(within(board).getByRole("button", { name: "Pause ambience" }));
    expect(card("rain").getByText(/paused/)).toBeInTheDocument();
    expect(card("a-cue").queryByText(/paused/)).not.toBeInTheDocument();
    await act(async () => fireEvent.click(within(board).getByRole("button", { name: "Resume ambience" })));
    fireEvent.click(within(board).getByRole("button", { name: "Pause encounter" }));
    expect(card("a-cue").getByText(/paused/)).toBeInTheDocument();
    await act(async () => fireEvent.click(card("b-cue").getByRole("button", { name: "Play Track" })));
    const queued = FakeAudio.instances.at(-1)!;
    expect(queued.play).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(within(board).getByRole("button", { name: "Resume encounter" })));
    expect(queued.play).toHaveBeenCalledOnce();
    expect(card("rain").queryByText(/paused/)).not.toBeInTheDocument();
    expect(card("zone-cue").getByText(/paused/)).toBeInTheDocument();
    expect(card("actor-cue").getByText(/paused/)).toBeInTheDocument();
    fireEvent.click(within(board).getByRole("button", { name: "Resume zones" }));
    expect(card("zone-cue").getByText(/waiting/)).toBeInTheDocument();
    await act(async () => fireEvent.click(within(board).getByRole("button", { name: "Resume actors" })));
    expect(actorAudio.play).toHaveBeenCalledTimes(2);
    fireEvent.click(within(board).getByRole("button", { name: "Stop all audio" }));
  });

  it("shows Effect duration beside its type, once, in both card presentations", () => {
    const { panel, board } = setup();
    act(() => FakeAudio.instances.forEach((audio) => audio.dispatchEvent(new Event("loadedmetadata"))));
    for (const container of [panel, board]) {
      const cue = container.querySelector('[data-audio-cue-id="zone-cue"]') as HTMLElement;
      expect(within(cue).getByText("Effect · 2:00")).toBeInTheDocument();
      expect(cue.textContent?.match(/2:00/g)).toHaveLength(1);
    }
  });

  it.each([
    { id: "zone-cue", enter: "Entering zone", leave: "Leaving zone" },
    { id: "actor-cue", enter: "Actor enters zone", leave: "Actor leaves zone" }
  ])("shows only enabled movement trigger indicators for $id and restores them with undo/redo", ({ id, enter, leave }) => {
    const { panel, board } = setup();
    const boardCard = board.querySelector(`[data-audio-cue-id="${id}"]`) as HTMLElement;
    const panelCard = panel.querySelector(`[data-audio-cue-id="${id}"]`) as HTMLElement;
    const expectIndicators = (entering: boolean, leaving: boolean) => {
      for (const card of [boardCard, panelCard]) {
        expect(!!within(card).queryByRole("img", { name: enter })).toBe(entering);
        expect(!!within(card).queryByRole("img", { name: leave })).toBe(leaving);
      }
    };
    expectIndicators(false, false);
    fireEvent.click(within(boardCard).getByRole("checkbox", { name: enter }));
    expectIndicators(true, false);
    const indicator = within(panelCard).getByRole("img", { name: enter });
    expect(indicator.closest("p")).toHaveTextContent("Effect · 0:00");
    expect(indicator).toHaveAttribute("title", enter);
    fireEvent.click(within(boardCard).getByRole("checkbox", { name: leave }));
    expectIndicators(true, true);
    act(() => store.dispatch(undoEncounterChange()));
    expectIndicators(true, false);
    act(() => store.dispatch(redoEncounterChange()));
    expectIndicators(true, true);
    fireEvent.click(within(boardCard).getByRole("checkbox", { name: enter }));
    expectIndicators(false, true);
  });
});
