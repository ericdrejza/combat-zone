import { createEncounterState } from "@core/encounter/createEncounterState";
import type { EncounterState } from "@core/encounter/types";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import {
  createOrReplaceEdge,
  DEFAULT_EDGE_PRESET,
  deleteEdges,
  updateEdges
} from "@entities/edge/edgeMutations";
import { buildZone } from "@entities/zone/zoneMutations";
import reducer, {
  commitEncounterChange,
  redoEncounterChange,
  undoEncounterChange
} from "@store/encounterSlice";

function baseEncounter(): EncounterState {
  const state = createEncounterState({ id: "history", name: "Edge history" });
  const zone = (id: string, x: number) => buildZone({ id, polygon: [{ x, y: 10 }, { x: x + 50, y: 10 }, { x: x + 50, y: 60 }, { x, y: 60 }] });
  return { ...state, zones: { allIds: ["a", "b"], byId: { a: zone("a", 10), b: zone("b", 200) } } };
}

function commit(state: ReturnType<typeof reducer>, type: string, nextEncounter: EncounterState) {
  return reducer(state, commitEncounterChange({ action: createEncounterActionRecord(type), nextEncounter }));
}

describe("edge history", () => {
  it("restores create, edit, and delete through undo and redo", () => {
    let history = reducer(undefined, { type: "init" });
    const base = baseEncounter();
    history = commit(history, "test.seed", base);
    const created = createOrReplaceEdge(base, { ...DEFAULT_EDGE_PRESET, fromZoneId: "a", id: "edge", toZoneId: "b" }).nextEncounter;
    history = commit(history, "edge.create", created);
    history = reducer(history, undoEncounterChange());
    expect(history.present).toEqual(base);
    history = reducer(history, redoEncounterChange());
    expect(history.present).toEqual(created);

    const edited = updateEdges(created, ["edge"], { movementRules: ["difficult"], shape: "curved" });
    history = commit(history, "edge.updateProperties", edited);
    history = reducer(history, undoEncounterChange());
    expect(history.present).toEqual(created);
    history = reducer(history, redoEncounterChange());
    expect(history.present).toEqual(edited);

    const deleted = deleteEdges(edited, ["edge"]);
    history = commit(history, "edge.delete", deleted);
    history = reducer(history, undoEncounterChange());
    expect(history.present).toEqual(edited);
    history = reducer(history, redoEncounterChange());
    expect(history.present).toEqual(deleted);
  });

  it("restores the exact replaced entity and replacement IDs", () => {
    let history = reducer(undefined, { type: "init" });
    const first = createOrReplaceEdge(baseEncounter(), { ...DEFAULT_EDGE_PRESET, fromZoneId: "a", id: "old", toZoneId: "b" }).nextEncounter;
    history = commit(history, "test.seed", first);
    const replacement = createOrReplaceEdge(first, { ...DEFAULT_EDGE_PRESET, fromZoneId: "b", id: "new", movementRules: ["blocked"], toZoneId: "a" }).nextEncounter;
    history = commit(history, "edge.replace", replacement);
    history = reducer(history, undoEncounterChange());
    expect(history.present.edges.allIds).toEqual(["old"]);
    history = reducer(history, redoEncounterChange());
    expect(history.present.edges.allIds).toEqual(["new"]);
  });
});
