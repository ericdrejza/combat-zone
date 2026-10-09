import * as validationRuntime from "@core/validation/validatedEncounterChange";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { store } from "@store/store";
import { loadEncounterState, redoEncounterChange, undoEncounterChange } from "@store/encounterSlice";
import { setPersistenceWritable } from "@store/persistenceWriteGuardMiddleware";
import { selectEntity, setActiveTool } from "@interaction/interactionState";
import { INTERFACE_PREFERENCES_STORAGE_KEY } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { LOCAL_PREFERENCES_RESET_EVENT } from "@ui/motion_preferences/MotionPreferenceProvider";
import { collection, zoneA } from "@tests/entities/actor/actorMutationsTestSupport";
import { encounter, edge, setup } from "./actorKeyboardTestSupport";

beforeEach(() => { localStorage.clear(); setPersistenceWritable(true); });
afterEach(() => setPersistenceWritable(true));
const right = () => fireEvent.keyDown(window, { key: "ArrowRight" });
async function moved(id = "alpha", zone = "b") { await waitFor(() => expect(store.getState().encounter.present.actors.byId[id].currentZoneId).toBe(zone)); }

describe("actor keyboard movement workflows", () => {
  it("does not commit a validation result after selection changes", async () => {
    let resolve!: (result: validationRuntime.PreparedValidatedEncounterChange) => void;
    let input!: validationRuntime.PrepareValidatedEncounterChangeInput;
    const spy = vi.spyOn(validationRuntime, "prepareValidatedEncounterChangeForRuntime").mockImplementation((request) => {
      input = request; return new Promise((done) => { resolve = done; });
    });
    try {
      setup(); right();
      act(() => store.dispatch(selectEntity({ entityType: "actor", ids: ["alpha"] })));
      await act(async () => { resolve(validationRuntime.prepareValidatedEncounterChange(input)); });
      expect(store.getState().encounter.past).toHaveLength(0);
      expect(store.getState().encounter.present.actors.byId.alpha.currentZoneId).toBe(zoneA.id);
    } finally { spy.mockRestore(); }
  });
  it("requires ASSISTED approval for a size expansion before committing", async () => {
    const initial = encounter(); initial.actors = collection([{ ...initial.actors.byId.alpha, size: "medium" }]);
    initial.zones.byId[zoneA.id].polygon = [{ x: 0, y: 0 }, { x: 70, y: 0 }, { x: 70, y: 70 }, { x: 0, y: 70 }];
    initial.validationState.mode = "ASSISTED";
    setup(initial, ["alpha"]); fireEvent.keyDown(window, { key: "+", shiftKey: true });
    await screen.findByRole("dialog", { name: "Resize zone approval" });
    expect(store.getState().encounter.past).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Resize" }));
    await waitFor(() => expect(store.getState().encounter.present.actors.byId.alpha.size).toBe("large"));
    expect(store.getState().encounter.past).toHaveLength(1);
    act(() => store.dispatch(undoEncounterChange()));
    expect(store.getState().encounter.present.zones.byId[zoneA.id].polygon).toEqual(initial.zones.byId[zoneA.id].polygon);
  });

  it("cycles candidates, shows tagged HUD, commits once, and supports undo/redo", async () => {
    const initial = encounter(); initial.edges = collection([edge("upper", "b", { interactionTags: ["bridge"] }), edge("lower", "c")]);
    setup(initial); right();
    expect(screen.getByLabelText("Movement destination Upper")).toBeInTheDocument();
    expect(screen.getByTestId("movement-hud")).toHaveTextContent("Alpha, Bravo: Zone A -> Upper [bridge]");
    fireEvent.keyDown(window, { key: "ArrowUp" });
    expect(screen.getByLabelText("Movement destination Lower")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Enter" }); await moved("alpha", "c");
    expect(store.getState().encounter.past).toHaveLength(1);
    act(() => store.dispatch(undoEncounterChange())); expect(store.getState().encounter.present.actors.byId.alpha.currentZoneId).toBe(zoneA.id);
    act(() => store.dispatch(redoEncounterChange())); expect(store.getState().encounter.present.actors.byId.bravo.currentZoneId).toBe("c");
  });
  it("cancels chooser without history, including stale selection/tool/encounter changes", () => {
    const initial = encounter(); initial.edges = collection([edge("upper", "b"), edge("lower", "c")]);
    setup(initial); right(); fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByLabelText("Movement destination Upper")).not.toBeInTheDocument();
    right(); act(() => store.dispatch(selectEntity({ entityType: "actor", ids: ["alpha"] })));
    expect(screen.queryByLabelText("Movement destination Upper")).not.toBeInTheDocument();
    right(); act(() => store.dispatch(setActiveTool("zone")));
    expect(screen.queryByLabelText("Movement destination Upper")).not.toBeInTheDocument();
    act(() => store.dispatch(setActiveTool("actor"))); right();
    act(() => store.dispatch(loadEncounterState(encounter())));
    expect(screen.queryByLabelText("Movement destination Upper")).not.toBeInTheDocument();
    expect(store.getState().encounter.past).toHaveLength(0);
  });
  it("adjudicates individual actors before differing-destination confirmation", async () => {
    const initial = encounter(); initial.edges = collection([edge("check", "b", { movementRules: ["skillCheck", "difficult"], interactionTags: ["jump"] })]);
    setup(initial); right();
    const dialog = screen.getByRole("dialog", { name: "Skill check required" });
    expect(store.getState().encounter.past).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole("button", { name: "Remain in current zone" }));
    expect(within(dialog).getByRole("button", { name: "Adjudicate Alpha: remain" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Adjudicate Bravo: unadjudicated" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(dialog).getByRole("button", { name: "Move to zone and proceed" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" })); await moved("bravo");
    expect(store.getState().encounter.present.actors.byId.alpha.currentZoneId).toBe(zoneA.id);
    expect(store.getState().encounter.past).toHaveLength(1);
  });
  it("moves all pending actors without changing remain decisions and permits revisiting decisions", async () => {
    const initial = encounter(); initial.edges = collection([edge("check", "b", { movementRules: ["skillCheck"] })]);
    initial.actors.byId.charlie = { ...initial.actors.byId.alpha, id: "charlie", name: "Charlie" }; initial.actors.allIds.push("charlie");
    setup(initial, ["alpha", "bravo", "charlie"]); right();
    fireEvent.click(screen.getByRole("button", { name: "Remain in current zone" }));
    fireEvent.click(screen.getByRole("button", { name: "Adjudicate Alpha: remain" }));
    fireEvent.click(screen.getByRole("button", { name: "Move to zone" }));
    expect(screen.getByRole("button", { name: "Adjudicate Alpha: move" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Adjudicate Alpha: move" }));
    fireEvent.click(screen.getByRole("button", { name: "Remain in current zone" }));
    fireEvent.click(screen.getByRole("button", { name: "Move all unadjudicated actors and proceed" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" })); await moved("bravo");
    expect(store.getState().encounter.present.actors.byId.charlie.currentZoneId).toBe("b");
    expect(store.getState().encounter.present.actors.byId.alpha.currentZoneId).toBe(zoneA.id);
  });
  it("persists warning suppression only on Continue and resets it with preferences", async () => {
    const initial = encounter(); initial.actors.byId.bravo.currentZoneId = "zoneless";
    setup(initial); right(); fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(JSON.parse(localStorage.getItem(INTERFACE_PREFERENCES_STORAGE_KEY) ?? "{}").warnActorDestinationsDiffer).not.toBe(false);
    right(); fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(screen.getByRole("button", { name: "Continue" })); await moved();
    expect(JSON.parse(localStorage.getItem(INTERFACE_PREFERENCES_STORAGE_KEY)!).warnActorDestinationsDiffer).toBe(false);
    act(() => store.dispatch(undoEncounterChange())); right(); await moved();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    act(() => { store.dispatch(undoEncounterChange()); window.dispatchEvent(new Event(LOCAL_PREFERENCES_RESET_EVENT)); }); right();
    expect(screen.getByRole("dialog", { name: "Actor destinations differ" })).toBeInTheDocument();
  });
  it("resolves choices independently for actors in different origins", async () => {
    const initial = encounter(); initial.actors.byId.bravo.currentZoneId = "c";
    initial.zones.byId.d = { ...initial.zones.byId.b, id: "d", name: "Far", polygon: initial.zones.byId.b.polygon.map((p) => ({ x: p.x + 300, y: p.y + 200 })) }; initial.zones.allIds.push("d");
    initial.zones.byId.e = { ...initial.zones.byId.d, id: "e", name: "Far upper", polygon: initial.zones.byId.d.polygon.map((p) => ({ x: p.x, y: p.y - 200 })) }; initial.zones.allIds.push("e");
    initial.edges = collection([edge("ab", "b"), edge("ad", "d"), edge("ce", "e", { fromZoneId: "c" }), edge("cd", "d", { fromZoneId: "c" })]);
    setup(initial); right(); expect(screen.getByLabelText("Movement destination Upper")).toBeInTheDocument();
    right(); expect(screen.getByLabelText("Movement destination Far upper")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "Enter" });
    expect(screen.getByRole("dialog", { name: "Actor destinations differ" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue" })); await moved(); await moved("bravo", "d");
  });
  it("cancels skill checks on Escape and blocks writes in read-only mode", () => {
    const initial = encounter(); initial.edges = collection([edge("check", "b", { movementRules: ["skillCheck"] })]);
    setup(initial); right(); fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(store.getState().encounter.past).toHaveLength(0);
    setPersistenceWritable(false); right();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(store.getState().encounter.past).toHaveLength(0);
  });
  it("supports bulk sizing in Select and respects text editing", async () => {
    setup(); act(() => store.dispatch(setActiveTool("select")));
    fireEvent.keyDown(window, { key: "+", shiftKey: true, code: "Equal" });
    await waitFor(() => expect(store.getState().encounter.present.actors.byId.alpha.size).toBe("medium"));
    expect(store.getState().encounter.present.actors.byId.bravo.size).toBe("medium");
    expect(store.getState().encounter.past).toHaveLength(1);
    const input = document.createElement("input"); document.body.append(input); input.focus();
    fireEvent.keyDown(input, { key: "ArrowRight" }); expect(store.getState().encounter.past).toHaveLength(1); input.remove();
  });
});
