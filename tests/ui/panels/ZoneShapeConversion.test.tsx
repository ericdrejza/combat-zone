import * as runtimeValidation from "@core/validation/runtimeEncounterChange";
import { prepareValidatedEncounterChange } from "@core/validation/validatedEncounterChange";
import { zoneSnappingValid } from "@core/movement/zoneVertexSnapping";
import { buildActor } from "@entities/actor/actorMutations";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { createEncounterState } from "@core/encounter/createEncounterState";
import { createZone } from "@entities/zone/zoneMutations";
import { selectEntity } from "@interaction/interactionState";
import { loadEncounterState, undoEncounterChange, redoEncounterChange } from "@store/encounterSlice";
import { setPersistenceWritable } from "@store/persistenceWriteGuardMiddleware";
import { store } from "@store/store";
import { resetAppStore } from "@tests/ui/renderApp";
import { ZonePropertiesPanel } from "@ui/panels/ZonePropertiesPanel";
import { createCirclePolygon, createHexagonPolygon } from "@entities/zone/zoneShapeGeometry";
import type { EncounterState } from "@core/encounter/types";

const start = { x: 100, y: 100 }, end = { x: 300, y: 300 };
const rectangle = [start, { x: 300, y: 100 }, end, { x: 100, y: 300 }];
function setup(configure: (state: EncounterState) => EncounterState = state => state) {
  setPersistenceWritable(true);
  resetAppStore();
  let state = createZone(createEncounterState({ id: "shape-test", name: "Shapes" }), {
    id: "first", shape: "rectangle", polygon: rectangle
  });
  state = createZone(state, { id: "second", polygon: [{ x: 500, y: 100 }, { x: 600, y: 100 }, { x: 600, y: 300 }, { x: 500, y: 300 }] });
  store.dispatch(loadEncounterState(configure(state)));
  store.dispatch(selectEntity({ entityType: "zone", ids: ["first", "second"] }));
  render(<Provider store={store}><ZonePropertiesPanel /></Provider>);
}
const zone = () => store.getState().encounter.present.zones.byId.first;
const convert = (shape: string) => fireEvent.click(screen.getByRole("button", { name: `Convert to ${shape}` }));
afterEach(() => { setPersistenceWritable(true); vi.restoreAllMocks(); });

describe("Zone shape conversion", () => {
  it("converts generated shapes in their bounds and restores shape and outline through history", async () => {
    setup();
    const second = store.getState().encounter.present.zones.byId.second;
    convert("rectangle");
    expect(store.getState().encounter.past).toHaveLength(0);
    for (const [shape, polygon] of [
      ["circle", createCirclePolygon(start, end)],
      ["hexagon", createHexagonPolygon(start, end)],
      ["rectangle", rectangle]
    ] as const) {
      const before = zone();
      convert(shape);
      await waitFor(() => expect(zone().shape).toBe(shape));
      expect(zone().polygon).toHaveLength(polygon.length);
      zone().polygon.forEach((point, index) => {
        expect(point.x).toBeCloseTo(polygon[index].x, 8);
        expect(point.y).toBeCloseTo(polygon[index].y, 8);
      });
      const after = zone();
      act(() => { store.dispatch(undoEncounterChange()); });
      expect(zone()).toEqual(before);
      act(() => { store.dispatch(redoEncounterChange()); });
      expect(zone()).toEqual(after);
      expect(store.getState().encounter.present.zones.byId.second).toEqual(second);
    }
    expect(store.getState().encounter.past).toHaveLength(3);
  });

  it("preserves the generated outline as Polygon and accepts arbitrary polygons for conversion back", async () => {
    setup(state => ({ ...state, zones: { ...state.zones, byId: { ...state.zones.byId,
      first: { ...state.zones.byId.first, shape: "circle", polygon: createCirclePolygon(start, end) }
    } } }));
    const outline = zone().polygon;
    convert("polygon");
    await waitFor(() => expect(zone().shape).toBe("polygon"));
    expect(zone().polygon).toEqual(outline);
    expect(store.getState().encounter.past).toHaveLength(1);
    act(() => { store.dispatch(undoEncounterChange()); });
    expect(zone().shape).toBe("circle");
    act(() => { store.dispatch(redoEncounterChange()); });
    expect(zone().shape).toBe("polygon");
    convert("rectangle");
    await waitFor(() => expect(zone().shape).toBe("rectangle"));
    expect(zone().polygon).toEqual(rectangle);
  });

  it("rejects conversion whose bounding rectangle overlaps another Zone", async () => {
    setup(state => ({ ...state, zones: { ...state.zones, byId: {
      first: { ...state.zones.byId.first, shape: "polygon", polygon: [start, { x: 300, y: 100 }, { x: 100, y: 300 }] },
      second: { ...state.zones.byId.second, polygon: [{ x: 260, y: 260 }, { x: 280, y: 260 }, { x: 280, y: 280 }, { x: 260, y: 280 }] }
    } } }));
    const before = zone();
    convert("rectangle");
    await act(async () => {});
    expect(zone()).toEqual(before);
    expect(store.getState().encounter.past).toHaveLength(0);
  });

  it("blocks shape mutation at the writer boundary", () => {
    setup();
    setPersistenceWritable(false);
    convert("circle");
    expect(zone().shape).toBe("rectangle");
    expect(store.getState().encounter.past).toHaveLength(0);
  });
});

it.each(["STRICT", "ADVISORY"] as const)("honors %s validation during conversion", async mode => {
  setup(state => ({ ...state, validationState: { mode, messages: [] } }));
  vi.spyOn(runtimeValidation, "prepareValidatedEncounterChangeForRuntime").mockImplementation(input =>
    prepareValidatedEncounterChange({ ...input, validators: [{ id: "ConversionConstraint", validate: () => ({
      valid: false, messages: [{ code: "shape.constraint", severity: "error", message: "Constraint" }]
    }) }] }));
  convert("circle");
  await act(async () => {});
  expect(zone().shape).toBe(mode === "STRICT" ? "rectangle" : "circle");
  expect(store.getState().encounter.past).toHaveLength(mode === "STRICT" ? 0 : 1);
});

it("reconciles shape bounds to the grid before committing", async () => {
  setup(state => ({ ...state, movementRules: { ...state.movementRules, snapZoneVertices: true } }));
  convert("hexagon");
  await waitFor(() => expect(zone().shape).toBe("hexagon"));
  expect(zoneSnappingValid(store.getState().encounter.present, zone())).toBe(true);
});

it.each(["STRICT", "ADVISORY"] as const)("includes actor-fit enlargement in conversion history in %s mode", async mode => {
  setup(state => {
    const actor = buildActor({ id: "actor", currentZoneId: "first", shape: "rectangle" });
    return { ...state, validationState: { mode, messages: [] },
      actors: { allIds: [actor.id], byId: { [actor.id]: actor } },
      zones: { ...state.zones, byId: { ...state.zones.byId, first: { ...state.zones.byId.first,
        polygon: [{ x: 100, y: 100 }, { x: 180, y: 100 }, { x: 180, y: 180 }, { x: 100, y: 180 }]
      } } } };
  });
  const before = store.getState().encounter.present;
  convert("circle");
  await waitFor(() => expect(zone().shape).toBe("circle"));
  expect(zone().polygon).not.toEqual(createCirclePolygon(start, { x: 180, y: 180 }));
  const after = store.getState().encounter.present;
  expect(store.getState().encounter.past).toHaveLength(1);
  act(() => { store.dispatch(undoEncounterChange()); });
  expect(store.getState().encounter.present).toEqual(before);
  act(() => { store.dispatch(redoEncounterChange()); });
  expect(store.getState().encounter.present).toEqual(after);
});

it.each(["new snapshot", "read-only"])("discards delayed conversion after %s", async reason => {
  setup();
  let resolve!: (value: ReturnType<typeof prepareValidatedEncounterChange>) => void;
  const pending = new Promise<ReturnType<typeof prepareValidatedEncounterChange>>(done => { resolve = done; });
  let prepared!: ReturnType<typeof prepareValidatedEncounterChange>;
  vi.spyOn(runtimeValidation, "prepareValidatedEncounterChangeForRuntime").mockImplementation(input => {
    prepared = prepareValidatedEncounterChange(input); return pending;
  });
  convert("circle");
  if (reason === "new snapshot") act(() => { store.dispatch(loadEncounterState({ ...store.getState().encounter.present, name: "New snapshot" })); });
  else setPersistenceWritable(false);
  await act(async () => { resolve(prepared); await pending; });
  expect(zone().shape).toBe("rectangle");
  expect(store.getState().encounter.past).toHaveLength(0);
});
