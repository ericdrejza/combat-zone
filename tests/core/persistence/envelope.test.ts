import { createEncounterState } from "@core/encounter/createEncounterState";
import {
  EXPORT_SCHEMA_VERSION,
  PersistenceValidationError,
  validateExportEnvelope,
  type EncounterExportEnvelope
} from "@core/persistence";
import { createEmptyLibraryState } from "@core/persistence/memoryRepository";

function encounter(id = "encounter-1") {
  return createEncounterState({ id, name: "Test encounter" });
}

function validEnvelope(): EncounterExportEnvelope {
  return {
    kind: "encounter-export",
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: 1,
    encounter: encounter(),
    library: createEmptyLibraryState()
  };
}

describe("persistence export envelopes", () => {
  it("accepts a current encounter envelope without changing EncounterState", () => {
    const value = validEnvelope();
    expect(validateExportEnvelope(value)).toEqual(value);
  });

  it("rejects unknown kinds and newer versions before data is used", () => {
    expect(() => validateExportEnvelope({ ...validEnvelope(), kind: "future" })).toThrow(PersistenceValidationError);
    expect(() => validateExportEnvelope({ ...validEnvelope(), schemaVersion: 999 })).toThrow(/unsupported/i);
    expect(() => validateExportEnvelope({ ...validEnvelope(), encounter: { ...encounter(), schemaVersion: 999 } })).toThrow(/schemaVersion/);
  });

  it("rejects normalized collections with mismatched IDs", () => {
    const value = validEnvelope();
    value.encounter.actors.allIds = ["missing-actor"];

    expect(() => validateExportEnvelope(value)).toThrow(/byId and allIds/);
  });
});
