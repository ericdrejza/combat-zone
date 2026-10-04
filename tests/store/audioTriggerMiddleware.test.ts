import { configureStore } from "@reduxjs/toolkit";
import { afterEach, describe, expect, it } from "vitest";

import { createEncounterState } from "@core/encounter/createEncounterState";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { createActor, moveActor } from "@entities/actor/actorMutations";
import { createAudioCue, createAudioCueGroup, setEntityAudioGroups, updateAudioCue } from "@entities/audio/audioMutations";
import { createZone } from "@entities/zone/zoneMutations";
import interactionReducer from "@interaction/interactionState";
import { audioTriggerMiddleware } from "@store/audioTriggerMiddleware";
import encounterReducer, { commitEncounterChange, loadEncounterState, undoEncounterChange } from "@store/encounterSlice";
import { AUDIO_TRIGGER_EVENT, type AudioTriggerRequest } from "@ui/audio/audioTriggerEvents";

const polygon = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];

function automaticEncounter() {
  let encounter = createEncounterState({ id: "audio-triggers", name: "Audio triggers" });
  encounter = createZone(encounter, { id: "room", polygon });
  encounter = createZone(encounter, { id: "hall", polygon });
  encounter = createActor(encounter, { currentZoneId: "room", id: "actor-a" });
  encounter = createAudioCueGroup(encounter, { id: "zone-sounds", section: "zone" });
  encounter = createAudioCueGroup(encounter, { id: "actor-sounds", section: "actor" });
  encounter = setEntityAudioGroups(encounter, "zone", "room", ["zone-sounds"]);
  encounter = setEntityAudioGroups(encounter, "zone", "hall", ["zone-sounds"]);
  encounter = setEntityAudioGroups(encounter, "actor", "actor-a", ["actor-sounds"]);
  encounter = createAudioCue(encounter, { id: "zone-leave", libraryNodeId: "a", placement: { type: "group", groupId: "zone-sounds" }, triggers: ["zone_leave"], type: "effect" });
  encounter = createAudioCue(encounter, { id: "actor-leave", libraryNodeId: "b", placement: { type: "group", groupId: "actor-sounds" }, triggers: ["actor_leave_zone"], type: "effect" });
  encounter = createAudioCue(encounter, { id: "zone-enter", libraryNodeId: "c", placement: { type: "group", groupId: "zone-sounds" }, triggers: ["zone_enter"], type: "effect" });
  return createAudioCue(encounter, { id: "actor-enter", libraryNodeId: "d", placement: { type: "group", groupId: "actor-sounds" }, triggers: ["actor_enter_zone"], type: "effect" });
}

function makeStore() {
  return configureStore({ reducer: { encounter: encounterReducer, interaction: interactionReducer }, middleware: (defaults) => defaults().concat(audioTriggerMiddleware) });
}

describe("audio trigger middleware", () => {
  const events: AudioTriggerRequest[][] = [];
  const listener = (event: Event) => events.push((event as CustomEvent<AudioTriggerRequest[]>).detail);
  afterEach(() => { window.removeEventListener(AUDIO_TRIGGER_EVENT, listener); events.length = 0; });

  it("ignores retained trigger settings in repeat or disabled mode and restores them when Flag is enabled", () => {
    window.addEventListener(AUDIO_TRIGGER_EVENT, listener);
    const store = makeStore();
    let encounter = automaticEncounter();
    encounter = updateAudioCue(encounter, "zone-enter", { repeat: true });
    encounter = updateAudioCue(encounter, "actor-enter", { triggersEnabled: false });
    store.dispatch(loadEncounterState(encounter));
    const commit = (nextEncounter: typeof encounter) => store.dispatch(commitEncounterChange({ action: createEncounterActionRecord("test.change", {}), nextEncounter }));
    commit(moveActor(encounter, "actor-a", "hall"));
    expect(events.flat().map((item) => item.cueId)).toEqual(["zone-leave", "actor-leave"]);
    expect(store.getState().encounter.present.audioCues.byId["zone-enter"].triggers).toEqual(["zone_enter"]);
    events.length = 0;
    encounter = updateAudioCue(store.getState().encounter.present, "zone-enter", { triggersEnabled: true });
    encounter = updateAudioCue(encounter, "actor-enter", { triggersEnabled: true });
    commit(encounter);
    expect(events).toEqual([]);
    commit(moveActor(encounter, "actor-a", "room"));
    expect(events.flat().map((item) => item.cueId)).toEqual(["zone-leave", "actor-leave", "zone-enter", "actor-enter"]);
  });

  it("orders leaving triggers before entering triggers and remains silent for undo", () => {
    window.addEventListener(AUDIO_TRIGGER_EVENT, listener);
    const store = makeStore();
    const encounter = automaticEncounter();
    store.dispatch(loadEncounterState(encounter));
    store.dispatch(commitEncounterChange({ action: createEncounterActionRecord("actor.move", { actorId: "actor-a" }), nextEncounter: moveActor(encounter, "actor-a", "hall") }));
    expect(events.flat().map((item) => item.cueId)).toEqual(["zone-leave", "actor-leave", "zone-enter", "actor-enter"]);
    expect(new Set(events.flat().map((item) => item.instanceId)).size).toBe(4);
    events.length = 0;
    store.dispatch(undoEncounterChange());
    expect(events).toEqual([]);
  });
});
