import { createEncounterState } from "@core/encounter/createEncounterState";
import { EXPORT_SCHEMA_VERSION, createEmptyLibraryState, type EncounterExportEnvelope } from "@core/persistence";
import { prepareEncounterCloudExport } from "@core/persistence/cloud";

describe("cloud-aware export", () => {
  it("embeds provider bytes in a clone without changing live references", async () => {
    const encounter = createEncounterState({ id: "encounter-1", name: "Encounter" });
    encounter.backgroundImage = {
      source: { kind: "cloud_storage", assetId: "a".repeat(64), generation: "7" },
      height: 100,
      mediaType: "image/png",
      name: "Map",
      width: 100
    };
    const envelope: EncounterExportEnvelope = {
      kind: "encounter-export",
      schemaVersion: EXPORT_SCHEMA_VERSION,
      exportedAt: 1,
      encounter,
      library: createEmptyLibraryState()
    };

    const result = await prepareEncounterCloudExport(envelope, async () => new Blob(["image"], { type: "image/png" }));

    expect(result.encounter.backgroundImage?.source).toMatchObject({ kind: "embedded" });
    expect(envelope.encounter.backgroundImage?.source).toMatchObject({ kind: "cloud_storage", generation: "7" });
  });

  it("reports unavailable assets by display name", async () => {
    const encounter = createEncounterState({ id: "encounter-1", name: "Encounter" });
    encounter.backgroundImage = {
      source: { kind: "google_drive", fileId: "drive-1" },
      height: 100,
      mediaType: "image/png",
      name: "Unavailable map",
      width: 100
    };
    const envelope: EncounterExportEnvelope = {
      kind: "encounter-export", schemaVersion: EXPORT_SCHEMA_VERSION, exportedAt: 1,
      encounter, library: createEmptyLibraryState()
    };
    await expect(prepareEncounterCloudExport(envelope, async () => { throw new Error("denied"); }))
      .rejects.toThrow(/Unavailable map/);
  });
});
