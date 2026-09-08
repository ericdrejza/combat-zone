import { act, render, screen, waitFor } from "@testing-library/react";
import { Provider, useSelector } from "react-redux";

import { createEncounterState } from "@core/encounter/createEncounterState";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { InMemoryWorkspaceRepository } from "@core/persistence";
import { commitEncounterChange, resetEncounterState } from "@store/encounterSlice";
import { resetEncounterLog } from "@store/encounterLogSlice";
import type { RootState } from "@store/store";
import { store } from "@store/store";
import {
  PersistenceProvider,
  usePersistence
} from "@ui/persistence/PersistenceProvider";
import { MOTION_OVERRIDE_STORAGE_KEY } from "@ui/motion_preferences/MotionPreferenceProvider";
import { THEME_STORAGE_KEY } from "@ui/theme/ThemeProvider";
import { INTERFACE_PREFERENCES_STORAGE_KEY } from "@ui/interface_preferences/InterfacePreferenceProvider";

function Probe() {
  const persistence = usePersistence();
  const name = useSelector((state: RootState) => state.encounter.present.name);
  return (
    <div>
      <span>{name}</span>
      <span>{persistence.saveStatus}</span>
      <button onClick={() => void persistence.resetLocalData()} type="button">
        Reset test data
      </button>
    </div>
  );
}

function renderPersistence(repository: InMemoryWorkspaceRepository) {
  store.dispatch(resetEncounterState());
  store.dispatch(resetEncounterLog());
  return render(
    <Provider store={store}>
      <PersistenceProvider repository={repository}>
        <Probe />
      </PersistenceProvider>
    </Provider>
  );
}

describe("PersistenceProvider", () => {
  afterEach(() => {
    localStorage.removeItem(MOTION_OVERRIDE_STORAGE_KEY);
    localStorage.removeItem(THEME_STORAGE_KEY);
    localStorage.removeItem(INTERFACE_PREFERENCES_STORAGE_KEY);
    localStorage.removeItem("unrelated-origin-key");
  });

  it("restores the active encounter and autosaves only its current state", async () => {
    const repository = new InMemoryWorkspaceRepository();
    const persisted = createEncounterState({ id: "restored", name: "Restored" });
    await repository.initialize();
    await repository.createEncounter(persisted, "encounters-root");
    const manifest = await repository.getManifest();
    await repository.saveManifest({
      ...manifest,
      activeEncounterId: persisted.id,
      revision: 1
    });

    renderPersistence(repository);
    expect(await screen.findByText("Restored")).toBeInTheDocument();

    act(() => {
      store.dispatch(
        commitEncounterChange({
          action: createEncounterActionRecord("test.rename", { name: "Autosaved" }),
          nextEncounter: { ...store.getState().encounter.present, name: "Autosaved" }
        })
      );
    });

    await waitFor(
      async () => {
        expect((await repository.getEncounter("restored"))?.state.name).toBe(
          "Autosaved"
        );
      },
      { timeout: 1500 }
    );
    expect(store.getState().encounter.past).toHaveLength(1);
  });

  it("wipes saved records and starts a new local recovery draft", async () => {
    const repository = new InMemoryWorkspaceRepository();
    await repository.initialize();
    await repository.createEncounter(
      createEncounterState({ id: "old", name: "Old encounter" })
    );
    localStorage.setItem(MOTION_OVERRIDE_STORAGE_KEY, "true");
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    localStorage.setItem(INTERFACE_PREFERENCES_STORAGE_KEY, "{}");
    localStorage.setItem("unrelated-origin-key", "keep");
    renderPersistence(repository);
    await screen.findByText("Untitled Encounter");

    await act(async () => {
      screen.getByRole("button", { name: "Reset test data" }).click();
    });

    await waitFor(async () => {
      expect(await repository.listEncounters()).toEqual([]);
      expect((await repository.getRecoveryDraft())?.state.name).toBe(
        "Untitled Encounter"
      );
      expect(localStorage.getItem(MOTION_OVERRIDE_STORAGE_KEY)).toBeNull();
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
      expect(localStorage.getItem(INTERFACE_PREFERENCES_STORAGE_KEY)).toBeNull();
      expect(localStorage.getItem("unrelated-origin-key")).toBe("keep");
    });
  });
});
