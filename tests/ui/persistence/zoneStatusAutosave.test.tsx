import { act, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { createEncounterState } from "@core/encounter/createEncounterState";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { InMemoryWorkspaceRepository } from "@core/persistence";
import { createZone } from "@entities/zone/zoneMutations";
import { saveZoneClock, saveZoneCounter, updateZoneStatus } from "@entities/zone/zoneStatus";
import { commitEncounterChange, undoEncounterChange, redoEncounterChange } from "@store/encounterSlice";
import { store } from "@store/store";
import { resetAppStore } from "@tests/ui/renderApp";
import { PersistenceProvider, usePersistence } from "@ui/persistence/PersistenceProvider";

function Probe() {
  const persistence = usePersistence();
  return <><span>{persistence.initialized ? "Ready" : "Loading"}</span>
    <button onClick={() => void persistence.save()} type="button">Save</button>
    <button onClick={() => void persistence.loadEncounter("other")} type="button">Load other</button></>;
}
function mount(repository: InMemoryWorkspaceRepository) {
  resetAppStore();
  return render(<Provider store={store}><PersistenceProvider repository={repository}><Probe /></PersistenceProvider></Provider>);
}
async function fixture() {
  const repository = new InMemoryWorkspaceRepository();
  const state = createZone(createEncounterState({ id: "zone-resources", name: "Resources" }), { id: "z", polygon: [{ x: 20, y: 20 }, { x: 320, y: 20 }, { x: 320, y: 320 }, { x: 20, y: 320 }] });
  const configured = updateZoneStatus(state, "z", (zone) => ({ ...saveZoneClock(saveZoneCounter(zone, { id: "c", name: "Water", value: 2, maximum: 5 }), { id: "k", name: "Alarm", value: 1, segments: 4 }), tags: ["hazard"], notes: "Secret" }));
  await repository.createEncounter(configured, "encounters-root");
  await repository.createEncounter(createEncounterState({ id: "other", name: "Other" }), "encounters-root");
  await repository.saveManifest({ ...(await repository.getManifest()), activeEncounterId: configured.id });
  return { repository, state: configured };
}
it("autosaves Zone status and undo/redo, explicitly saves, flushes navigation, and loads fresh history", async () => {
  const { repository, state } = await fixture();
  const view = mount(repository); await screen.findByText("Ready");
  const changed = updateZoneStatus(state, "z", (zone) => ({ ...saveZoneClock(saveZoneCounter(zone, { ...zone.counters!.byId.c, value: 3 }), { ...zone.clocks!.byId.k, value: 2 }), tags: ["hazard", "dark"], notes: "  Secret\nexit " }));
  act(() => store.dispatch(commitEncounterChange({ action: createEncounterActionRecord("zone.editClocks"), nextEncounter: changed })));
  await waitFor(async () => expect((await repository.getEncounter(state.id))?.state.zones).toEqual(changed.zones), { timeout: 1500 });
  act(() => store.dispatch(undoEncounterChange()));
  await waitFor(async () => expect((await repository.getEncounter(state.id))?.state.zones).toEqual(state.zones), { timeout: 1500 });
  act(() => store.dispatch(redoEncounterChange()));
  await act(async () => screen.getByRole("button", { name: "Save" }).click());
  expect((await repository.getEncounter(state.id))?.state.zones).toEqual(changed.zones);
  const final = updateZoneStatus(changed, "z", (zone) => ({ ...zone, notes: "Final note" }));
  act(() => store.dispatch(commitEncounterChange({ action: createEncounterActionRecord("zone.setNotes"), nextEncounter: final })));
  await act(async () => screen.getByRole("button", { name: "Load other" }).click());
  expect((await repository.getEncounter(state.id))?.state.zones).toEqual(final.zones);
  expect(store.getState().encounter.past).toHaveLength(0);
  view.unmount();
  await repository.saveManifest({ ...(await repository.getManifest()), activeEncounterId: state.id });
  mount(repository); await screen.findByText("Ready");
  expect(store.getState().encounter.present.zones).toEqual(final.zones);
  expect(store.getState().encounter.past).toHaveLength(0);
});
it("recovers all Zone status fields from a draft with fresh history", async () => {
  const { repository, state } = await fixture();
  await repository.saveManifest({ ...(await repository.getManifest()), activeEncounterId: null });
  await repository.saveRecoveryDraft(state);
  mount(repository); await screen.findByText("Ready");
  expect(store.getState().encounter.present.zones).toEqual(state.zones);
  expect(store.getState().encounter.past).toHaveLength(0);
});
