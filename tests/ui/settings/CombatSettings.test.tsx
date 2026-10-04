import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { createEncounterState } from "@core/encounter/createEncounterState";
import { createActor } from "@entities/actor/actorMutations";
import { CombatPreferenceProvider, COMBAT_PREFERENCES_STORAGE_KEY } from "@ui/combat_preferences/CombatPreferenceProvider";
import { CombatSettings } from "@ui/settings/CombatSettings";
import { InterfacePreferenceProvider, INTERFACE_PREFERENCES_STORAGE_KEY } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { InterfaceSettings } from "@ui/settings/InterfaceSettings";
import { LOCAL_PREFERENCES_RESET_EVENT } from "@ui/motion_preferences/MotionPreferenceProvider";
import { loadEncounterState, undoEncounterChange, redoEncounterChange } from "@store/encounterSlice";
import { store } from "@store/store";
import { resetAppStore } from "@tests/ui/renderApp";
import { setPersistenceWritable } from "@store/persistenceWriteGuardMiddleware";
import { DEFAULT_COMBAT_RULES } from "@entities/actor/actorResources";

afterEach(() => { localStorage.removeItem(COMBAT_PREFERENCES_STORAGE_KEY); localStorage.removeItem(INTERFACE_PREFERENCES_STORAGE_KEY); setPersistenceWritable(true); });
function setup() {
  resetAppStore();
  const state = createActor(createEncounterState({ id: "settings", name: "Settings" }), { id: "a", currentZoneId: "zoneless" });
  state.actors.byId.a.hitPoints = { current: -5, maximum: 20 };
  store.dispatch(loadEncounterState(state));
  return render(<Provider store={store}><CombatPreferenceProvider><CombatSettings /></CombatPreferenceProvider></Provider>);
}
function configure() {
  fireEvent.change(screen.getByLabelText("Dead upper cutoff"), { target: { value: "0" } });
  fireEvent.change(screen.getByLabelText("Unconscious / severely injured upper cutoff"), { target: { value: "5" } });
  fireEvent.change(screen.getByLabelText("Injured upper cutoff"), { target: { value: "10" } });
}
describe("Combat and resource label preferences", () => {
  it("autosaves the first threshold on blur and recalculates status with undo/redo", async () => {
    setup();
    expect(screen.queryByRole("button", { name: "Save combat settings" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apply to current encounter" })).not.toBeInTheDocument();
    const cutoff = screen.getByLabelText("Dead upper cutoff");
    fireEvent.change(cutoff, { target: { value: "0" } });
    expect(localStorage.getItem(COMBAT_PREFERENCES_STORAGE_KEY)).toBeNull();
    expect(store.getState().encounter.past).toHaveLength(0);
    fireEvent.blur(cutoff);
    expect(JSON.parse(localStorage.getItem(COMBAT_PREFERENCES_STORAGE_KEY)!)).toMatchObject({ automaticHealth: true, thresholds: [0, null, null] });
    await waitFor(() => expect(store.getState().encounter.present.actors.byId.a.status).toBe(0));
    expect(store.getState().encounter.present.actors.byId.a.hitPoints?.current).toBe(-5);
    expect(store.getState().encounter.past).toHaveLength(1);
    act(() => store.dispatch(undoEncounterChange()));
    expect(store.getState().encounter.present.actors.byId.a.status).toBe(3);
    act(() => store.dispatch(redoEncounterChange()));
    expect(store.getState().encounter.present.actors.byId.a.status).toBe(0);
    fireEvent.change(cutoff, { target: { value: "-10" } });
    fireEvent.blur(cutoff);
    await waitFor(() => expect(store.getState().encounter.present.actors.byId.a.status).toBe(3));
    expect(store.getState().encounter.present.actors.byId.a.hitPoints?.current).toBe(-5);
  });
  it("rejects invalid cutoffs without overwriting saved preferences", () => {
    setup(); configure();
    fireEvent.blur(screen.getByLabelText("Injured upper cutoff"));
    const saved = localStorage.getItem(COMBAT_PREFERENCES_STORAGE_KEY);
    fireEvent.change(screen.getByLabelText("Dead upper cutoff"), { target: { value: "6" } });
    fireEvent.blur(screen.getByLabelText("Dead upper cutoff"));
    expect(screen.getByRole("alert")).toHaveTextContent("Configured cutoffs must be ordered whole numbers");
    expect(localStorage.getItem(COMBAT_PREFERENCES_STORAGE_KEY)).toBe(saved);
    fireEvent.change(screen.getByLabelText("Dead upper cutoff"), { target: { value: "0" } });
    fireEvent.blur(screen.getByLabelText("Dead upper cutoff"));
    fireEvent.change(screen.getByLabelText("Threshold units"), { target: { value: "percent" } });
    const percentSaved = localStorage.getItem(COMBAT_PREFERENCES_STORAGE_KEY);
    fireEvent.change(screen.getByLabelText("Injured upper cutoff"), { target: { value: "101" } });
    fireEvent.blur(screen.getByLabelText("Injured upper cutoff"));
    expect(screen.getByRole("switch", { name: "Automatically update health status" })).toBeDisabled();
    expect(localStorage.getItem(COMBAT_PREFERENCES_STORAGE_KEY)).toBe(percentSaved);
  });
  it("allows blank statuses, preserves manual death and disables all-blank automation", async () => {
    setup();
    fireEvent.change(screen.getByLabelText("Injured upper cutoff"), { target: { value: "10" } });
    fireEvent.blur(screen.getByLabelText("Injured upper cutoff"));
    await waitFor(() => expect(store.getState().encounter.present.actors.byId.a.status).toBe(2));
    expect(JSON.parse(localStorage.getItem(COMBAT_PREFERENCES_STORAGE_KEY)!).thresholds).toEqual([null, null, 10]);
    const manual = structuredClone(store.getState().encounter.present);
    manual.actors.byId.a.status = 0;
    act(() => store.dispatch(loadEncounterState(manual)));
    fireEvent.change(screen.getByLabelText("Injured upper cutoff"), { target: { value: "12" } });
    fireEvent.blur(screen.getByLabelText("Injured upper cutoff"));
    expect(store.getState().encounter.present.actors.byId.a.status).toBe(0);
    fireEvent.change(screen.getByLabelText("Injured upper cutoff"), { target: { value: "" } });
    fireEvent.blur(screen.getByLabelText("Injured upper cutoff"));
    expect(JSON.parse(localStorage.getItem(COMBAT_PREFERENCES_STORAGE_KEY)!)).toMatchObject({ automaticHealth: false, thresholds: [null, null, null] });
    expect(screen.getByRole("switch", { name: "Automatically update health status" })).toBeDisabled();
    expect(store.getState().encounter.present.actors.byId.a.status).toBe(0);
  });
  it("saves selects immediately and respects disabled automation and writer boundaries", () => {
    setup();
    fireEvent.change(screen.getByLabelText("Hit point limits"), { target: { value: "unbounded" } });
    expect(JSON.parse(localStorage.getItem(COMBAT_PREFERENCES_STORAGE_KEY)!).limits).toBe("unbounded");
    expect(store.getState().encounter.past).toHaveLength(0);
    setPersistenceWritable(false);
    fireEvent.change(screen.getByLabelText("Injured upper cutoff"), { target: { value: "10" } });
    fireEvent.blur(screen.getByLabelText("Injured upper cutoff"));
    expect(store.getState().encounter.past).toHaveLength(0);
    expect(store.getState().encounter.present.actors.byId.a.status).toBe(3);
    fireEvent.click(screen.getByRole("switch", { name: "Automatically update health status" }));
    fireEvent.change(screen.getByLabelText("Injured upper cutoff"), { target: { value: "12" } });
    fireEvent.blur(screen.getByLabelText("Injured upper cutoff"));
    expect(JSON.parse(localStorage.getItem(COMBAT_PREFERENCES_STORAGE_KEY)!).automaticHealth).toBe(false);
  });
  it("synchronizes storage and resets durable combat defaults", () => {
    setup();
    const updated = { ...DEFAULT_COMBAT_RULES, limits: "unbounded" };
    localStorage.setItem(COMBAT_PREFERENCES_STORAGE_KEY, JSON.stringify(updated));
    act(() => window.dispatchEvent(new StorageEvent("storage", { key: COMBAT_PREFERENCES_STORAGE_KEY })));
    expect(screen.getByLabelText("Hit point limits")).toHaveValue("unbounded");
    act(() => window.dispatchEvent(new Event(LOCAL_PREFERENCES_RESET_EVENT)));
    expect(screen.getByLabelText("Hit point limits")).toHaveValue("bounded");
    expect(screen.getByLabelText("Dead upper cutoff")).toHaveValue(null);
  });
  it("persists the health label, trims names, falls back on blank, and resets", () => {
    render(<Provider store={store}><InterfacePreferenceProvider><InterfaceSettings /></InterfacePreferenceProvider></Provider>);
    const input = screen.getByLabelText("Health counter name");
    expect(input).toHaveValue("Hit points");
    fireEvent.change(input, { target: { value: "  Vitality  " } }); fireEvent.blur(input);
    expect(JSON.parse(localStorage.getItem(INTERFACE_PREFERENCES_STORAGE_KEY)!)).toMatchObject({ healthCounterName: "Vitality" });
    fireEvent.change(screen.getByLabelText("Health counter name"), { target: { value: " " } }); fireEvent.blur(screen.getByLabelText("Health counter name"));
    expect(screen.getByLabelText("Health counter name")).toHaveValue("Hit points");
    act(() => window.dispatchEvent(new Event(LOCAL_PREFERENCES_RESET_EVENT)));
    expect(screen.getByLabelText("Health counter name")).toHaveValue("Hit points");
  });
});
