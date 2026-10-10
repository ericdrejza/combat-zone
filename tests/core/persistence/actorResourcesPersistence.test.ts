import { parseCloudWorkspace } from "@core/persistence/cloud/cloudRecords";
import { createEncounterState } from "@core/encounter/createEncounterState";
import { createActor } from "@entities/actor/actorMutations";
import { assertEncounterState, migrateEncounterState } from "@core/persistence/envelope";
import { hydrateEncounterRecord, hydrateRecoveryDraft } from "@core/persistence/hydratePersistedRecords";
import { InMemoryWorkspaceRepository, createEmptyLibraryState } from "@core/persistence/memoryRepository";
import { EXPORT_SCHEMA_VERSION, parseExportEnvelope } from "@core/persistence";
import { serializeEncounterForCloud, type CloudAssetRepository } from "@core/persistence/cloud";
import { validateEncounter, CLOUD_RECORD_SCHEMA_VERSION } from "@combat-zone/firebase-api";

function state() {
  const state = createActor(createEncounterState({ id: "resources", name: "Resources" }), { id: "a", currentZoneId: "zoneless" });
  state.actors.byId.a.hitPoints = { current: -4, maximum: 20 };
  state.actors.byId.a.counters = { allIds: ["c"], byId: { c: { id: "c", name: "Charges", value: 3, minimum: 0, maximum: 5 } } };
  state.actors.byId.a.statusEffects = ["hidden", "unknown-system-condition", "weapon:bow", "armor:light"];
  return state;
}

describe("actor resource persistence", () => {
  it("round trips resources and unknown markers in exports, records, and recovery drafts", () => {
    const current = state();
    const envelope = { kind: "encounter-export", schemaVersion: EXPORT_SCHEMA_VERSION, exportedAt: 1, encounter: current, library: createEmptyLibraryState() };
    expect(parseExportEnvelope(JSON.parse(JSON.stringify(envelope)))).toEqual(envelope);
    expect(hydrateEncounterRecord({ id: current.id, state: current, revision: 0, createdAt: 1, updatedAt: 1, folderId: null }).state).toEqual(current);
    expect(hydrateRecoveryDraft({ state: current, updatedAt: 1 }).state).toEqual(current);
    current.actors.byId.a.hitPoints!.current = 24;
    expect(() => assertEncounterState(current)).not.toThrow();
  });
  it("migrates version 12 without inventing HP or changing source records", () => {
    const legacy = { ...state(), schemaVersion: 12 };
    delete legacy.actors.byId.a.hitPoints;
    delete legacy.actors.byId.a.counters;
    const before = structuredClone(legacy);
    const migrated = migrateEncounterState(legacy);
    assertEncounterState(migrated);
    expect(migrated.schemaVersion).toBe(21);
    expect(migrated.actors.byId.a.hitPoints).toBeUndefined();
    expect(migrated.actors.byId.a.counters).toEqual({ allIds: [], byId: {} });
    expect(legacy).toEqual(before);
  });
  it.each([{ current: 1.5, maximum: 20 }, { current: 3, maximum: 0 }, null, { current: "2", maximum: 20 }])("rejects invalid HP %j", (hp) => {
    const current = state();
    (current.actors.byId.a as unknown as { hitPoints: unknown }).hitPoints = hp;
    expect(() => assertEncounterState(current)).toThrow(/resources/);
  });
  it.each([
    { allIds: ["c", "c"], byId: {} },
    { allIds: ["c"], byId: { c: { id: "wrong", name: "Charges", value: 1 } } },
    { allIds: ["c"], byId: { c: { id: "c", name: " ", value: 1 } } },
    { allIds: ["c"], byId: { c: { id: "c", name: "Charges", value: 9, maximum: 3 } } }
  ])("rejects malformed counters %j", (counters) => {
    const current = state();
    (current.actors.byId.a as unknown as { counters: unknown }).counters = counters;
    expect(() => assertEncounterState(current)).toThrow(/resources/);
  });
  it("preserves saved data after invalid writes and unsupported schema loads", async () => {
    const repository = new InMemoryWorkspaceRepository();
    const initial = state();
    const record = await repository.createEncounter(initial);
    const invalid = structuredClone(initial);
    invalid.actors.byId.a.hitPoints!.maximum = 0;
    await expect(repository.saveEncounter(invalid, { expectedRevision: record.revision })).rejects.toThrow(/resources/);
    expect((await repository.getEncounter(initial.id))?.state).toEqual(initial);
    expect(() => assertEncounterState({ ...initial, schemaVersion: 999 })).toThrow(/unsupported/);
  });
  it("retains resources through repository save, draft, export, and import", async () => {
    const repository = new InMemoryWorkspaceRepository();
    const record = await repository.createEncounter(state());
    await repository.saveRecoveryDraft(record.state);
    expect((await repository.getRecoveryDraft())?.state).toEqual(record.state);
    const exported = await repository.exportEncounter(record.id);
    expect(exported.encounter).toEqual(record.state);
    const target = new InMemoryWorkspaceRepository();
    await target.importWorkspace(await repository.exportWorkspace(), "merge");
    expect((await target.listEncounters())[0].state.actors.byId.a).toEqual(record.state.actors.byId.a);
  });
  it("loads cloud resources and drafts through local validation", () => {
    const current = state();
    const snapshot = parseCloudWorkspace({ workspace: { schemaVersion: CLOUD_RECORD_SCHEMA_VERSION, revision: 1, updatedAt: 1 },
      encounters: [{ schemaVersion: CLOUD_RECORD_SCHEMA_VERSION, encounterId: current.id, state: current, folderId: null, revision: 1, createdAt: 1, updatedAt: 1 }],
      library: { schemaVersion: CLOUD_RECORD_SCHEMA_VERSION, state: createEmptyLibraryState(), revision: 1, updatedAt: 1 },
      recoveryDraft: { schemaVersion: CLOUD_RECORD_SCHEMA_VERSION, state: current, updatedAt: 1 } });
    expect(snapshot.encounters[0].state).toEqual(current);
    expect(snapshot.recoveryDraft?.state).toEqual(current);
  });
  it("rejects malformed schema 13 resources at the cloud API boundary", () => {
    const current = state();
    current.actors.byId.a.hitPoints!.maximum = 0;
    const payload = JSON.parse(JSON.stringify({ schemaVersion: CLOUD_RECORD_SCHEMA_VERSION, encounterId: current.id, folderId: null, assetIds: [], state: current }));
    expect(() => validateEncounter(payload)).toThrow(/hit points/);
  });
  it("serializes schema 13 resources for the cloud API without uploading nonexistent assets", async () => {
    const ensureUploaded = vi.fn();
    const serialized = await serializeEncounterForCloud({ state: state(), updatedAt: 1 }, { ensureUploaded } as unknown as CloudAssetRepository);
    const payload = { schemaVersion: CLOUD_RECORD_SCHEMA_VERSION, encounterId: "resources", folderId: null, ...serialized };
    const jsonPayload = JSON.parse(JSON.stringify(payload));
    expect(validateEncounter(jsonPayload)).toEqual(jsonPayload);
    expect(serialized.state.actors.byId.a).toEqual(state().actors.byId.a);
    expect(ensureUploaded).not.toHaveBeenCalled();
  });
});
