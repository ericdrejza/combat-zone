import { createEncounterState } from "@core/encounter/createEncounterState";
import { ENCOUNTER_SCHEMA_VERSION } from "@core/encounter/types";
import { assertEncounterState, migrateEncounterState } from "@core/persistence/envelope";
import { createEmptyLibraryState } from "@core/persistence/memoryRepository";
import { EXPORT_SCHEMA_VERSION, parseExportEnvelope, validateExportEnvelope, type EncounterExportEnvelope } from "@core/persistence";
import { validateEncounter } from "@combat-zone/firebase-api";

function legacy() {
  const current = createEncounterState({ id: "legacy-tabs", name: "Legacy tabs" });
  const state = { ...current, schemaVersion: 30, panelLayout: {
    left: [{ id: "log", collapsed: true }, { id: "status", collapsed: false }],
    right: [{ id: "library", collapsed: true }, { id: "audio", collapsed: false },
      { id: "initiative", collapsed: true }, { id: "properties", collapsed: false }]
  } };
  return state;
}

it("adds Zoneless once to older encounters without changing existing order, collapse flags, or source data", () => {
  const old = legacy();
  const original = structuredClone(old);
  const next = migrateEncounterState(old) as ReturnType<typeof createEncounterState>;
  assertEncounterState(next);
  expect(next.schemaVersion).toBe(ENCOUNTER_SCHEMA_VERSION);
  expect(next.panelLayout.left).toEqual([...old.panelLayout.left, { id: "zoneless", collapsed: false }]);
  expect(next.panelLayout.right).toEqual(old.panelLayout.right);
  expect(old).toEqual(original);
  expect(migrateEncounterState(next)).toEqual(next);
});

it("round trips migrated and reordered Zoneless placement through encounter envelopes", () => {
  const next = migrateEncounterState(legacy()) as ReturnType<typeof createEncounterState>;
  const zoneless = next.panelLayout.left.pop()!;
  next.panelLayout.right.splice(1, 0, { ...zoneless, collapsed: true });
  const envelope: EncounterExportEnvelope = { kind: "encounter-export", schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: 1, encounter: next, library: createEmptyLibraryState() };
  expect(parseExportEnvelope(JSON.parse(JSON.stringify(envelope)))).toEqual(envelope);
  expect(validateExportEnvelope(envelope)).toEqual(envelope);
  const { id, ...rest } = next;
  expect(() => validateEncounter({ encounterId: id, folderId: null, schemaVersion: 2, assetIds: [], state: { id, ...rest } })).not.toThrow();
});

it("accepts the actual legacy cloud contract and rejects malformed current layouts and newer schemas", () => {
  const old = legacy();
  expect(() => validateEncounter({ encounterId: old.id, folderId: null, schemaVersion: 2, assetIds: [], state: old })).not.toThrow();
  const next = migrateEncounterState(old) as ReturnType<typeof createEncounterState>;
  expect(() => assertEncounterState({ ...next, panelLayout: old.panelLayout })).toThrow(/every panel/);
  expect(() => assertEncounterState({ ...next, schemaVersion: ENCOUNTER_SCHEMA_VERSION + 1 })).toThrow(/unsupported/);
  expect(() => migrateEncounterState({ ...old, panelLayout: { ...old.panelLayout, left: [...old.panelLayout.left, old.panelLayout.left[0]] } })).toThrow();
});
