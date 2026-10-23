import { createEncounterState } from "@core/encounter/createEncounterState";
import { packZonelessActors } from "@core/movement/packZonelessActors";
import { spatialActorRadius } from "@core/movement/gridGeometry";
import { actor, collection } from "@tests/ui/panels/zoneless_actors/ZonelessActorPanel.test_support";

function fixture() {
  return { ...createEncounterState({ id: "packing", name: "Packing" }), canvasSize: { width: 500, height: 400 },
    actors: collection([actor("a", "Aria"), { ...actor("b", "Borin"), size: "large" as const },
      { ...actor("c", "Existing"), spatialPosition: { x: 250, y: 200 } }]) };
}

it("packs mixed footprints near release in stable order without existing actors or canvas overflow", () => {
  const state = fixture();
  const positions = packZonelessActors(state, ["a", "b"], { x: 250, y: 200 })!;
  expect(positions).toEqual(packZonelessActors(state, ["a", "b"], { x: 250, y: 200 }));
  const points = { ...positions, c: state.actors.byId.c.spatialPosition! };
  for (const id of ["a", "b"]) {
    const radius = spatialActorRadius(state.actors.byId[id]);
    const point = points[id as keyof typeof points];
    expect(point.x).toBeGreaterThanOrEqual(radius);
    expect(point.y).toBeGreaterThanOrEqual(radius);
    expect(point.x + radius).toBeLessThanOrEqual(500);
    expect(point.y + radius).toBeLessThanOrEqual(400);
    for (const other of ["a", "b", "c"].filter(other => other !== id)) {
      const target = points[other as keyof typeof points];
      expect(Math.hypot(point.x - target.x, point.y - target.y)).toBeGreaterThanOrEqual(radius + spatialActorRadius(state.actors.byId[other]) + 10 - 1e-6);
    }
  }
  expect(state.actors.byId.a.spatialPosition).toBeUndefined();
});

it("clamps edge requests and rejects the complete group when it cannot fit", () => {
  const state = fixture();
  expect(packZonelessActors(state, ["a", "b"], { x: 0, y: 0 })).not.toBeNull();
  expect(packZonelessActors({ ...state, canvasSize: { width: 20, height: 20 } }, ["a", "b"], { x: 10, y: 10 })).toBeNull();
});

it("uses top-to-bottom tie breaking and respects rectangular footprints", () => {
  const state = fixture();
  const circles = packZonelessActors(state, ["a", "b"], { x: 250, y: 200 })!;
  expect(circles.a.x).toBeCloseTo(250);
  expect(circles.a.y).toBeCloseTo(130);
  state.actors.byId.a.shape = "rectangle";
  state.actors.byId.b.shape = "transparent";
  const boxes = packZonelessActors(state, ["a", "b"], { x: 250, y: 200 })!;
  const a = boxes.a, b = boxes.b;
  const minimum = spatialActorRadius(state.actors.byId.a) + spatialActorRadius(state.actors.byId.b) + 10;
  expect(Math.abs(a.x - b.x) >= minimum - 1e-6 || Math.abs(a.y - b.y) >= minimum - 1e-6).toBe(true);
});
