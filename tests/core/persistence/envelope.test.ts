import { createEncounterState } from "@core/encounter/createEncounterState";
import {
  EXPORT_SCHEMA_VERSION,
  PersistenceValidationError,
  parseExportEnvelope,
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

  it("migrates legacy embedded and HTTP image strings losslessly", () => {
    const value = validEnvelope() as unknown as Record<string, unknown>;
    value.schemaVersion = 1;
    const legacyEncounter = value.encounter as Record<string, unknown>;
    legacyEncounter.schemaVersion = 5;
    legacyEncounter.backgroundImage = {
      dataUrl: "https://example.com/map.png",
      height: 10,
      mediaType: "image/png",
      name: "Map",
      width: 20
    };
    const actors = legacyEncounter.actors as { allIds: string[]; byId: Record<string, unknown> };
    actors.allIds.push("actor-1");
    actors.byId["actor-1"] = {
      id: "actor-1", name: "Actor", actorType: "creature", layoutGroup: "enemy",
      size: "medium", shape: "circle", image: "data:image/png;base64,AA==",
      currentZoneId: "zoneless", statusEffects: [], metadata: {}
    };

    const migrated = parseExportEnvelope(value) as EncounterExportEnvelope;
    expect(migrated.encounter.backgroundImage?.source).toEqual({ kind: "url", url: "https://example.com/map.png" });
    expect(migrated.encounter.actors.byId["actor-1"].image).toEqual({ kind: "embedded", dataUrl: "data:image/png;base64,AA==" });
    expect(migrated.encounter.id).toBe("encounter-1");
  });
});
