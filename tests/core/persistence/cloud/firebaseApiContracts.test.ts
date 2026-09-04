import {
  ApiContractValidationError,
  CLOUD_RECORD_SCHEMA_VERSION,
  FIREBASE_API_VERSION,
  validateCommand,
  validateCommandResult,
  validateEncounter,
  validateReplaceWorkspace,
  validateReserveAssetUpload,
  validateReserveAssetUploadResult,
  validateStorageUsageResult,
  validateWorkspaceMetadata
} from "@combat-zone/firebase-api";

function encounter(id = "encounter-1") {
  const collection: { byId: Record<string, unknown>; allIds: string[] } = {
    byId: {},
    allIds: []
  };
  return {
    assetIds: [],
    encounterId: id,
    folderId: null,
    schemaVersion: CLOUD_RECORD_SCHEMA_VERSION,
    state: {
      schemaVersion: 6,
      id,
      name: "Encounter",
      backgroundImage: null,
      canvasSize: { width: 960, height: 640 },
      zones: collection,
      edges: collection,
      actors: collection,
      engagements: collection,
      annotations: collection,
      initiativeTracker: { entries: [], currentActorId: null, currentRound: null },
      validationState: { mode: "ADVISORY", messages: [] }
    }
  };
}

describe("Firebase API contracts", () => {
  it("validates a versioned encounter command", () => {
    const value = validateCommand({
      apiVersion: FIREBASE_API_VERSION,
      expectedRevision: 2,
      mutationId: "mutation-1",
      payload: encounter()
    }, validateEncounter);

    expect(value.payload.encounterId).toBe("encounter-1");
    expect(value.expectedRevision).toBe(2);
  });

  it("rejects unsupported API and cloud schema versions", () => {
    expect(() => validateCommand({
      apiVersion: 999,
      expectedRevision: null,
      mutationId: "mutation-1",
      payload: encounter()
    }, validateEncounter)).toThrow(/Unsupported API version/);
    expect(() => validateEncounter({ ...encounter(), schemaVersion: 999 })).toThrow(/unsupported/);
  });

  it("rejects inconsistent entity collections and duplicate assets", () => {
    const invalidCollection = encounter();
    invalidCollection.state.actors = { byId: {}, allIds: ["missing"] };
    expect(() => validateEncounter(invalidCollection)).toThrow(/byId and allIds/);
    const assetId = "a".repeat(64);
    expect(() => validateEncounter({ ...encounter(), assetIds: [assetId, assetId] })).toThrow(/duplicates/);
  });

  it("rejects embedded cloud documents and mismatched asset reference lists", () => {
    const embedded = encounter();
    (embedded.state as Record<string, unknown>).backgroundImage = {
      source: { kind: "embedded", dataUrl: "data:image/png;base64,AA==" },
      height: 10, mediaType: "image/png", name: "Map", width: 10
    };
    expect(() => validateEncounter(embedded)).toThrow(/ready cloud source/);

    const cloud = encounter();
    (cloud.state as Record<string, unknown>).backgroundImage = {
      source: { kind: "cloud_storage", assetId: "a".repeat(64), generation: "1" },
      height: 10, mediaType: "image/png", name: "Map", width: 10
    };
    expect(() => validateEncounter(cloud)).toThrow(/exactly match/);
  });

  it("limits recent encounters and replacement IDs", () => {
    const recentEncounters = Array.from({ length: 6 }, (_, index) => ({ encounterId: `${index}`, accessedAt: index }));
    expect(() => validateWorkspaceMetadata({ schemaVersion: 1, recentEncounters })).toThrow(/at most five/);
    expect(() => validateReplaceWorkspace({
      workspace: { schemaVersion: 1, recentEncounters: [] },
      encounters: [encounter(), encounter()],
      library: { schemaVersion: 1, assetIds: [], state: { sections: {
        encounters: { rootId: "e", nodesById: {} },
        backgrounds: { rootId: "b", nodesById: {} },
        tokens: { rootId: "t", nodesById: {} }
      } } },
      recoveryDraft: null
    })).toThrow(/unique/);
  });

  it("validates command responses instead of trusting callable data", () => {
    expect(validateCommandResult({ status: "applied", mutationId: "m", revision: 1, updatedAt: 4 })).toEqual({
      status: "applied", mutationId: "m", revision: 1, updatedAt: 4
    });
    expect(() => validateCommandResult({ status: "maybe", mutationId: "m", revision: 1, updatedAt: 4 }))
      .toThrow(ApiContractValidationError);
  });

  it("validates object-storage reservation and usage boundaries", () => {
    const assetId = "a".repeat(64);
    expect(validateReserveAssetUpload({ assetId, assetType: "background", expectedBytes: 25_000_000, mediaType: "image/png" }))
      .toMatchObject({ assetId, expectedBytes: 25_000_000 });
    expect(() => validateReserveAssetUpload({ assetId: "not-a-digest", assetType: "token", expectedBytes: 1, mediaType: "image/png" }))
      .toThrow(/assetId/);
    expect(validateReserveAssetUploadResult({ status: "ready", assetId, generation: "4" }))
      .toEqual({ status: "ready", assetId, generation: "4" });
    expect(validateStorageUsageResult({ limitBytes: 250_000_000, reservedBytes: 10, storedBytes: 20, updatedAt: 1 }))
      .toMatchObject({ limitBytes: 250_000_000, storedBytes: 20 });
  });
});
