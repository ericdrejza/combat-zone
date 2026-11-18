import { afterEach, describe, expect, it } from "vitest";
import { diceEncounter, slash } from "./fixtures";
import { resolveInvocation } from "@core/dice/resolveInvocation";
import { applyRollResult, saveRollables } from "@entities/actor/rollableMutations";
import { DEFAULT_COMBAT_RULES } from "@entities/actor/actorResources";
import { deleteAudioCueGroup, moveAudioCueGroup } from "@entities/audio/audioMutations";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import reducer, { commitEncounterChange, loadEncounterState, sendChatMessage, resolveChatRoll, undoEncounterChange, redoEncounterChange, setChatRollDecisions } from "@store/encounterSlice";
import { setPersistenceWritable } from "@store/persistenceWriteGuardMiddleware";
import { store } from "@store/store";
import { evaluateDice } from "@core/dice/evaluate";
const commit = (state: ReturnType<typeof reducer>, next: typeof state.present) => reducer(state, commitEncounterChange({ action: createEncounterActionRecord("actor.editRollables"), nextEncounter: next }));
afterEach(() => setPersistenceWritable(true));
describe("Rollables and application history", () => {
  it("resolves quoted names and lists, including ambiguous-name choices", () => {
    const state = diceEncounter();
    expect(resolveInvocation(state, '@"Goblin Chief"/Slash -> [@Guard, @Scout]').targets.map(t => t.id)).toEqual(["b", "c"]);
    state.actors.byId.c.name = "Guard";
    expect(() => resolveInvocation(state, '@"Goblin Chief"/Slash -> @Guard')).toThrow(/Choose/);
    expect(resolveInvocation(state, '@"Goblin Chief"/Slash -> @Guard', { "target:0": "c" }).targets[0].id).toBe("c");
    expect(() => resolveInvocation(state, '@Missing/Slash')).toThrow(/No matching/);
  });
  it("commits complete definition order once and restores exact snapshots", () => {
    const initial = reducer(undefined, loadEncounterState(diceEncounter()));
    const second = { ...slash, id: "heal", name: "Heal", checkFormula: "", checkRollMode: "shared" as const, effectKind: "healing" as const };
    const edited = commit(initial, saveRollables(initial.present, "a", [second, slash]));
    expect(edited.past).toHaveLength(1);
    expect(edited.present.actors.byId.a.rollables?.allIds).toEqual(["heal", "slash"]);
    const undone = reducer(edited, undoEncounterChange()); expect(undone.present).toEqual(initial.present);
    expect(reducer(undone, redoEncounterChange()).present).toEqual(edited.present);
  });
  it("rolls and decisions stay outside history and survive older undo/redo", () => {
    const initial = reducer(undefined, loadEncounterState(diceEncounter()));
    const edited = commit(initial, saveRollables(initial.present, "a", [{ ...slash, name: "New name" }]));
    const invocation = resolveInvocation(initial.present, '@"Goblin Chief"/Slash -> @Guard');
    const sent = reducer(edited, sendChatMessage({ id: "m", timestamp: 1, message: "attack", sender: { id: "gm", name: "GM", color: null }, invocation, rolls: [evaluateDice("d20", () => .5)] }));
    const decided = reducer(sent, setChatRollDecisions({ id: "m", decisions: { b: "hit" } }));
    const resolved = reducer(decided, resolveChatRoll({ id: "m", invocation: { ...invocation, decisions: { b: "hit" }, phase: "resolved" }, rolls: [evaluateDice("d6", () => .5)] }));
    expect(resolved.past).toHaveLength(1);
    const undone = reducer(resolved, undoEncounterChange());
    expect(undone.present.chatMessages).toEqual(resolved.present.chatMessages);
    expect(reducer(undone, redoEncounterChange()).present.chatMessages).toEqual(resolved.present.chatMessages);
    expect(reducer(resolved, resolveChatRoll({ id: "m", invocation, rolls: [] }))).toBe(resolved);
  });
  it("applies different amounts atomically and undoes/redoes receipts with HP", () => {
    const initial = reducer(undefined, loadEncounterState(diceEncounter()));
    const applications = [{ id: "r1", resultId: "roll", actorId: "b", kind: "damage" as const, amount: 7 }, { id: "r2", resultId: "roll", actorId: "c", kind: "healing" as const, amount: 4 }];
    const next = applyRollResult(initial.present, applications, DEFAULT_COMBAT_RULES);
    const applied = commit(initial, next);
    expect(next.actors.byId.b.hitPoints?.current).toBe(13); expect(next.actors.byId.c.hitPoints?.current).toBe(24);
    expect(next.rollApplications.allIds).toEqual(["r1", "r2"]);
    const undone = reducer(applied, undoEncounterChange()); expect(undone.present).toEqual(initial.present);
    expect(reducer(undone, redoEncounterChange()).present).toEqual(next);
    expect(applyRollResult(next, applications, DEFAULT_COMBAT_RULES)).toBe(next);
    expect(() => applyRollResult(initial.present, [{ ...applications[0], amount: .5 }], DEFAULT_COMBAT_RULES)).toThrow();
  });
  it("clears audio links on group deletion or section move and restores them on undo", () => {
    const state = diceEncounter();
    state.audioCueGroups = { allIds: ["g"], byId: { g: { id: "g", name: "Attack", section: "actor", repeat: false } } };
    state.actors.byId.a.rollables!.byId.slash.audioGroupId = "g";
    const initial = reducer(undefined, loadEncounterState(state));
    for (const next of [deleteAudioCueGroup(state, "g"), moveAudioCueGroup(state, "g", "zone")]) {
      expect(next.actors.byId.a.rollables!.byId.slash.audioGroupId).toBeNull();
      expect(reducer(commit(initial, next), undoEncounterChange()).present).toEqual(state);
    }
  });
  it("centrally blocks pending decisions and resolution in read-only tabs", () => {
    store.dispatch(loadEncounterState(diceEncounter()));
    const invocation = resolveInvocation(diceEncounter(), '@"Goblin Chief"/Slash');
    store.dispatch(sendChatMessage({ id: "m", timestamp: 1, message: "attack", sender: { id: "gm", name: "GM", color: null }, invocation }));
    setPersistenceWritable(false); const before = store.getState();
    store.dispatch(setChatRollDecisions({ id: "m", decisions: { untargeted: "hit" } }));
    store.dispatch(resolveChatRoll({ id: "m", invocation: { ...invocation, phase: "resolved" }, rolls: [] }));
    expect(store.getState()).toBe(before);
  });
});

it.each(["", "   "])("requires an effect roll even when a check exists (%j)", effectFormula => {
  const state = diceEncounter();
  expect(() => saveRollables(state, "a", [{ ...slash, checkFormula: "d20", checkRollMode: "shared", effectFormula }])).toThrow(/effect roll/);
  expect(state.actors.byId.a.rollables!.byId.slash).toEqual(slash);
});
