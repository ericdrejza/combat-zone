import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { setActiveTool, selectEntity } from "@interaction/interactionState";
import { store } from "@store/store";
import { resetAppStore } from "@tests/ui/renderApp";
import { ZonelessActorPanel } from "@ui/panels/zoneless_actors/ZonelessActorPanel";
import { CompactZonelessActorPanel } from "@ui/panels/zoneless_actors/CompactZonelessActorPanel";
import { InterfacePreferenceProvider } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { actor, seedEncounter, zone, dataTransfer } from "./ZonelessActorPanel.test_support";

function setup(compact: boolean) {
  resetAppStore();
  seedEncounter([actor("z", "Zephyr"), actor("a", "Aria"), actor("e", "Enemy", "enemy"),
    { ...actor("canvas", "Canvas hero"), currentZoneId: "zone-target" }], [zone()]);
  store.dispatch(setActiveTool("actor"));
  render(<Provider store={store}><InterfacePreferenceProvider>{compact ? <CompactZonelessActorPanel /> :
    <ZonelessActorPanel canvasBackgroundLuminance={0.5}
      isActorDragActive={false} onActorCreationDragOver={() => {}} onActorCreationDrop={() => {}} />}
  </InterfacePreferenceProvider></Provider>);
  if (!compact) fireEvent.click(screen.getByRole("button", { name: "Expand zoneless actors" }));
}

describe.each([false, true])("Zoneless selection (compact=%s)", compact => {
  it("replaces mixed selection with a faction, preserves it on repeated activation, and selects all listed actors", async () => {
    setup(compact);
    const user = userEvent.setup();
    act(() => { store.dispatch(selectEntity({ entityType: "actor", ids: ["canvas", "e"] })); });
    const before = store.getState().encounter;
    const faction = screen.getByRole("button", { name: "Select all Hero Zoneless actors" });
    faction.focus();
    await user.keyboard("{Enter}");
    expect(store.getState().interaction.selection.selectedIds).toEqual(["a", "z"]);
    await user.keyboard(" ");
    expect(store.getState().interaction.selection.selectedIds).toEqual(["a", "z"]);
    expect(screen.getByRole("button", { name: "Aria" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Select all Zoneless actors" }));
    expect(store.getState().interaction.selection.selectedIds).toEqual(["a", "e", "z"]);
    expect(store.getState().encounter).toBe(before);
  });

  it("drags only selected panel actors in stable panel order", () => {
    setup(compact);
    act(() => { store.dispatch(selectEntity({ entityType: "actor", ids: ["canvas", "z", "a"] })); });
    const transfer = dataTransfer();
    fireEvent.dragStart(screen.getByRole("button", { name: "Aria" }), { dataTransfer: transfer });
    expect(transfer.getData("application/x-combat-zone-zoneless-actors")).toBe("a,z");
  });

  it("disables group selection for unsupported tools and Select All for an empty collection", () => {
    setup(compact);
    act(() => { store.dispatch(setActiveTool("zone")); });
    expect(screen.getByRole("button", { name: "Select all Hero Zoneless actors" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Select all Zoneless actors" })).toBeDisabled();
    act(() => { seedEncounter([]); store.dispatch(setActiveTool("actor")); });
    expect(screen.getByRole("button", { name: "Select all Zoneless actors" })).toBeDisabled();
  });
});
