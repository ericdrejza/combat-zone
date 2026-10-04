import { createEncounterState } from "@core/encounter/createEncounterState";
import { createZone } from "@entities/zone/zoneMutations";
import { saveZoneClock, saveZoneCounter, updateZoneStatus } from "@entities/zone/zoneStatus";
import { assertEncounterState, migrateEncounterState, parseExportEnvelope } from "@core/persistence/envelope";
import { EXPORT_SCHEMA_VERSION } from "@core/persistence/types";
import { hydrateEncounterRecord, hydrateRecoveryDraft } from "@core/persistence/hydratePersistedRecords";
import { InMemoryWorkspaceRepository, createEmptyLibraryState } from "@core/persistence/memoryRepository";
import { serializeEncounterForCloud, type CloudAssetRepository } from "@core/persistence/cloud";
import { parseCloudWorkspace } from "@core/persistence/cloud/cloudRecords";
import { validateEncounter, CLOUD_RECORD_SCHEMA_VERSION } from "@combat-zone/firebase-api";

function currentState() {
  const state = createZone(createEncounterState({ id: "zone-resources", name: "Resources" }), { id: "z", name: "Hall", polygon: [{ x: 20, y: 20 }, { x: 320, y: 20 }, { x: 320, y: 320 }, { x: 20, y: 320 }] });
  return updateZoneStatus(state, "z", (zone) => ({ ...saveZoneClock(saveZoneCounter(zone, { id: "c", name: "Water", value: -3, minimum: -4, maximum: 10 }), { id: "k", name: "Alarm", value: 3, segments: 5 }), tags: ["hazard", "old, comma tag", "hazard"], notes: "  Secret\nexit " }));
}
function payload(state = currentState()) {
  return JSON.parse(JSON.stringify({ schemaVersion: CLOUD_RECORD_SCHEMA_VERSION, encounterId: state.id, folderId: null, assetIds: [], state }));
}

describe("Zone status persistence", () => {
  it.each([12, 13])("migrates schema %s without altering old tags or mutating input", (schemaVersion) => {
    const legacy = { ...currentState(), schemaVersion };
    delete legacy.zones.byId.z.counters; delete legacy.zones.byId.z.clocks; delete legacy.zones.byId.z.notes;
    const before = structuredClone(legacy);
    const migrated = migrateEncounterState(legacy);
    assertEncounterState(migrated);
    expect(migrated.schemaVersion).toBe(15);
    expect(migrated.zones.byId.z).toMatchObject({ counters: { allIds: [], byId: {} }, clocks: { allIds: [], byId: {} }, tags: before.zones.byId.z.tags });
    expect(migrated.zones.byId.z.notes).toBeUndefined(); expect(legacy).toEqual(before);
  });
  it("migrates schema 14 clocks to Traditional independently of new-clock preferences", () => {
    const legacy = { ...currentState(), schemaVersion: 14 };
    delete legacy.zones.byId.z.clocks!.byId.k.style;
    const before = structuredClone(legacy);
    const migrated = migrateEncounterState(legacy);
    assertEncounterState(migrated);
    expect(migrated.zones.byId.z.clocks!.byId.k).toEqual({ ...before.zones.byId.z.clocks!.byId.k, style: "traditional" });
    expect(legacy).toEqual(before);
  });
  it.each(["traditional", "linear"] as const)("round trips %s clock styles locally and through cloud serialization", async (style) => {
    const state = currentState(); state.zones.byId.z.clocks!.byId.k.style = style;
    const repository = new InMemoryWorkspaceRepository();
    const saved = await repository.createEncounter(state);
    await repository.saveRecoveryDraft(state);
    expect((await repository.getRecoveryDraft())?.state.zones.byId.z.clocks!.byId.k.style).toBe(style);
    expect((await repository.exportEncounter(saved.id)).encounter.zones.byId.z.clocks!.byId.k.style).toBe(style);
    const wire = await serializeEncounterForCloud({ state, updatedAt: 1 }, { ensureUploaded: vi.fn() } as unknown as CloudAssetRepository);
    expect(validateEncounter(payload(wire.state as never)).state).toMatchObject({ zones: state.zones });
  });
  it("round trips exports, records and recovery snapshots losslessly", () => {
    const state = currentState();
    const envelope = { kind: "encounter-export", schemaVersion: EXPORT_SCHEMA_VERSION, exportedAt: 1, encounter: state, library: createEmptyLibraryState() };
    expect(parseExportEnvelope(JSON.parse(JSON.stringify(envelope)))).toEqual(envelope);
    expect(hydrateEncounterRecord({ id: state.id, state, revision: 0, createdAt: 1, updatedAt: 1, folderId: null }).state).toEqual(state);
    expect(hydrateRecoveryDraft({ state, updatedAt: 1 }).state).toEqual(state);
  });
  it.each([
    { segments: 0 }, { segments: 13 }, { segments: 3.5 }, { value: -1 }, { value: 6 }, { value: 1.5 }, { name: " " }, { id: "other" }, { style: "unknown" }, { style: null }
  ])("rejects malformed clocks locally and in cloud contracts: %j", (properties) => {
    const state = currentState();
    Object.assign(state.zones.byId.z.clocks!.byId.k, properties);
    expect(() => assertEncounterState(state)).toThrow(/zone resources/);
    expect(() => validateEncounter(payload(state))).toThrow(/clock/);
  });
  it("rejects malformed collections, counter bounds, notes and tag types", () => {
    for (const properties of [
      { clocks: { allIds: ["k", "k"], byId: {} } },
      { clocks: { allIds: [], byId: { k: { id: "k" } } } },
      { counters: { allIds: ["c"], byId: { c: { id: "c", name: "Water", value: 5, maximum: 3 } } } },
      { notes: 123 }, { tags: [123] }
    ]) {
      const state = currentState(); Object.assign(state.zones.byId.z, properties);
      expect(() => assertEncounterState(state)).toThrow(/zone resources/);
      expect(() => validateEncounter(payload(state))).toThrow(/Zone/);
    }
  });
  it("preserves saved state on validation failure, revision conflict, and unsupported schemas", async () => {
    const repository = new InMemoryWorkspaceRepository();
    const record = await repository.createEncounter(currentState());
    const invalid = currentState(); invalid.zones.byId.z.clocks!.byId.k.segments = 13;
    await expect(repository.saveEncounter(invalid, { expectedRevision: record.revision })).rejects.toThrow(/zone resources/);
    await expect(repository.saveEncounter(currentState(), { expectedRevision: record.revision + 1 })).rejects.toThrow();
    expect((await repository.getEncounter(record.id))?.state).toEqual(record.state);
    const newer = { ...record.state, schemaVersion: 16 };
    expect(() => assertEncounterState(newer)).toThrow(/unsupported/);
    expect(() => validateEncounter(payload(newer as never))).toThrow(/unsupported/);
  });
  it("retains resources through save, draft, merge import and overwrite backup", async () => {
    const repository = new InMemoryWorkspaceRepository();
    const record = await repository.createEncounter(currentState());
    await repository.saveRecoveryDraft(record.state);
    expect((await repository.getRecoveryDraft())?.state.zones).toEqual(record.state.zones);
    const target = new InMemoryWorkspaceRepository();
    await target.importWorkspace(await repository.exportWorkspace(), "merge");
    expect((await target.listEncounters())[0].state.zones).toEqual(record.state.zones);
    await target.importWorkspace(await repository.exportWorkspace(), "overwrite");
    expect((await target.listEncounters())[0].state.zones).toEqual(record.state.zones);
    expect((await repository.exportEncounter(record.id)).encounter.zones).toEqual(record.state.zones);
  });
  it("serializes schema 14 resources and retains schema 7/13 API compatibility", async () => {
    const state = currentState();
    const ensureUploaded = vi.fn();
    const serialized = await serializeEncounterForCloud({ state, updatedAt: 1 }, { ensureUploaded } as unknown as CloudAssetRepository);
    const wire = payload(serialized.state as never);
    expect(validateEncounter(wire)).toEqual(wire);
    expect(serialized.state.zones).toEqual(state.zones); expect(ensureUploaded).not.toHaveBeenCalled();
    const old = payload(); old.state.schemaVersion = 13; expect(validateEncounter(old)).toEqual(old);
    old.state.schemaVersion = 7; old.state.panelLayout.right = old.state.panelLayout.right.filter((panel: { id: string }) => panel.id !== "audio");
    expect(validateEncounter(old)).toEqual(old);
  });
  it("migrates cloud encounter and recovery records before local use", () => {
    const state = currentState();
    const snapshot = parseCloudWorkspace({ workspace: { schemaVersion: CLOUD_RECORD_SCHEMA_VERSION, revision: 1, updatedAt: 1 },
      encounters: [{ schemaVersion: CLOUD_RECORD_SCHEMA_VERSION, encounterId: state.id, state, folderId: null, revision: 1, createdAt: 1, updatedAt: 1 }],
      library: { schemaVersion: CLOUD_RECORD_SCHEMA_VERSION, state: createEmptyLibraryState(), revision: 1, updatedAt: 1 },
      recoveryDraft: { schemaVersion: CLOUD_RECORD_SCHEMA_VERSION, state, updatedAt: 1 } });
    expect(snapshot.encounters[0].state.zones).toEqual(state.zones);
    expect(snapshot.recoveryDraft?.state.zones).toEqual(state.zones);
  });
});
