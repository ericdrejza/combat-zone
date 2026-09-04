import type {
  CloudCommand,
  CloudCommandResult,
  DeleteEncounterPayload,
  EncounterPayload,
  EntitlementResult,
  LibraryPayload,
  RecoveryDraftPayload,
  ReplaceWorkspacePayload,
  WorkspaceMetadataPayload,
  ReserveAssetUploadPayload,
  ReserveAssetUploadResult,
  StorageUsageResult
} from "@combat-zone/firebase-api";
import { validateCommandResult, validateEntitlementResult, validateReserveAssetUploadResult, validateStorageUsageResult } from "@combat-zone/firebase-api";
import { collection, doc, getDoc, getDocs, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import type { FirebaseBackendServices } from "./firebaseBackend";
import { FirebaseApiClientError, normalizeFirebaseApiError } from "./firebaseApiError";

export type CloudRecordObserver = (value: unknown | null) => void;

/** First-party API client; Firebase SDK values never leave this class. */
export class FirebaseApiClient {
  constructor(private readonly services: FirebaseBackendServices) {}

  async getEntitlement(): Promise<EntitlementResult> {
    return validateEntitlementResult(await this.call<{}, unknown>("getEntitlement", {}));
  }

  commitWorkspace(command: CloudCommand<WorkspaceMetadataPayload>): Promise<CloudCommandResult> {
    return this.command("commitWorkspaceMetadata", command);
  }

  commitEncounter(command: CloudCommand<EncounterPayload>): Promise<CloudCommandResult> {
    return this.command("commitEncounter", command);
  }

  deleteEncounter(command: CloudCommand<DeleteEncounterPayload>): Promise<CloudCommandResult> {
    return this.command("deleteEncounter", command);
  }

  commitLibrary(command: CloudCommand<LibraryPayload>): Promise<CloudCommandResult> {
    return this.command("commitLibrary", command);
  }

  commitRecoveryDraft(command: CloudCommand<RecoveryDraftPayload>): Promise<CloudCommandResult> {
    return this.command("commitRecoveryDraft", command);
  }

  replaceCloudWorkspace(command: CloudCommand<ReplaceWorkspacePayload>): Promise<CloudCommandResult> {
    return this.command("replaceCloudWorkspace", command);
  }

  async reserveAssetUpload(payload: ReserveAssetUploadPayload): Promise<ReserveAssetUploadResult> {
    return validateReserveAssetUploadResult(await this.call("reserveAssetUpload", payload));
  }

  async cancelAssetUpload(reservationId: string): Promise<void> {
    await this.call("cancelAssetUpload", { reservationId });
  }

  async getStorageUsage(): Promise<StorageUsageResult> {
    return validateStorageUsageResult(await this.call("getStorageUsage", {}));
  }

  async readWorkspace(): Promise<unknown | null> {
    return this.readDocument(this.userPath());
  }

  async listEncounters(): Promise<unknown[]> {
    try {
      const snapshot = await getDocs(collection(this.services.firestore, `${this.userPath()}/encounters`));
      return snapshot.docs.map((item) => item.data());
    } catch (error) {
      throw normalizeFirebaseApiError(error);
    }
  }

  readLibrary(): Promise<unknown | null> {
    return this.readDocument(`${this.userPath()}/singletons/library`);
  }

  readRecoveryDraft(): Promise<unknown | null> {
    return this.readDocument(`${this.userPath()}/singletons/recovery_draft`);
  }

  subscribeWorkspace(observer: CloudRecordObserver, onError: (error: Error) => void): Unsubscribe {
    const path = this.userPath();
    const report = (value: unknown | null) => observer(value);
    const fail = (error: Error) => onError(normalizeFirebaseApiError(error));
    const subscriptions = [
      onSnapshot(doc(this.services.firestore, path), (snapshot) => report(snapshot.exists() ? snapshot.data() : null), fail),
      onSnapshot(collection(this.services.firestore, `${path}/encounters`), () => report(null), fail),
      onSnapshot(doc(this.services.firestore, `${path}/singletons/library`), () => report(null), fail),
      onSnapshot(doc(this.services.firestore, `${path}/singletons/recovery_draft`), () => report(null), fail)
    ];
    return () => subscriptions.forEach((unsubscribe) => unsubscribe());
  }

  private async command<Request>(name: string, request: Request): Promise<CloudCommandResult> {
    return validateCommandResult(await this.call<Request, unknown>(name, request));
  }

  private async call<Request, Response>(name: string, request: Request): Promise<Response> {
    try {
      const callable = httpsCallable<Request, Response>(this.services.functions, name);
      return (await callable(request)).data;
    } catch (error) {
      throw normalizeFirebaseApiError(error);
    }
  }

  private async readDocument(path: string): Promise<unknown | null> {
    try {
      const snapshot = await getDoc(doc(this.services.firestore, path));
      return snapshot.exists() ? snapshot.data() : null;
    } catch (error) {
      throw normalizeFirebaseApiError(error);
    }
  }

  private userPath(): string {
    const uid = this.services.auth.currentUser?.uid;
    if (!uid) throw new FirebaseApiClientError("AUTH_REQUIRED", "Firebase authentication is required.", false);
    return `users/${uid}`;
  }
}
