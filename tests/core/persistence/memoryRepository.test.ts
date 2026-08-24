import { createEncounterState } from "@core/encounter/createEncounterState";
import {
  InMemoryWorkspaceRepository,
  LOCAL_RESET_MARKER_KEY,
  RevisionConflictError,
  createEmptyLibraryState,
  recoverInterruptedLocalReset,
  resetLocalPersistence
} from "@core/persistence";

const state = (id: string) => createEncounterState({ id, name: id });

describe("InMemoryWorkspaceRepository", () => {
  it("round-trips an encounter and enforces revision checks", async () => {
    const repository = new InMemoryWorkspaceRepository();
    const created = await repository.createEncounter(state("one"));
    const updated = await repository.saveEncounter({ ...created.state, name: "changed" }, { expectedRevision: 0 });
    expect(updated.revision).toBe(1);
    await expect(repository.saveEncounter(updated.state, { expectedRevision: 0 })).rejects.toBeInstanceOf(RevisionConflictError);
    expect((await repository.getEncounter("one"))?.state.name).toBe("changed");
  });

  it("duplicates, moves, and exports all records without sharing mutable objects", async () => {
    const repository = new InMemoryWorkspaceRepository();
    await repository.createEncounter(state("one"), "encounters-root");
    const copy = await repository.duplicateEncounter("one");
    await repository.moveEncounter(copy.id, null);
    const exported = await repository.exportWorkspace();
    expect(exported.workspace.encounters).toHaveLength(2);
    exported.workspace.encounters[0].state.name = "mutated export";
    expect((await repository.getEncounter("one"))?.state.name).toBe("one");
  });

  it("round-trips every encounter entity type and embedded image data", async () => {
    const repository = new InMemoryWorkspaceRepository();
    const encounter = state("complete");
    encounter.backgroundImage = {
      dataUrl: "data:image/png;base64,bWFw",
      height: 480,
      mediaType: "image/png",
      name: "map.png",
      width: 640
    };
    encounter.zones = {
      allIds: ["zone"],
      byId: {
        zone: {
          autoResize: false,
          colorBorder: "#000000",
          colorFill: "#ffffff",
          id: "zone",
          layoutOrientation: "LEFT_RIGHT",
          layoutStrategy: "FLEX",
          name: "Zone",
          namePosition: "top-left",
          opacity: 1,
          polygon: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }],
          shape: "polygon",
          showBorder: true,
          showName: true,
          tags: []
        }
      }
    };
    encounter.actors = {
      allIds: ["actor"],
      byId: {
        actor: {
          actorType: "creature",
          currentZoneId: "zone",
          id: "actor",
          image: "data:image/png;base64,dG9rZW4=",
          layoutGroup: "hero",
          metadata: {},
          name: "Actor",
          shape: "circle",
          size: "medium",
          statusEffects: []
        }
      }
    };
    encounter.edges = {
      allIds: ["edge"],
      byId: {
        edge: {
          directionality: "bilateral",
          fromZoneId: "zone",
          id: "edge",
          interactionTags: [],
          movementRules: [],
          shape: "straight",
          toZoneId: "zone",
          visibilityRule: "visible"
        }
      }
    };
    encounter.engagements = {
      allIds: ["engagement"],
      byId: {
        engagement: {
          id: "engagement",
          layoutOrientation: "LEFT_RIGHT",
          layoutStrategy: "FLEX",
          parentZoneId: "zone",
          participantIds: ["actor", "actor-two"]
        }
      }
    };
    encounter.annotations = {
      allIds: ["annotation"],
      byId: {
        annotation: {
          id: "annotation",
          kind: "gmNote",
          label: "Secret",
          metadata: {}
        }
      }
    };

    await repository.createEncounter(encounter);
    expect((await repository.getEncounter(encounter.id))?.state).toEqual(encounter);
  });

  it("retains an import backup until a complete local reset", async () => {
    const repository = new InMemoryWorkspaceRepository();
    await repository.createEncounter(state("backup"));
    const exported = await repository.exportWorkspace();
    await repository.saveBackup(exported);
    expect(await repository.getLatestBackup()).toEqual(exported);

    await repository.clearLocalData();
    expect(await repository.getLatestBackup()).toBeNull();
    expect(await repository.listEncounters()).toEqual([]);
  });

  it("recovers an interrupted reset without clearing unrelated preferences", async () => {
    const repository = new InMemoryWorkspaceRepository();
    await repository.createEncounter(state("old"));
    localStorage.setItem(LOCAL_RESET_MARKER_KEY, "true");
    localStorage.setItem("combat-zone.test-preference", "set");
    localStorage.setItem("unrelated-origin-key", "keep");

    expect(
      await recoverInterruptedLocalReset(repository, [
        "combat-zone.test-preference"
      ])
    ).toBe(true);
    expect(await repository.listEncounters()).toEqual([]);
    expect(localStorage.getItem("combat-zone.test-preference")).toBeNull();
    expect(localStorage.getItem("unrelated-origin-key")).toBe("keep");

    await resetLocalPersistence(repository, state("fresh"), []);
    expect((await repository.getRecoveryDraft())?.state.id).toBe("fresh");
    localStorage.removeItem("unrelated-origin-key");
  });

  it("merges imported encounters while retaining current library records", async () => {
    const current = new InMemoryWorkspaceRepository();
    await current.createEncounter(state("current"));
    const currentLibrary = createEmptyLibraryState();
    currentLibrary.sections.backgrounds.nodesById["current-folder"] = {
      id: "current-folder", name: "Current", parentId: "backgrounds-root", sectionId: "backgrounds", type: "folder", childIds: []
    };
    await current.saveLibrary(currentLibrary);

    const imported = new InMemoryWorkspaceRepository();
    const importedLibrary = createEmptyLibraryState();
    importedLibrary.sections.encounters.nodesById["import-folder"] = {
      id: "import-folder", name: "Imported", parentId: "encounters-root", sectionId: "encounters", type: "folder", childIds: []
    };
    await imported.saveLibrary(importedLibrary);
    await imported.createEncounter(state("imported"), "import-folder");
    const envelope = await imported.exportWorkspace();

    await current.importWorkspace(envelope, "merge");
    expect((await current.listEncounters()).map((record) => record.state.id)).toEqual(["current", "imported-copy"]);
    const mergedLibrary = (await current.getLibrary()).state;
    expect(Object.values(mergedLibrary.sections.backgrounds.nodesById).some((node) => node.id === "current-folder")).toBe(true);
    expect(Object.values(mergedLibrary.sections.encounters.nodesById).some((node) => node.name === "Imported")).toBe(true);
    expect(
      (await current.listEncounters()).find(
        (record) => record.state.id === "imported-copy"
      )?.folderId
    ).toBe(
      Object.values(mergedLibrary.sections.encounters.nodesById).find(
        (node) => node.name === "Imported"
      )?.id
    );
  });
});
