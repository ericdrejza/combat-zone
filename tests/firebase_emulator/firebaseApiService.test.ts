// @vitest-environment node

import { deleteApp, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { ApiError } from "../../functions/src/api/errors";
import { FirebaseApiService } from "../../functions/src/api/service";
import { FirebaseAssetStore } from "../../functions/src/api/assetStore";
import { CLOUD_RECORD_SCHEMA_VERSION, FIREBASE_API_VERSION } from "@combat-zone/firebase-api";
import { Timestamp } from "firebase-admin/firestore";

const projectId = "demo-combat-zone";
let environment: RulesTestEnvironment;
let service: FirebaseApiService;

function encounterCommand(mutationId = "mutation-1", expectedRevision: number | null = null) {
  const collection = { byId: {}, allIds: [] };
  const assetIds: string[] = [];
  return {
    apiVersion: FIREBASE_API_VERSION,
    mutationId,
    expectedRevision,
    payload: {
      schemaVersion: CLOUD_RECORD_SCHEMA_VERSION,
      encounterId: "encounter-1",
      folderId: null,
      assetIds,
      state: {
        schemaVersion: 6,
        id: "encounter-1",
        name: "Encounter",
        canvasSize: { width: 960, height: 640 },
        backgroundImage: null,
        zones: collection,
        edges: collection,
        actors: collection,
        engagements: collection,
        annotations: collection,
        initiativeTracker: { entries: [], currentActorId: null, currentRound: null },
        validationState: { mode: "ADVISORY", messages: [] }
      }
    }
  };
}

beforeAll(async () => {
  if (getApps().length === 0) initializeApp({ projectId });
  environment = await initializeTestEnvironment({ projectId });
  service = new FirebaseApiService();
});

beforeEach(async () => environment.clearFirestore());
afterAll(async () => {
  await environment.cleanup();
  await Promise.all(getApps().map(deleteApp));
});

describe("Firebase API service", () => {
  it("commits records and reference sets atomically", async () => {
    const result = await service.commitEncounter("alice", encounterCommand());
    expect(result).toMatchObject({ status: "applied", revision: 1 });

    const database = getFirestore();
    const [record, references] = await Promise.all([
      database.doc("users/alice/encounters/encounter-1").get(),
      database.doc("users/alice/asset_reference_sets/encounter_encounter-1").get()
    ]);
    expect(record.data()).toMatchObject({ encounterId: "encounter-1", revision: 1, deleted: false });
    expect(references.data()).toMatchObject({ assetIds: [], revision: 1 });
  });

  it("returns an idempotent result for an identical replay", async () => {
    await service.commitEncounter("alice", encounterCommand());
    await expect(service.commitEncounter("alice", encounterCommand()))
      .resolves.toMatchObject({ status: "already_applied", revision: 1 });
  });

  it("rejects stale revisions and mismatched mutation reuse", async () => {
    await service.commitEncounter("alice", encounterCommand());
    await expect(service.commitEncounter("alice", encounterCommand("mutation-2", null)))
      .rejects.toMatchObject({ code: "REVISION_CONFLICT" } satisfies Partial<ApiError>);
    const changed = encounterCommand();
    changed.payload.state.name = "Different";
    await expect(service.commitEncounter("alice", changed))
      .rejects.toMatchObject({ code: "IDEMPOTENCY_MISMATCH" } satisfies Partial<ApiError>);
  });

  it("rejects references until assets are ready and updates reference counts atomically", async () => {
    const assetId = "a".repeat(64);
    const command = encounterCommand();
    command.payload.assetIds = [assetId];
    (command.payload.state as Record<string, unknown>).backgroundImage = {
      source: { kind: "cloud_storage", assetId, generation: "1" },
      height: 10, mediaType: "image/png", name: "Map", width: 10
    };
    await expect(service.commitEncounter("alice", command)).rejects.toMatchObject({ code: "ASSET_NOT_READY" });

    const database = getFirestore();
    await database.doc(`users/alice/assets/${assetId}`).set({
      assetId, generation: "1", mediaType: "image/png", ownerId: "alice", refCount: 0,
      size: 100, status: "ready", updatedAt: Timestamp.now()
    });
    await service.commitEncounter("alice", command);
    expect((await database.doc(`users/alice/assets/${assetId}`).get()).data()?.refCount).toBe(1);

    await service.deleteEncounter("alice", {
      apiVersion: FIREBASE_API_VERSION,
      expectedRevision: 1,
      mutationId: "delete-1",
      payload: { encounterId: "encounter-1", schemaVersion: CLOUD_RECORD_SCHEMA_VERSION }
    });
    const [asset, tombstone] = await Promise.all([
      database.doc(`users/alice/assets/${assetId}`).get(),
      database.doc("users/alice/encounters/encounter-1").get()
    ]);
    expect(asset.data()).toMatchObject({ refCount: 0, status: "pending_delete" });
    expect(tombstone.data()?.deletedAt).toBeInstanceOf(Timestamp);
  });

  it("enforces total quota and expires a superseded reservation without double counting", async () => {
    const database = getFirestore();
    const assets = new FirebaseAssetStore();
    await database.doc("users/alice/usage/storage").set({
      limitBytes: 250_000_000, reservedBytes: 0, storedBytes: 225_000_000, updatedAt: Timestamp.now()
    });
    await expect(assets.reserve("alice", {
      assetId: "b".repeat(64), assetType: "background", expectedBytes: 25_000_000, mediaType: "image/png"
    })).resolves.toMatchObject({ status: "reserved" });
    await expect(assets.reserve("alice", {
      assetId: "c".repeat(64), assetType: "token", expectedBytes: 1, mediaType: "image/png"
    })).rejects.toMatchObject({ code: "QUOTA_EXCEEDED" });

    await environment.clearFirestore();
    const expiredId = "old-reservation";
    const assetId = "d".repeat(64);
    await database.doc(`users/alice/upload_reservations/${expiredId}`).set({
      assetId, expectedBytes: 100, status: "reserved", uid: "alice"
    });
    await database.doc(`users/alice/assets/${assetId}`).set({
      assetId, reservationId: expiredId, size: 100, status: "reserved",
      expiresAt: Timestamp.fromMillis(1)
    });
    await database.doc("users/alice/usage/storage").set({
      limitBytes: 250_000_000, reservedBytes: 100, storedBytes: 0, updatedAt: Timestamp.now()
    });
    await assets.reserve("alice", { assetId, assetType: "token", expectedBytes: 100, mediaType: "image/png" });
    expect((await database.doc(`users/alice/upload_reservations/${expiredId}`).get()).data()?.status).toBe("expired");
    expect((await database.doc("users/alice/usage/storage").get()).data()?.reservedBytes).toBe(100);
  });
});
