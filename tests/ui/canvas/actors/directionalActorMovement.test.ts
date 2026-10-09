import type { Edge } from "@entities/edge/types";
import { getDirectionalCandidates, buildOriginMovements } from "@ui/canvas/actors/directionalActorMovement";
import { actor, collection, createActorEncounterState, zoneA } from "@tests/entities/actor/actorMutationsTestSupport";

function setup(edges: Edge[] = []) {
  const state = createActorEncounterState();
  state.zones = collection([zoneA, { ...zoneA, id: "upper", polygon: zoneA.polygon.map((p) => ({ x: p.x + 200, y: p.y - 100 })) }, { ...zoneA, id: "lower", polygon: zoneA.polygon.map((p) => ({ x: p.x + 200, y: p.y + 100 })) }]);
  state.edges = collection(edges); return state;
}
function edge(id: string, to = "upper", extra: Partial<Edge> = {}): Edge {
  return { id, fromZoneId: zoneA.id, toZoneId: to, directionality: "bilateral", movementRules: [], visibilityRule: "visible", shape: "straight", interactionTags: [], ...extra };
}
describe("directional actor destination selection", () => {
  it("chooses nearest geometric fallback and collection order ties", () => {
    expect(getDirectionalCandidates(setup(), zoneA.id, "right").map((c) => c.zoneId)).toEqual(["upper"]);
    expect(getDirectionalCandidates(setup(), zoneA.id, "left")).toEqual([]);
  });
  it("uses only connected routes when any Edge exists", () => {
    const state = setup([edge("e", "lower")]);
    expect(getDirectionalCandidates(state, zoneA.id, "right").map((c) => c.zoneId)).toEqual(["lower"]);
    expect(getDirectionalCandidates(state, zoneA.id, "up")).toEqual([]);
  });
  it("honors unilateral direction without falling back for incoming-only origins", () => {
    const state = setup([edge("e", "upper", { directionality: "unilateral" })]);
    expect(getDirectionalCandidates(state, "upper", "left")).toEqual([]);
    expect(getDirectionalCandidates(state, zoneA.id, "right")).toHaveLength(1);
  });
  it("combines skill-check and interaction tags across parallel traversable Edges", () => {
    const state = setup([edge("e", "upper", { movementRules: ["skillCheck"], interactionTags: ["jump"] }), edge("parallel", "upper", { movementRules: ["difficult"], directionality: "unilateral", interactionTags: ["jump", "ledge"] })]);
    expect(getDirectionalCandidates(state, zoneA.id, "right")).toEqual([{ zoneId: "upper", skillCheck: true, tags: ["skillCheck", "jump", "difficult", "ledge"] }]);
    state.edges.byId.parallel.movementRules = ["blocked"];
    expect(getDirectionalCandidates(state, zoneA.id, "right")).toEqual([]);
  });
  it("sorts horizontal choices top-to-bottom and vertical choices left-to-right", () => {
    const state = setup([edge("bottom", "lower"), edge("top", "upper")]);
    expect(getDirectionalCandidates(state, zoneA.id, "right").map((c) => c.zoneId)).toEqual(["upper", "lower"]);
    state.zones.byId.upper.polygon = zoneA.polygon.map((p) => ({ x: p.x - 150, y: p.y + 200 }));
    expect(getDirectionalCandidates(state, zoneA.id, "down").map((c) => c.zoneId)).toEqual(["upper", "lower"]);
  });
  it("groups by origin and leaves zoneless actors without candidates", () => {
    const state = setup(); state.actors = collection([actor, { ...actor, id: "b" }, { ...actor, id: "z", currentZoneId: "zoneless" }]);
    const origins = buildOriginMovements(state, [actor.id, "b", "z"], "right");
    expect(origins[0].actorIds).toEqual([actor.id, "b"]);
    expect(origins[1].candidates).toEqual([]);
  });
});
