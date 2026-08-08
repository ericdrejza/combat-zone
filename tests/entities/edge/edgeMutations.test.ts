import { createEncounterState } from "@core/encounter/createEncounterState";
import type { EncounterState } from "@core/encounter/types";
import {
  DEFAULT_EDGE_PRESET,
  createOrReplaceEdge,
  deleteAllEdges,
  edgeMatchesPreset,
  getEdgeForSlot,
  getEdgeSlotKey,
  updateEdges
} from "@entities/edge/edgeMutations";
import type { Edge } from "@entities/edge/types";
import { buildZone } from "@entities/zone/zoneMutations";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { prepareValidatedEncounterChange } from "@core/validation/validatedEncounterChange";

function stateWithZones(): EncounterState {
  const state = createEncounterState({ id: "edge-test", name: "Edges" });
  const zone = (id: string, x: number) => buildZone({ id, polygon: [{ x, y: 20 }, { x: x + 80, y: 20 }, { x: x + 80, y: 100 }, { x, y: 100 }] });
  return { ...state, zones: { allIds: ["a", "b"], byId: { a: zone("a", 20), b: zone("b", 200) } } };
}

describe("edge mutations", () => {
  it("canonicalizes bilateral slots while preserving unilateral direction", () => {
    expect(getEdgeSlotKey("a", "b", "bilateral")).toBe(getEdgeSlotKey("b", "a", "bilateral"));
    expect(getEdgeSlotKey("a", "b", "unilateral")).not.toBe(getEdgeSlotKey("b", "a", "unilateral"));
  });

  it("creates and fully replaces an occupied slot with a fresh entity", () => {
    const created = createOrReplaceEdge(stateWithZones(), { ...DEFAULT_EDGE_PRESET, fromZoneId: "a", id: "first", toZoneId: "b" });
    const first: Edge = { ...created.edge, interactionTags: ["stairs"], notes: "old" };
    const withMetadata = { ...created.nextEncounter, edges: { allIds: [first.id], byId: { [first.id]: first } } };
    const replaced = createOrReplaceEdge(withMetadata, { ...DEFAULT_EDGE_PRESET, fromZoneId: "b", id: "second", movementRules: ["difficult"], toZoneId: "a" });
    expect(replaced.replacedEdge).toEqual(first);
    expect(replaced.nextEncounter.edges.allIds).toEqual(["second"]);
    expect(replaced.edge).toMatchObject({ interactionTags: [], movementRules: ["difficult"], notes: undefined });
    expect(getEdgeForSlot(replaced.nextEncounter, "a", "b", "bilateral")?.id).toBe("second");
  });

  it("matches presets, batch updates editable values, and clears all edges", () => {
    const created = createOrReplaceEdge(stateWithZones(), { ...DEFAULT_EDGE_PRESET, fromZoneId: "a", id: "edge", toZoneId: "b" });
    expect(edgeMatchesPreset(created.edge, DEFAULT_EDGE_PRESET)).toBe(true);
    const updated = updateEdges(created.nextEncounter, ["edge"], { shape: "curved", visibilityRule: "obscured" });
    expect(updated.edges.byId.edge).toMatchObject({ fromZoneId: "a", toZoneId: "b", directionality: "bilateral", shape: "curved", visibilityRule: "obscured" });
    expect(deleteAllEdges(updated).edges).toEqual({ allIds: [], byId: {} });
  });

  it("blocks invalid graph state in STRICT and warns without blocking in ADVISORY", () => {
    const current = stateWithZones();
    const invalidEdge: Edge = { ...DEFAULT_EDGE_PRESET, fromZoneId: "a", id: "invalid", interactionTags: [], toZoneId: "a" };
    const next = { ...current, edges: { allIds: [invalidEdge.id], byId: { [invalidEdge.id]: invalidEdge } } };
    const action = createEncounterActionRecord("edge.create", { fromZoneId: "a", toZoneId: "a" });
    const advisory = prepareValidatedEncounterChange({ currentEncounter: current, nextEncounter: next, action });
    const strict = prepareValidatedEncounterChange({ currentEncounter: { ...current, validationState: { ...current.validationState, mode: "STRICT" } }, nextEncounter: next, action });
    expect(advisory).toMatchObject({ blocked: false, validationResult: { valid: false } });
    expect(strict).toMatchObject({ blocked: true, validationResult: { valid: false } });
  });
});
