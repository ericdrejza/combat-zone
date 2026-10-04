import { act, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { createEncounterState } from "@core/encounter/createEncounterState";
import { createActor } from "@entities/actor/actorMutations";
import { DEFAULT_COMBAT_RULES } from "@entities/actor/actorResources";
import { adjustHitPoints, saveCounter, updateSelectedActors } from "@entities/actor/statusMutations";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { InMemoryWorkspaceRepository, LOCAL_RESET_MARKER_KEY } from "@core/persistence";
import { store } from "@store/store";
import { resetAppStore } from "@tests/ui/renderApp";
import { commitEncounterChange, undoEncounterChange, redoEncounterChange } from "@store/encounterSlice";
import { PersistenceProvider, usePersistence } from "@ui/persistence/PersistenceProvider";
import { COMBAT_PREFERENCES_STORAGE_KEY } from "@ui/combat_preferences/CombatPreferenceProvider";

function Probe() {
  const persistence = usePersistence();
  return <><span>{persistence.initialized ? "Ready" : "Loading"}</span><button onClick={() => void persistence.save()} type="button">Save resources</button><button onClick={() => void persistence.loadEncounter("other")} type="button">Load other</button></>;
}
function mount(repository: InMemoryWorkspaceRepository) {
  resetAppStore();
  return render(<Provider store={store}><PersistenceProvider repository={repository}><Probe /></PersistenceProvider></Provider>);
}
async function resourceRepository() {
  const repository = new InMemoryWorkspaceRepository();
  let state = createActor(createEncounterState({ id: "resources", name: "Resources" }), { id: "a", currentZoneId: "zoneless" });
  state.actors.byId.a.hitPoints = { current: 20, maximum: 20 };
  state = updateSelectedActors(state, ["a"], (actor) => saveCounter(actor, { id: "c", name: "Charges", value: 2, maximum: 3 }));
  await repository.createEncounter(state, "encounters-root");
  await repository.createEncounter(createEncounterState({ id: "other", name: "Other" }), "encounters-root");
  const manifest = await repository.getManifest();
  await repository.saveManifest({ ...manifest, activeEncounterId: "resources" });
  return { repository, state };
}
afterEach(() => { localStorage.removeItem(COMBAT_PREFERENCES_STORAGE_KEY); localStorage.removeItem(LOCAL_RESET_MARKER_KEY); });

describe("Status resource autosave and recovery", () => {
  it("autosaves HP and health atomically, saves undo/redo, flushes before navigation and reloads fresh history", async () => {
    const { repository, state } = await resourceRepository();
    const view = mount(repository);
    await screen.findByText("Ready");
    const rules = { ...DEFAULT_COMBAT_RULES, automaticHealth: true, thresholds: [0, 5, 10] as [number, number, number] };
    const next = adjustHitPoints(state, ["a"], -20, rules);
    act(() => store.dispatch(commitEncounterChange({ action: createEncounterActionRecord("actor.adjustHitPoints"), nextEncounter: next })));
    await waitFor(async () => expect((await repository.getEncounter("resources"))?.state.actors.byId.a).toEqual(next.actors.byId.a), { timeout: 1500 });
    act(() => store.dispatch(undoEncounterChange()));
    await waitFor(async () => expect((await repository.getEncounter("resources"))?.state.actors.byId.a).toEqual(state.actors.byId.a), { timeout: 1500 });
    act(() => store.dispatch(redoEncounterChange()));
    await act(async () => screen.getByRole("button", { name: "Save resources" }).click());
    expect((await repository.getEncounter("resources"))?.state.actors.byId.a).toEqual(next.actors.byId.a);
    act(() => store.dispatch(commitEncounterChange({ action: createEncounterActionRecord("actor.adjustHitPoints"), nextEncounter: adjustHitPoints(next, ["a"], 6, rules) })));
    await act(async () => screen.getByRole("button", { name: "Load other" }).click());
    expect((await repository.getEncounter("resources"))?.state.actors.byId.a.hitPoints?.current).toBe(6);
    expect(store.getState().encounter.past).toHaveLength(0);
    view.unmount();
    const manifest = await repository.getManifest();
    await repository.saveManifest({ ...manifest, activeEncounterId: "resources" });
    mount(repository); await screen.findByText("Ready");
    expect(store.getState().encounter.present.actors.byId.a.hitPoints?.current).toBe(6);
    expect(store.getState().encounter.present.actors.byId.a.counters?.byId.c.value).toBe(2);
    expect(store.getState().encounter.past).toHaveLength(0);
  });
  it("recovers configured resources from an unsaved draft", async () => {
    const { repository, state } = await resourceRepository();
    await repository.saveManifest({ ...(await repository.getManifest()), activeEncounterId: null });
    await repository.saveRecoveryDraft(state);
    mount(repository); await screen.findByText("Ready");
    expect(store.getState().encounter.present.actors.byId.a).toEqual(state.actors.byId.a);
    expect(store.getState().encounter.past).toHaveLength(0);
  });
  it("clears Combat preferences during interrupted reset recovery", async () => {
    const repository = new InMemoryWorkspaceRepository();
    localStorage.setItem(COMBAT_PREFERENCES_STORAGE_KEY, "{}");
    localStorage.setItem(LOCAL_RESET_MARKER_KEY, "true");
    mount(repository); await screen.findByText("Ready");
    expect(localStorage.getItem(COMBAT_PREFERENCES_STORAGE_KEY)).toBeNull();
  });
});
