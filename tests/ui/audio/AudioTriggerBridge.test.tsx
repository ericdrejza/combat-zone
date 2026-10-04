import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createActor, moveActor } from "@entities/actor/actorMutations";
import { createAudioCue, createAudioCueGroup, setEntityAudioGroups } from "@entities/audio/audioMutations";
import { createZone } from "@entities/zone/zoneMutations";
import { createLink, uploadImage } from "@library/librarySlice";
import { commitEncounterChange } from "@store/encounterSlice";
import { store } from "@store/store";
import { renderApp } from "@tests/ui/renderApp";

class FakeAudio extends EventTarget {
  static instances: FakeAudio[] = [];
  currentTime = 0;
  duration = 60;
  loop = false;
  volume = 1;
  pause = vi.fn();
  play = vi.fn(async () => undefined);
  constructor(readonly src: string) { super(); FakeAudio.instances.push(this); }
}

const polygon = [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }, { x: 0, y: 200 }];

function setup() {
  renderApp();
  const upload = (name: string) => uploadImage({ asset: { mediaType: "audio/mpeg", name, source: { kind: "embedded", dataUrl: "data:audio/mpeg;base64,AA==" } }, parentId: "audio-root", sectionId: "audio" });
  act(() => { store.dispatch(upload("Shared sound")); store.dispatch(upload("Other sound")); });
  const [assetId, otherId] = store.getState().library.sections.audio.nodesById["audio-root"].childIds!;
  const link = createLink({ name: "Linked sound", parentId: "audio-root", sectionId: "audio", targetId: assetId });
  act(() => store.dispatch(link));
  let encounter = createZone(store.getState().encounter.present, { id: "room", polygon });
  encounter = createZone(encounter, { id: "hall", polygon });
  encounter = createActor(encounter, { id: "guard", name: "Guard", currentZoneId: "room" });
  encounter = createAudioCueGroup(encounter, { id: "zone-group", section: "zone" });
  encounter = createAudioCueGroup(encounter, { id: "actor-group", section: "actor" });
  for (const id of ["room", "hall"]) encounter = setEntityAudioGroups(encounter, "zone", id, ["zone-group"]);
  encounter = setEntityAudioGroups(encounter, "actor", "guard", ["actor-group"]);
  for (const id of ["zone-cue", "zone-duplicate"]) encounter = createAudioCue(encounter, {
    id, libraryNodeId: assetId, placement: { type: "group", groupId: "zone-group" }, type: "effect", triggers: ["zone_enter", "zone_leave"], volume: 0.4
  });
  encounter = createAudioCue(encounter, { id: "actor-cue", libraryNodeId: link.payload.id, placement: { type: "group", groupId: "actor-group" }, type: "effect", triggers: ["actor_enter_zone", "actor_leave_zone"], volume: 0.8 });
  encounter = createAudioCue(encounter, { id: "other-cue", libraryNodeId: otherId, placement: { type: "group", groupId: "actor-group" }, type: "effect", triggers: ["actor_enter_zone"], volume: 0.3 });
  act(() => store.dispatch(commitEncounterChange({ action: { id: "setup", type: "test.setup", timestamp: 1, payload: {} }, nextEncounter: encounter })));
  return screen.getByLabelText("Audio panel");
}

describe("triggered Library asset deduplication", () => {
  beforeEach(() => { FakeAudio.instances = []; vi.stubGlobal("Audio", FakeAudio); });
  afterEach(() => vi.unstubAllGlobals());

  it("shares sound across same/different triggers and links while keeping every card synchronized", async () => {
    const panel = setup();
    const card = (id: string) => within(panel.querySelector(`[data-audio-cue-id="${id}"]`) as HTMLElement);
    const move = async (zoneId: string) => act(async () => store.dispatch(commitEncounterChange({ action: { id: `move-${zoneId}`, type: "actor.move", timestamp: 2, payload: {} }, nextEncounter: moveActor(store.getState().encounter.present, "guard", zoneId) })));
    await move("hall");
    const playing = FakeAudio.instances.filter((audio) => audio.play.mock.calls.length);
    expect(playing).toHaveLength(2);
    expect(playing.map((audio) => audio.volume)).toEqual([0.8, 0.3]);
    for (const id of ["zone-cue", "zone-duplicate"]) expect(card(id).getByRole("button", { name: "Stop Shared sound" })).toBeInTheDocument();
    expect(card("actor-cue").getByRole("button", { name: "Stop Linked sound" })).toBeInTheDocument();
    expect(card("other-cue").getByRole("button", { name: "Stop Other sound" })).toBeInTheDocument();
    fireEvent.click(card("zone-cue").getByRole("button", { name: "Stop Shared sound" }));
    expect(playing[0].pause).toHaveBeenCalledOnce();
    expect(playing[1].pause).not.toHaveBeenCalled();
    expect(card("zone-cue").getByRole("button", { name: "Play Shared sound" })).toBeInTheDocument();
    expect(card("zone-duplicate").getByRole("button", { name: "Play Shared sound" })).toBeInTheDocument();
    expect(card("actor-cue").getByRole("button", { name: "Play Linked sound" })).toBeInTheDocument();
    expect(card("other-cue").getByRole("button", { name: "Stop Other sound" })).toBeInTheDocument();
    await move("room");
    expect(FakeAudio.instances.filter((audio) => audio.play.mock.calls.length)).toHaveLength(4);
  });
});
