import {
  FIREBASE_API_VERSION,
  type CloudCommandResult,
  type DeleteEncounterPayload,
  type EncounterPayload,
  type EntitlementResult,
  type LibraryPayload,
  type RecoveryDraftPayload,
  type WorkspaceMetadataPayload,
  validateCommand,
  validateCancelAssetUpload,
  validateDeleteEncounter,
  validateEncounter,
  validateLibrary,
  validateRecoveryDraft,
  validateReserveAssetUpload,
  validateReplaceWorkspace,
  validateWorkspaceMetadata
} from "@combat-zone/firebase-api";
import { FirestoreApiStore } from "./firestoreStore.js";
import { FirebaseAssetStore, STORAGE_LIMITS } from "./assetStore.js";
import { Timestamp } from "firebase-admin/firestore";

/** Implements callable use cases independently from Firebase trigger plumbing. */
export class FirebaseApiService {
  constructor(
    private readonly store = new FirestoreApiStore(),
    private readonly assets = new FirebaseAssetStore()
  ) {}

  getEntitlement(): EntitlementResult {
    return { apiVersion: FIREBASE_API_VERSION, features: { cloudSync: true }, limits: STORAGE_LIMITS, tierId: "default" };
  }

  commitWorkspace(uid: string, value: unknown): Promise<CloudCommandResult> {
    const command = validateCommand(value, validateWorkspaceMetadata);
    return this.store.commit({ uid, command, target: this.store.user(uid), data: {
      schemaVersion: command.payload.schemaVersion,
      recentEncounters: command.payload.recentEncounters
    } });
  }

  commitEncounter(uid: string, value: unknown): Promise<CloudCommandResult> {
    const command = validateCommand(value, validateEncounter);
    const payload = command.payload;
    return this.store.commit({ uid, command, target: this.store.encounter(uid, payload.encounterId), referenceKey: `encounter_${payload.encounterId}`, assetIds: payload.assetIds, data: {
      schemaVersion: payload.schemaVersion,
      encounterId: payload.encounterId,
      folderId: payload.folderId,
      state: payload.state,
      deleted: false
    } });
  }

  deleteEncounter(uid: string, value: unknown): Promise<CloudCommandResult> {
    const command = validateCommand(value, validateDeleteEncounter);
    const payload: DeleteEncounterPayload = command.payload;
    return this.store.commit({ uid, command, target: this.store.encounter(uid, payload.encounterId), referenceKey: `encounter_${payload.encounterId}`, requireExisting: true, data: {
      schemaVersion: payload.schemaVersion,
      encounterId: payload.encounterId,
      deleted: true,
      deletedAt: Timestamp.now()
    } });
  }

  commitLibrary(uid: string, value: unknown): Promise<CloudCommandResult> {
    const command = validateCommand(value, validateLibrary);
    const payload: LibraryPayload = command.payload;
    return this.store.commit({ uid, command, target: this.store.singleton(uid, "library"), referenceKey: "library", assetIds: payload.assetIds, data: {
      schemaVersion: payload.schemaVersion,
      state: payload.state,
      deleted: false
    } });
  }

  commitRecoveryDraft(uid: string, value: unknown): Promise<CloudCommandResult> {
    const command = validateCommand(value, validateRecoveryDraft);
    const payload: RecoveryDraftPayload = command.payload;
    return this.store.commit({ uid, command, target: this.store.singleton(uid, "recovery_draft"), referenceKey: "recovery_draft", assetIds: payload?.assetIds, data: payload ? {
      schemaVersion: payload.schemaVersion,
      state: payload.state,
      deleted: false
    } : { deleted: true, deletedAt: Timestamp.now() } });
  }

  replaceCloudWorkspace(uid: string, value: unknown): Promise<CloudCommandResult> {
    const command = validateCommand(value, validateReplaceWorkspace);
    return this.store.replaceWorkspace(uid, command);
  }

  reserveAssetUpload(uid: string, value: unknown) {
    return this.assets.reserve(uid, validateReserveAssetUpload(value));
  }

  async cancelAssetUpload(uid: string, value: unknown): Promise<{ cancelled: true }> {
    await this.assets.cancel(uid, validateCancelAssetUpload(value).reservationId);
    return { cancelled: true };
  }

  getStorageUsage(uid: string) {
    return this.assets.usage(uid);
  }
}
