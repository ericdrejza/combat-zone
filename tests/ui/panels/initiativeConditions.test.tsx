import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Provider, useSelector } from "react-redux";
import { createEncounterState } from "@core/encounter/createEncounterState";
import { createActor } from "@entities/actor/actorMutations";
import { loadEncounterState, undoEncounterChange, redoEncounterChange } from "@store/encounterSlice";
import { store, type RootState } from "@store/store";
import { resetAppStore } from "@tests/ui/renderApp";
import { InitiativeActorLabel } from "@ui/panels/initiative/InitiativeActorLabel";
import { PersistenceContext } from "@ui/persistence/PersistenceContext";

let availableWidth = 104;
let resize: () => void;
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function setup(effects = ["blinded", "burning", "blessed"], readOnly = false) {
  resetAppStore();
  availableWidth = 104;
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(() => availableWidth);
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(function (this: HTMLElement) {
    return this.getAttribute("aria-hidden") === "true" ? this.childElementCount * 16 + Math.max(0, this.childElementCount - 1) * 4 : 40;
  });
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: () => void) { resize = callback; }
    observe() {}
    disconnect() {}
  });
  const state = createActor(createEncounterState({ id: "condition-icons", name: "Conditions" }), { id: "a", name: "Goblin", currentZoneId: "zoneless" });
  state.actors.byId.a.statusEffects = effects;
  store.dispatch(loadEncounterState(state));
  const selectRow = vi.fn();
  function Row() {
    const actor = useSelector((state: RootState) => state.encounter.present.actors.byId.a);
    return <div onClick={selectRow}><InitiativeActorLabel actor={actor} selected={false} strikethrough={false} /></div>;
  }
  render(<Provider store={store}><PersistenceContext.Consumer>{(context) => <PersistenceContext.Provider value={{ ...context, readOnly }}><Row /></PersistenceContext.Provider>}</PersistenceContext.Consumer></Provider>);
  return selectRow;
}

it("shows every active known condition with its name tooltip, excluding equipment and unknown markers", () => {
  setup(["blinded", "blessed", "weapon:sword", "armor:heavy", "custom-marker"]);
  const blinded = screen.getByRole("button", { name: "Remove Blinded from Goblin" });
  expect(screen.getAllByRole("button")).toHaveLength(2);
  fireEvent.mouseEnter(blinded.parentElement!);
  expect(within(screen.getByRole("tooltip")).getByText("Blinded")).toBeInTheDocument();
  expect(within(screen.getByRole("tooltip")).queryByText("Blessed")).not.toBeInTheDocument();
  fireEvent.mouseLeave(blinded.parentElement!);
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  expect(screen.queryByRole("img", { name: "Goblin conditions" })).not.toBeInTheDocument();
});

it("uses Activity only when all icons cannot fit and restores icons when widened", () => {
  setup();
  expect(screen.getAllByRole("button")).toHaveLength(3);
  act(() => { availableWidth = 103; resize(); });
  const activity = screen.getByRole("img", { name: "Goblin conditions" });
  expect(screen.queryByRole("button", { name: "Remove Blinded from Goblin" })).not.toBeInTheDocument();
  fireEvent.mouseEnter(activity);
  const tooltip = screen.getByRole("tooltip");
  expect(within(tooltip).getByText("Blessed")).toBeInTheDocument();
  expect(within(tooltip).getByText("Blinded")).toBeInTheDocument();
  expect(within(tooltip).getByText("Burning")).toBeInTheDocument();
  expect(tooltip.parentElement).toBe(document.body);
  fireEvent.mouseOut(activity, { relatedTarget: tooltip });
  expect(screen.getByRole("tooltip")).toBeInTheDocument();
  fireEvent.mouseLeave(activity);
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  fireEvent.focus(activity);
  expect(screen.getByRole("tooltip")).toBeInTheDocument();
  fireEvent.keyDown(activity, { key: "Escape" });
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  act(() => { availableWidth = 104; resize(); });
  expect(screen.getAllByRole("button")).toHaveLength(3);
  expect(screen.queryByRole("img", { name: "Goblin conditions" })).not.toBeInTheDocument();
});

it("confirms removal without selecting the actor and supports cancel, undo and redo", async () => {
  const selectRow = setup();
  fireEvent.click(within(screen.getByLabelText("Goblin conditions")).getByRole("button", { name: "Remove Blinded from Goblin" }));
  const dialog = screen.getByRole("dialog", { name: "Remove Blinded from Goblin?" });
  expect(within(dialog).getByText("Do you want to remove Blinded from Goblin?")).toBeInTheDocument();
  expect(selectRow).not.toHaveBeenCalled();
  fireEvent.click(dialog.parentElement!);
  expect(store.getState().encounter.past).toHaveLength(0);
  fireEvent.click(within(screen.getByLabelText("Goblin conditions")).getByRole("button", { name: "Remove Blinded from Goblin" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  await waitFor(() => expect(store.getState().encounter.present.actors.byId.a.statusEffects).toEqual(["burning", "blessed"]));
  expect(screen.queryByRole("button", { name: "Remove Blinded from Goblin" })).not.toBeInTheDocument();
  expect(store.getState().encounter.past).toHaveLength(1);
  expect(selectRow).not.toHaveBeenCalled();
  act(() => store.dispatch(undoEncounterChange()));
  expect(within(screen.getByLabelText("Goblin conditions")).getByRole("button", { name: "Remove Blinded from Goblin" })).toBeInTheDocument();
  act(() => store.dispatch(redoEncounterChange()));
  expect(screen.queryByRole("button", { name: "Remove Blinded from Goblin" })).not.toBeInTheDocument();
});

it("allows removal from the Activity tooltip and retains keyboard focus inside the tooltip", async () => {
  setup();
  act(() => { availableWidth = 80; resize(); });
  const activity = screen.getByRole("img", { name: "Goblin conditions" });
  fireEvent.focus(activity);
  const remove = within(screen.getByRole("tooltip")).getByRole("button", { name: "Remove Blinded from Goblin" });
  fireEvent.blur(activity, { relatedTarget: remove });
  expect(screen.getByRole("tooltip")).toBeInTheDocument();
  fireEvent.click(remove);
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  await waitFor(() => expect(store.getState().encounter.present.actors.byId.a.statusEffects).not.toContain("blinded"));
});

it("allows reading but disables condition removal in read-only encounters", () => {
  setup(undefined, true);
  for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
  act(() => { availableWidth = 80; resize(); });
  fireEvent.mouseEnter(screen.getByRole("img", { name: "Goblin conditions" }));
  for (const button of within(screen.getByRole("tooltip")).getAllByRole("button")) expect(button).toBeDisabled();
  expect(store.getState().encounter.past).toHaveLength(0);
});

it("shows no condition affordance for an actor with none", () => {
  setup([]);
  expect(screen.queryByLabelText("Goblin conditions")).not.toBeInTheDocument();
  expect(screen.getByText("Goblin")).toBeInTheDocument();
});


it("uses the shared popup for individual keyboard focus and allows clicking its pill", async () => {
  setup(["blinded"]);
  const icon = screen.getByRole("button", { name: "Remove Blinded from Goblin" });
  fireEvent.focus(icon);
  const tooltip = screen.getByRole("tooltip");
  expect(tooltip.parentElement).toBe(document.body);
  const pill = within(tooltip).getByRole("button", { name: "Remove Blinded from Goblin" });
  fireEvent.blur(icon, { relatedTarget: pill });
  expect(screen.getByRole("tooltip")).toBeInTheDocument();
  fireEvent.click(pill);
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  await waitFor(() => expect(store.getState().encounter.present.actors.byId.a.statusEffects).toEqual([]));
});
