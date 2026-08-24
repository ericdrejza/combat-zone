import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { createFolder } from "@library/librarySlice";
import { commitEncounterChange, resetEncounterState } from "@store/encounterSlice";
import {
  setPersistenceWritable
} from "@store/persistenceWriteGuardMiddleware";
import { store } from "@store/store";

describe("persistence writer guard", () => {
  afterEach(() => setPersistenceWritable(true));

  it("blocks encounter and library mutations in a read-only tab", () => {
    store.dispatch(resetEncounterState());
    const before = store.getState();
    setPersistenceWritable(false);
    store.dispatch(
      commitEncounterChange({
        action: createEncounterActionRecord("test.rename", { name: "Blocked" }),
        nextEncounter: { ...before.encounter.present, name: "Blocked" }
      })
    );
    store.dispatch(
      createFolder({
        name: "Blocked",
        parentId: "encounters-root",
        sectionId: "encounters"
      })
    );

    expect(store.getState().encounter.present.name).toBe(
      before.encounter.present.name
    );
    expect(
      Object.values(store.getState().library.sections.encounters.nodesById)
    ).not.toContainEqual(expect.objectContaining({ name: "Blocked" }));
  });
});
