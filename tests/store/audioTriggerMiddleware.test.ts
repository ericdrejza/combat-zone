import { configureStore } from "@reduxjs/toolkit";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createEncounterState } from "@core/encounter/createEncounterState";
import { placeSpatialActors } from "@core/movement/movementStrategies";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { updateActorStatus } from "@entities/actor/actorStatus";
import { DEFAULT_COMBAT_RULES } from "@entities/actor/actorResources";
import { adjustHitPoints, setHitPoints, updateSelectedActors } from "@entities/actor/statusMutations";
import { createActor, moveActor } from "@entities/actor/actorMutations";
import { createAudioCue, createAudioCueGroup, setEntityAudioGroups, setAudioCueGroupShuffle, updateAudioCue } from "@entities/audio/audioMutations";
import { createZone } from "@entities/zone/zoneMutations";
import interactionReducer from "@interaction/interactionState";
import { audioTriggerMiddleware } from "@store/audioTriggerMiddleware";
import encounterReducer, { commitEncounterChange, loadEncounterState, undoEncounterChange, redoEncounterChange } from "@store/encounterSlice";
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
  encounter = createAudioCue(encounter, { id: "actor-leave", libraryNodeId: "b", placement: { type: "group", groupId: "actor-sounds" }, triggers: ["actor_changes_zone"], type: "effect" });
  encounter = createAudioCue(encounter, { id: "zone-enter", libraryNodeId: "c", placement: { type: "group", groupId: "zone-sounds" }, triggers: ["zone_enter"], type: "effect" });
  return createAudioCue(encounter, { id: "actor-enter", libraryNodeId: "d", placement: { type: "group", groupId: "actor-sounds" }, triggers: ["actor_changes_zone"], type: "effect" });
}

function makeStore() {
  return configureStore({ reducer: { encounter: encounterReducer, interaction: interactionReducer }, middleware: (defaults) => defaults().concat(audioTriggerMiddleware) });
}

describe("audio trigger middleware", () => {
  const events: AudioTriggerRequest[][] = [];
  const listener = (event: Event) => events.push((event as CustomEvent<AudioTriggerRequest[]>).detail);
  afterEach(() => { window.removeEventListener(AUDIO_TRIGGER_EVENT, listener); events.length = 0; });

  it("plays Moves for deliberate spatial changes within a zone and keeps replay and no-ops silent", () => {
    window.addEventListener(AUDIO_TRIGGER_EVENT, listener);
    const store = makeStore();
    let encounter = automaticEncounter();
    encounter = { ...encounter, movementRules: { ...encounter.movementRules, zoneLocked: false, snapToGrid: false } };
    encounter = placeSpatialActors(encounter, { "actor-a": { x: 40, y: 40 } });
    store.dispatch(loadEncounterState(encounter));
    const moved = placeSpatialActors(encounter, { "actor-a": { x: 50, y: 45 } });
    store.dispatch(commitEncounterChange({ action: createEncounterActionRecord("actor.moveSpatial", { actorIds: ["actor-a"] }), nextEncounter: moved }));
    expect(events.flat().map(({ cueId }) => cueId)).toEqual(["actor-leave", "actor-enter"]);
    events.length = 0;
    store.dispatch(undoEncounterChange());
    expect(store.getState().encounter.present.actors.byId["actor-a"].spatialPosition).toEqual({ x: 40, y: 40 });
    store.dispatch(redoEncounterChange());
    expect(store.getState().encounter.present.actors.byId["actor-a"].spatialPosition).toEqual({ x: 50, y: 45 });
    store.dispatch(commitEncounterChange({ action: createEncounterActionRecord("actor.moveSpatial", {}), nextEncounter: { ...moved } }));
    expect(events).toEqual([]);
  });

  it.each(["grid.update", "movement.updateRules", "zone.move"])("keeps Moves silent for automatic changes from %s", (type) => {
    window.addEventListener(AUDIO_TRIGGER_EVENT, listener);
    const store = makeStore();
    let encounter = automaticEncounter();
    encounter = { ...encounter, movementRules: { ...encounter.movementRules, zoneLocked: false, snapToGrid: false } };
    encounter = placeSpatialActors(encounter, { "actor-a": { x: 40, y: 40 } });
    store.dispatch(loadEncounterState(encounter));
    const moved = moveActor(placeSpatialActors(encounter, { "actor-a": { x: 50, y: 45 } }), "actor-a", "hall");
    store.dispatch(commitEncounterChange({ action: createEncounterActionRecord(type, {}), nextEncounter: moved }));
    expect(events.flat().filter(({ cueId }) => cueId.startsWith("actor-"))).toEqual([]);
  });

  it("plays each actor's Moves cues once when a deliberate spatial move also crosses a zone", () => {
    window.addEventListener(AUDIO_TRIGGER_EVENT, listener);
    const store = makeStore();
    let encounter = automaticEncounter();
    encounter = { ...encounter, movementRules: { ...encounter.movementRules, zoneLocked: false, snapToGrid: false } };
    encounter = placeSpatialActors(encounter, { "actor-a": { x: 40, y: 40 } });
    store.dispatch(loadEncounterState(encounter));
    const moved = moveActor(placeSpatialActors(encounter, { "actor-a": { x: 50, y: 45 } }), "actor-a", "hall");
    store.dispatch(commitEncounterChange({ action: createEncounterActionRecord("actor.moveSpatial", {}), nextEncounter: moved }));
    expect(events.flat().map(({ cueId }) => cueId)).toEqual(["zone-leave", "zone-enter", "actor-leave", "actor-enter"]);
  });

  it("samples overlapping trigger pools independently, including the same cue for both", () => {
    window.addEventListener(AUDIO_TRIGGER_EVENT, listener);
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    try {
      const store = makeStore();
      let encounter = automaticEncounter();
      encounter = setAudioCueGroupShuffle(encounter, "actor-sounds", true);
      for (const id of ["shared", "other"]) encounter = createAudioCue(encounter, {
        id, libraryNodeId: id, placement: { type: "group", groupId: "actor-sounds" },
        triggers: ["actor_takes_damage", "actor_health_injured"], type: "effect"
      });
      const rules = { ...DEFAULT_COMBAT_RULES, automaticHealth: true, thresholds: [0, 2, 5] as [number, number, number] };
      encounter = updateSelectedActors(encounter, ["actor-a"], (actor) => setHitPoints(actor, { current: 10, maximum: 10 }, rules));
      store.dispatch(loadEncounterState(encounter));
      const action = createEncounterActionRecord("actor.adjustHitPoints", { actorIds: ["actor-a"], amount: -5 });
      random.mockClear();
      const damage = () => store.dispatch(commitEncounterChange({ action, nextEncounter: adjustHitPoints(encounter, ["actor-a"], -5, rules) }));
      damage();
      expect(events.flat().map(({ cueId }) => cueId)).toEqual(["shared", "shared"]);
      expect(random).toHaveBeenCalledTimes(2);
      store.dispatch(undoEncounterChange());
      events.length = 0;
      random.mockReturnValueOnce(0).mockReturnValueOnce(0.99);
      damage();
      expect(events.flat().map(({ cueId }) => cueId)).toEqual(["shared", "other"]);
    } finally { random.mockRestore(); }
  });

  it("ignores retained trigger settings in repeat or disabled mode and restores them when Flag is enabled", () => {
    window.addEventListener(AUDIO_TRIGGER_EVENT, listener);
    const store = makeStore();
    let encounter = automaticEncounter();
    encounter = updateAudioCue(encounter, "zone-enter", { repeat: true });
    encounter = updateAudioCue(encounter, "actor-enter", { triggersEnabled: false });
    store.dispatch(loadEncounterState(encounter));
    const commit = (nextEncounter: typeof encounter) => store.dispatch(commitEncounterChange({ action: createEncounterActionRecord("actor.move", {}), nextEncounter }));
    commit(moveActor(encounter, "actor-a", "hall"));
    expect(events.flat().map((item) => item.cueId)).toEqual(["zone-leave", "actor-leave"]);
    expect(store.getState().encounter.present.audioCues.byId["zone-enter"].triggers).toEqual(["zone_enter"]);
    events.length = 0;
    encounter = updateAudioCue(store.getState().encounter.present, "zone-enter", { triggersEnabled: true });
    encounter = updateAudioCue(encounter, "actor-enter", { triggersEnabled: true });
    commit(encounter);
    expect(events).toEqual([]);
    commit(moveActor(encounter, "actor-a", "room"));
    expect(events.flat().map((item) => item.cueId)).toEqual(["zone-leave", "zone-enter", "actor-leave", "actor-enter"]);
  });

  it("orders leaving triggers before entering triggers and remains silent for undo", () => {
    window.addEventListener(AUDIO_TRIGGER_EVENT, listener);
    const store = makeStore();
    const encounter = automaticEncounter();
    store.dispatch(loadEncounterState(encounter));
    store.dispatch(commitEncounterChange({ action: createEncounterActionRecord("actor.move", { actorId: "actor-a" }), nextEncounter: moveActor(encounter, "actor-a", "hall") }));
    expect(events.flat().map((item) => item.cueId)).toEqual(["zone-leave", "zone-enter", "actor-leave", "actor-enter"]);
    expect(new Set(events.flat().map((item) => item.instanceId)).size).toBe(4);
    events.length = 0;
    store.dispatch(undoEncounterChange());
    expect(events).toEqual([]);
  });
  it("plays damage only for applied damage, while health transitions also work for direct edits", () => {
    window.addEventListener(AUDIO_TRIGGER_EVENT, listener);
    const store = makeStore();
    let encounter = automaticEncounter();
    for (const trigger of ["actor_takes_damage", "actor_health_dead", "actor_health_unconscious", "actor_health_injured", "actor_health_healthy"] as const) {
      encounter = createAudioCue(encounter, { id: trigger, libraryNodeId: trigger, placement: { type: "group", groupId: "actor-sounds" }, triggers: [trigger], type: "effect" });
    }
    const rules = { ...DEFAULT_COMBAT_RULES, automaticHealth: true, thresholds: [0, 2, 5] as [number, number, number] };
    encounter = updateSelectedActors(encounter, ["actor-a"], (actor) => setHitPoints(actor, { current: 10, maximum: 10 }, rules));
    store.dispatch(loadEncounterState(encounter));
    const commit = (type: string, nextEncounter: typeof encounter, amount = 0) => {
      store.dispatch(commitEncounterChange({ action: createEncounterActionRecord(type, { actorIds: ["actor-a"], amount }), nextEncounter }));
      encounter = store.getState().encounter.present;
    };
    commit("actor.adjustHitPoints", adjustHitPoints(encounter, ["actor-a"], -5, rules), -5);
    expect(events.flat().map(({ cueId }) => cueId)).toEqual(["actor_takes_damage", "actor_health_injured"]);
    events.length = 0;
    store.dispatch(undoEncounterChange());
    expect(store.getState().encounter.present.actors.byId["actor-a"].hitPoints?.current).toBe(10);
    store.dispatch(redoEncounterChange());
    expect(store.getState().encounter.present.actors.byId["actor-a"].status).toBe(2);
    expect(events).toEqual([]);
    commit("actor.setHitPoints", updateSelectedActors(encounter, ["actor-a"], (actor) => setHitPoints(actor, { current: 2, maximum: 10 }, rules)));
    expect(events.flat().map(({ cueId }) => cueId)).toEqual(["actor_health_unconscious"]);
    events.length = 0;
    commit("actor.setStatus", updateActorStatus(encounter, "actor-a", 0));
    expect(events.flat().map(({ cueId }) => cueId)).toEqual(["actor_health_dead"]);
    events.length = 0;
    commit("actor.setStatus", updateActorStatus(encounter, "actor-a", 0));
    expect(events).toEqual([]);
    commit("actor.adjustHitPoints", adjustHitPoints(encounter, ["actor-a"], 8, rules), 8);
    expect(events.flat().map(({ cueId }) => cueId)).toEqual(["actor_health_healthy"]);
    events.length = 0;
    store.dispatch(undoEncounterChange());
    store.dispatch(redoEncounterChange());
    expect(events).toEqual([]);
    commit("actor.setStatus", updateActorStatus(encounter, "actor-a", 3));
    expect(events).toEqual([]);
    commit("actor.setStatus", updateActorStatus(encounter, "actor-a", 2));
    events.length = 0;
    commit("actor.setStatus", updateActorStatus(encounter, "actor-a", 3));
    expect(events.flat().map(({ cueId }) => cueId)).toEqual(["actor_health_healthy"]);
  });

  it("emits one Moves request per cue for moves into and out of zoneless", () => {
    window.addEventListener(AUDIO_TRIGGER_EVENT, listener);
    const store = makeStore();
    store.dispatch(loadEncounterState(automaticEncounter()));
    for (const destination of ["zoneless", "hall"]) {
      const before = store.getState().encounter.present;
      store.dispatch(commitEncounterChange({ action: createEncounterActionRecord("actor.move", {}), nextEncounter: moveActor(before, "actor-a", destination) }));
      expect(events.flat().filter(({ cueId }) => cueId === "actor-enter")).toHaveLength(1);
      events.length = 0;
    }
  });

});
