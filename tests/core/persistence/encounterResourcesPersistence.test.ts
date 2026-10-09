import { createEncounterState } from "@core/encounter/createEncounterState";
import { ENCOUNTER_SCHEMA_VERSION } from "@core/encounter/types";
import { saveResourceClock, saveResourceCounter } from "@core/entity_resources/statusResources";
import { assertEncounterState, migrateEncounterState, parseExportEnvelope } from "@core/persistence/envelope";
import { EXPORT_SCHEMA_VERSION } from "@core/persistence/types";
import { hydrateEncounterRecord, hydrateRecoveryDraft } from "@core/persistence/hydratePersistedRecords";
import { InMemoryWorkspaceRepository, createEmptyLibraryState } from "@core/persistence/memoryRepository";
import { serializeEncounterForCloud, type CloudAssetRepository } from "@core/persistence/cloud";
import { validateEncounter, CLOUD_RECORD_SCHEMA_VERSION } from "@combat-zone/firebase-api";

const state = () => saveResourceClock(saveResourceCounter(createEncounterState({ id: "e", name: "Encounter" }), { id: "c", name: "Supplies", value: -2, minimum: -3, maximum: 9 }), { id: "k", name: "Alarm", value: 3, segments: 5, style: "box" });
const payload = (encounter: unknown) => JSON.parse(JSON.stringify({ schemaVersion: CLOUD_RECORD_SCHEMA_VERSION, encounterId: "e", folderId: null, assetIds: [], state: encounter }));

it.each([13, 14, 15])("migrates schema %s to empty encounter resources without changing input", (schemaVersion) => {
  const legacy = { ...state(), schemaVersion } as Record<string, unknown>;
  delete legacy.counters; delete legacy.clocks;
  const before = structuredClone(legacy);
  const migrated = migrateEncounterState(legacy);
  assertEncounterState(migrated);
  expect(migrated).toMatchObject({ schemaVersion: ENCOUNTER_SCHEMA_VERSION, counters: { allIds: [], byId: {} }, clocks: { allIds: [], byId: {} } });
  expect(legacy).toEqual(before);
});

it("round trips records, recovery, exports, duplicate and workspace imports losslessly", async () => {
  const encounter = state();
  const repository = new InMemoryWorkspaceRepository();
  const saved = await repository.createEncounter(encounter);
  await repository.saveRecoveryDraft(encounter);
  expect((await repository.getEncounter(saved.id))?.state).toEqual(encounter);
  expect((await repository.getRecoveryDraft())?.state).toEqual(encounter);
  const exported = await repository.exportEncounter(saved.id);
  expect(parseExportEnvelope(JSON.parse(JSON.stringify(exported)))).toEqual(exported);
  expect(hydrateEncounterRecord(saved).state).toEqual(encounter);
  expect(hydrateRecoveryDraft({ state: encounter, updatedAt: 1 }).state).toEqual(encounter);
  const copy = await repository.duplicateEncounter(saved.id);
  expect(copy.state.counters).toEqual(encounter.counters); expect(copy.state.clocks).toEqual(encounter.clocks);
  const target = new InMemoryWorkspaceRepository();
  for (const mode of ["merge", "overwrite"] as const) {
    await target.importWorkspace(await repository.exportWorkspace(), mode);
    expect((await target.listEncounters())[0].state.clocks).toEqual(encounter.clocks);
    expect((await target.listEncounters())[0].state.counters).toEqual(encounter.counters);
  }
});

it.each([
  { segments: 0 }, { segments: 13 }, { segments: 2.5 }, { value: -1 }, { value: 6 }, { style: "unknown" }, { name: " " }
])("rejects malformed encounter clocks locally and in cloud contracts: %j", (properties) => {
  const encounter = state(); Object.assign(encounter.clocks.byId.k, properties);
  expect(() => assertEncounterState(encounter)).toThrow(/encounter resources/);
  expect(() => validateEncounter(payload(encounter))).toThrow(/clock/);
});

it("preserves the last saved encounter on invalid writes, conflicts, and newer schemas", async () => {
  const repository = new InMemoryWorkspaceRepository();
  const saved = await repository.createEncounter(state());
  const invalid = state(); invalid.counters.byId.c.maximum = -4;
  await expect(repository.saveEncounter(invalid, { expectedRevision: saved.revision })).rejects.toThrow(/encounter resources/);
  expect(() => validateEncounter(payload(invalid))).toThrow(/counter/);
  await expect(repository.saveEncounter(state(), { expectedRevision: saved.revision + 1 })).rejects.toThrow();
  expect((await repository.getEncounter(saved.id))?.state).toEqual(saved.state);
  const future = { ...state(), schemaVersion: ENCOUNTER_SCHEMA_VERSION + 1 };
  expect(() => assertEncounterState(future)).toThrow(/unsupported/);
  expect(() => validateEncounter(payload(future))).toThrow(/unsupported/);
  expect(() => parseExportEnvelope({ kind: "encounter-export", schemaVersion: EXPORT_SCHEMA_VERSION, exportedAt: 1, encounter: invalid, library: createEmptyLibraryState() })).toThrow();
});

it.each(["traditional", "box", "stack", "row"] as const)("serializes %s clocks for cloud and keeps schema 15 compatible", async (style) => {
  const encounter = state(); encounter.clocks.byId.k.style = style;
  const wire = await serializeEncounterForCloud({ state: encounter, updatedAt: 1 }, { ensureUploaded: vi.fn() } as unknown as CloudAssetRepository);
  expect(validateEncounter(payload(wire.state)).state).toMatchObject({ counters: encounter.counters, clocks: encounter.clocks });
  const legacy = payload({ ...encounter, schemaVersion: 15 }); delete legacy.state.counters; delete legacy.state.clocks;
  expect(validateEncounter(legacy)).toEqual(legacy);
});

it("rejects missing and mismatched encounter resource collections", () => {
  for (const properties of [{ clocks: undefined }, { counters: undefined }, { clocks: { allIds: ["k", "k"], byId: {} } }, { counters: { allIds: [], byId: { c: { id: "c" } } } }]) {
    const encounter = { ...state(), ...properties };
    expect(() => assertEncounterState(encounter)).toThrow(/encounter resources/);
    expect(() => validateEncounter(payload(encounter))).toThrow();
  }
});
