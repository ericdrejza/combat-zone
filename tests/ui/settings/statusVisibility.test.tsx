import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Provider } from "react-redux";
import { createActor } from "@entities/actor/actorMutations";
import { createEncounterState } from "@core/encounter/createEncounterState";
import { selectEntity, setActiveTool } from "@interaction/interactionState";
import { loadEncounterState, undoEncounterChange } from "@store/encounterSlice";
import { store } from "@store/store";
import { resetAppStore } from "@tests/ui/renderApp";
import { CombatPreferenceProvider, COMBAT_PREFERENCES_STORAGE_KEY } from "@ui/combat_preferences/CombatPreferenceProvider";
import { DEFAULT_STATUS_VISIBILITY } from "@ui/combat_preferences/statusVisibility";
import { LOCAL_PREFERENCES_RESET_EVENT } from "@ui/motion_preferences/MotionPreferenceProvider";
import { CombatSettings } from "@ui/settings/CombatSettings";
import { StatusPanel } from "@ui/panels/StatusPanel";
import { CONDITIONS } from "@ui/status/markerCatalog";

afterEach(() => localStorage.removeItem(COMBAT_PREFERENCES_STORAGE_KEY));
function setup(ids = ["a"]) {
  resetAppStore();
  const state = createActor(createActor(createEncounterState({ id: "visibility", name: "Visibility" }), { id: "a", name: "Alpha", currentZoneId: "zoneless" }), { id: "b", name: "Bravo", currentZoneId: "zoneless" });
  state.actors.byId.b.statusEffects = ["blinded", "weapon:sword", "armor:heavy"];
  store.dispatch(loadEncounterState(state));
  store.dispatch(setActiveTool("select"));
  store.dispatch(selectEntity({ entityType: "actor", ids }));
  return render(<Provider store={store}><CombatPreferenceProvider><CombatSettings /><StatusPanel /></CombatPreferenceProvider></Provider>);
}
function conditions() { return within(screen.getByRole("group", { name: "Conditions" })); }

it("defaults to every condition and section visible, and saves preferences without history", () => {
  setup();
  const toggles = within(screen.getByRole("group", { name: "Visible conditions" })).getAllByRole("button");
  expect(toggles.map((button) => button.getAttribute("aria-label"))).toEqual(CONDITIONS.map(({ label }) => `Show ${label}`));
  for (const toggle of toggles) expect(toggle).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Show Blinded" }));
  expect(conditions().queryByRole("button", { name: "Blinded" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("switch", { name: "Show weapons" }));
  fireEvent.click(screen.getByRole("switch", { name: "Show armor" }));
  expect(conditions().queryByRole("button", { name: "Blinded" })).not.toBeInTheDocument();
  expect(screen.queryByRole("group", { name: "Weapons" })).not.toBeInTheDocument();
  expect(screen.queryByRole("group", { name: "Armor" })).not.toBeInTheDocument();
  expect(store.getState().encounter.past).toHaveLength(0);
  expect(JSON.parse(localStorage.getItem(COMBAT_PREFERENCES_STORAGE_KEY)!).visibility).toMatchObject({ hiddenConditions: ["blinded"], showWeapons: false, showArmor: false });
});

it("keeps hidden active conditions visible for single and mixed selections until removed", async () => {
  setup();
  fireEvent.click(screen.getByRole("button", { name: "Show Blinded" }));
  act(() => store.dispatch(selectEntity({ entityType: "actor", ids: ["b"] })));
  expect(conditions().getByRole("button", { name: "Blinded" })).toHaveAttribute("aria-pressed", "true");
  act(() => store.dispatch(selectEntity({ entityType: "actor", ids: ["a", "b"] })));
  expect(conditions().getByRole("button", { name: "Blinded" })).toHaveAttribute("aria-pressed", "mixed");
  fireEvent.click(conditions().getByRole("button", { name: "Blinded" }));
  await waitFor(() => expect(conditions().getByRole("button", { name: "Blinded" })).toHaveAttribute("aria-pressed", "true"));
  fireEvent.click(conditions().getByRole("button", { name: "Blinded" }));
  await waitFor(() => expect(conditions().queryByRole("button", { name: "Blinded" })).not.toBeInTheDocument());
  act(() => store.dispatch(undoEncounterChange()));
  expect(conditions().getByRole("button", { name: "Blinded" })).toHaveAttribute("aria-pressed", "true");
});

it("hides all inactive conditions with the master switch and preserves individual choices", () => {
  setup(["b"]);
  fireEvent.click(screen.getByRole("button", { name: "Show Burning" }));
  fireEvent.click(screen.getByRole("switch", { name: "Show conditions" }));
  expect(conditions().getAllByRole("button").map((button) => button.getAttribute("aria-label"))).toEqual(["Blinded"]);
  expect(conditions().queryByRole("group", { name: "Buffs" })).not.toBeInTheDocument();
  expect(within(conditions().getByRole("group", { name: "Debuffs" })).getByRole("button", { name: "Blinded" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("switch", { name: "Show conditions" }));
  expect(conditions().queryByRole("button", { name: "Burning" })).not.toBeInTheDocument();
  expect(conditions().getByRole("button", { name: "Blessed" })).toBeInTheDocument();
});

it("reloads, synchronizes and resets visibility, preserving actor conditions and equipment", () => {
  const view = setup(["b"]);
  fireEvent.click(screen.getByRole("switch", { name: "Show conditions" }));
  fireEvent.click(screen.getByRole("switch", { name: "Show weapons" }));
  fireEvent.click(screen.getByRole("switch", { name: "Show armor" }));
  view.unmount();
  setup(["b"]);
  expect(screen.getByRole("switch", { name: "Show conditions" })).not.toBeChecked();
  expect(screen.queryByRole("group", { name: "Weapons" })).not.toBeInTheDocument();
  expect(screen.queryByRole("group", { name: "Armor" })).not.toBeInTheDocument();
  expect(store.getState().encounter.present.actors.byId.b.statusEffects).toEqual(["blinded", "weapon:sword", "armor:heavy"]);
  const stored = JSON.parse(localStorage.getItem(COMBAT_PREFERENCES_STORAGE_KEY)!);
  localStorage.setItem(COMBAT_PREFERENCES_STORAGE_KEY, JSON.stringify({ ...stored, visibility: { ...DEFAULT_STATUS_VISIBILITY, hiddenConditions: ["blessed"] } }));
  act(() => window.dispatchEvent(new StorageEvent("storage", { key: COMBAT_PREFERENCES_STORAGE_KEY })));
  expect(conditions().queryByRole("button", { name: "Blessed" })).not.toBeInTheDocument();
  expect(screen.getByRole("group", { name: "Weapons" })).toBeInTheDocument();
  act(() => window.dispatchEvent(new Event(LOCAL_PREFERENCES_RESET_EVENT)));
  expect(conditions().getAllByRole("button")).toHaveLength(CONDITIONS.length);
  expect(screen.getByRole("switch", { name: "Show conditions" })).toBeChecked();
  expect(screen.getByRole("group", { name: "Armor" })).toBeInTheDocument();
});

it("falls back safely for malformed stored visibility and for older preferences", () => {
  localStorage.setItem(COMBAT_PREFERENCES_STORAGE_KEY, JSON.stringify({ visibility: { hiddenConditions: "blinded", showWeapons: "false", showArmor: null } }));
  setup();
  expect(conditions().getAllByRole("button")).toHaveLength(CONDITIONS.length);
  expect(screen.getByRole("switch", { name: "Show weapons" })).toBeChecked();
  expect(screen.getByRole("switch", { name: "Show armor" })).toBeChecked();
  localStorage.setItem(COMBAT_PREFERENCES_STORAGE_KEY, JSON.stringify({ limits: "unbounded" }));
  act(() => window.dispatchEvent(new StorageEvent("storage", { key: COMBAT_PREFERENCES_STORAGE_KEY })));
  expect(screen.getByRole("switch", { name: "Show conditions" })).toBeChecked();
  expect(conditions().getAllByRole("button")).toHaveLength(CONDITIONS.length);
});


it("hides the Conditions section when the master is off and no selected actor has conditions", () => {
  setup();
  fireEvent.click(screen.getByRole("switch", { name: "Show conditions" }));
  expect(screen.queryByRole("group", { name: "Conditions" })).not.toBeInTheDocument();
  act(() => store.dispatch(selectEntity({ entityType: "actor", ids: ["b"] })));
  expect(conditions().getByRole("button", { name: "Blinded" })).toBeInTheDocument();
});
