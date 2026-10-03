import { describe, expect, it } from "vitest";

import { createEncounterState } from "@core/encounter/createEncounterState";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { createActor, deleteActor } from "@entities/actor/actorMutations";
import { createAudioCue, createAudioCueGroup, deleteAudioCueGroup, moveAudioCue, moveAudioCueGroup, setAudioCueGroupRepeat, setEntityAudioGroups, setMusicGroupOrder, updateAudioCue } from "@entities/audio/audioMutations";
import { createZone, deleteZone } from "@entities/zone/zoneMutations";
import reducer, { commitEncounterChange, redoEncounterChange, undoEncounterChange } from "@store/encounterSlice";

const polygon = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];

function groupedState() {
  let state = createEncounterState({ id: "audio", name: "Audio" });
  state = createZone(state, { id: "zone-1", polygon });
  state = createActor(state, { currentZoneId: "zone-1", id: "actor-1" });
  state = createAudioCueGroup(state, { id: "zone-group", section: "zone" });
  state = createAudioCueGroup(state, { id: "actor-group", section: "actor" });
  state = setEntityAudioGroups(state, "zone", "zone-1", ["zone-group"]);
  state = setEntityAudioGroups(state, "actor", "actor-1", ["actor-group"]);
  state = createAudioCue(state, { id: "zone-cue", libraryNodeId: "door", placement: { type: "group", groupId: "zone-group" }, triggers: ["zone_enter"], type: "one_shot" });
  return createAudioCue(state, { id: "actor-cue", libraryNodeId: "voice", placement: { type: "group", groupId: "actor-group" }, triggers: ["actor_enter_zone"], type: "one_shot", volume: 0.4 });
}

describe("audio cue groups", () => {
  it("enforces exclusive repeat/trigger behavior without discarding either configuration", () => {
    const state = groupedState();
    const repeated = updateAudioCue(state, "zone-cue", { repeat: true, repeatDelay: { minimumDelaySeconds: 5, maximumDelaySeconds: 10 } });
    expect(repeated.audioCues.byId["zone-cue"]).toMatchObject({ repeat: true, triggersEnabled: false, triggers: ["zone_enter"] });
    const triggered = updateAudioCue(repeated, "zone-cue", { triggersEnabled: true });
    expect(triggered.audioCues.byId["zone-cue"]).toMatchObject({ repeat: false, triggersEnabled: true, repeatDelay: { minimumDelaySeconds: 5, maximumDelaySeconds: 10 } });
    expect(updateAudioCue(triggered, "zone-cue", { repeat: true, triggersEnabled: true })).toBe(triggered);
    expect(createAudioCue(triggered, { id: "invalid", libraryNodeId: "sound", placement: { type: "group", groupId: "zone-group" }, type: "one_shot", repeat: true, triggersEnabled: true })).toBe(triggered);
    const ambience = createAudioCueGroup(triggered, { id: "ambience", section: "ambiance" });
    expect(createAudioCue(ambience, { id: "invalid", libraryNodeId: "sound", placement: { type: "group", groupId: "ambience" }, type: "one_shot", triggersEnabled: true })).toBe(ambience);
  });

  it("shares group configuration and constrains cue types", () => {
    const state = groupedState();
    const updated = updateAudioCue(state, "actor-cue", { volume: 0.75 });
    expect(updated.audioCues.byId["actor-cue"].volume).toBe(0.75);
    expect(createAudioCue(state, { id: "invalid", libraryNodeId: "x", placement: { type: "group", groupId: "actor-group" }, type: "loop" })).toBe(state);
    expect(createAudioCue(state, { id: "invalid-zone-loop", libraryNodeId: "x", placement: { type: "group", groupId: "zone-group" }, type: "loop" })).toBe(state);
    expect(state.audioCues.byId["zone-cue"].volume).toBe(0.5);
  });

  it("deleting entities leaves reusable groups and cues intact", () => {
    const state = groupedState();
    const withoutActor = deleteActor(state, "actor-1");
    const withoutZone = deleteZone(withoutActor, "zone-1");
    expect(withoutZone.audioCueGroups.allIds).toEqual(["zone-group", "actor-group"]);
    expect(withoutZone.audioCues.allIds).toEqual(["zone-cue", "actor-cue"]);
  });

  it("deleting a group removes cues and every assignment", () => {
    const next = deleteAudioCueGroup(groupedState(), "zone-group");
    expect(next.audioCueGroups.byId["zone-group"]).toBeUndefined();
    expect(next.audioCues.byId["zone-cue"]).toBeUndefined();
    expect(next.zones.byId["zone-1"].audioGroupIds).toEqual([]);
  });

  it("reorders music and entity group references without copying cues", () => {
    let state = groupedState();
    state = createAudioCueGroup(state, { id: "music-a", section: "music" });
    state = createAudioCueGroup(state, { id: "music-b", section: "music" });
    state = setMusicGroupOrder(state, ["music-b", "music-a"]);
    expect(state.musicGroupIds).toEqual(["music-b", "music-a"]);

    state = createAudioCueGroup(state, { id: "zone-group-b", section: "zone" });
    state = setEntityAudioGroups(state, "zone", "zone-1", ["zone-group-b", "zone-group"]);
    expect(state.zones.byId["zone-1"].audioGroupIds).toEqual(["zone-group-b", "zone-group"]);
    expect(state.audioCues.allIds).toEqual(["zone-cue", "actor-cue"]);
  });

  it("only permits section-specific movement triggers on effects", () => {
    const state = createAudioCueGroup(groupedState(), { id: "ambience", section: "ambiance" });
    expect(updateAudioCue(state, "zone-cue", { triggers: ["actor_enter_zone"] })).toBe(state);
    expect(createAudioCue(state, { id: "ambiance-auto", libraryNodeId: "x", placement: { type: "group", groupId: "ambience" }, triggers: ["zone_enter"], type: "one_shot" })).toBe(state);
    expect(state.audioCues.byId["actor-cue"].triggers).toEqual(["actor_enter_zone"]);
  });

  it("moves cues to any group and normalizes them for the destination", () => {
    let state = groupedState();
    state = createAudioCue(state, { id: "zone-effect", libraryNodeId: "effect", placement: { type: "group", groupId: "zone-group" }, type: "one_shot" });
    const reordered = moveAudioCue(state, "zone-effect", { type: "group", groupId: "zone-group" }, "zone-cue");
    expect(reordered.audioCues.allIds).toEqual(["zone-effect", "zone-cue", "actor-cue"]);
    const moved = moveAudioCue(reordered, "zone-cue", { type: "group", groupId: "actor-group" });
    expect(moved.audioCues.byId["zone-cue"]).toMatchObject({ placement: { groupId: "actor-group" }, triggers: [], type: "one_shot" });
  });

  it("moves groups between sections, clears assignments, and normalizes cues", () => {
    const moved = moveAudioCueGroup(groupedState(), "zone-group", "music");
    expect(moved.audioCueGroups.byId["zone-group"].section).toBe("music");
    expect(moved.audioCues.byId["zone-cue"]).toMatchObject({ triggers: [], type: "loop" });
    expect(moved.zones.byId["zone-1"].audioGroupIds).toEqual([]);
  });

  it("enables playlist repeat only for music groups", () => {
    let state = createAudioCueGroup(groupedState(), { id: "music", section: "music" });
    state = setAudioCueGroupRepeat(state, "music", true);
    expect(state.audioCueGroups.byId.music.repeat).toBe(true);
    expect(setAudioCueGroupRepeat(state, "zone-group", true)).toBe(state);
  });

  it("restores group and cue mutations through undo and redo", () => {
    const initial = reducer(undefined, { type: "test/init" });
    const nextEncounter = createAudioCue(createAudioCueGroup(initial.present, { id: "music-group", section: "music" }), { id: "music", libraryNodeId: "music-node", placement: { type: "group", groupId: "music-group" }, type: "loop" });
    const committed = reducer(initial, commitEncounterChange({ action: createEncounterActionRecord("audio.addCue", { cueId: "music" }), nextEncounter }));
    expect(committed.present.audioCues.allIds).toEqual(["music"]);
    const undone = reducer(committed, undoEncounterChange());
    expect(undone.present.audioCues.allIds).toEqual([]);
    expect(reducer(undone, redoEncounterChange()).present.audioCues.allIds).toEqual(["music"]);
  });
});
