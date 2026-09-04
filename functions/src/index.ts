import { randomUUID } from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { logger } from "firebase-functions";
import { onCall, type CallableRequest } from "firebase-functions/v2/https";
import { onObjectFinalized } from "firebase-functions/v2/storage";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { ApiContractValidationError } from "@combat-zone/firebase-api";
import { ApiError, toHttpsError } from "./api/errors.js";
import { FirebaseApiService } from "./api/service.js";
import { FirebaseAssetStore } from "./api/assetStore.js";
import { reconcileCloudStorage } from "./api/maintenance.js";

initializeApp();
const service = new FirebaseApiService();
const options = { enforceAppCheck: true, region: "us-east1", timeoutSeconds: 30, maxInstances: 10 } as const;

function callable(handler: (uid: string, data: unknown) => unknown | Promise<unknown>) {
  return onCall(options, async (request: CallableRequest<unknown>) => {
    const correlationId = randomUUID();
    const startedAt = Date.now();
    try {
      if (!request.auth) throw new ApiError("AUTH_REQUIRED", "Sign in is required.");
      const result = await handler(request.auth.uid, request.data);
      logger.info("Firebase API call completed", { correlationId, durationMs: Date.now() - startedAt });
      return result;
    } catch (error) {
      const normalized = error instanceof ApiContractValidationError
        ? new ApiError(
            error.message === "Unsupported API version."
              ? "UNSUPPORTED_API_VERSION"
              : error.message.includes("schemaVersion") || error.message.includes("schema version")
                ? "UNSUPPORTED_SCHEMA_VERSION"
                : "INVALID_REQUEST",
            error.message
          )
        : error;
      const httpsError = toHttpsError(normalized, correlationId);
      logger.warn("Firebase API call failed", { correlationId, code: httpsError.details && typeof httpsError.details === "object" ? (httpsError.details as { code?: string }).code : "INTERNAL", durationMs: Date.now() - startedAt });
      throw httpsError;
    }
  });
}

export const getEntitlement = callable(() => service.getEntitlement());
export const commitWorkspaceMetadata = callable((uid, data) => service.commitWorkspace(uid, data));
export const commitEncounter = callable((uid, data) => service.commitEncounter(uid, data));
export const deleteEncounter = callable((uid, data) => service.deleteEncounter(uid, data));
export const commitLibrary = callable((uid, data) => service.commitLibrary(uid, data));
export const commitRecoveryDraft = callable((uid, data) => service.commitRecoveryDraft(uid, data));
export const replaceCloudWorkspace = callable((uid, data) => service.replaceCloudWorkspace(uid, data));
export const reserveAssetUpload = callable((uid, data) => service.reserveAssetUpload(uid, data));
export const cancelAssetUpload = callable((uid, data) => service.cancelAssetUpload(uid, data));
export const getStorageUsage = callable((uid) => service.getStorageUsage(uid));

export const finalizeAssetUpload = onObjectFinalized(
  { region: "us-east1", maxInstances: 5 },
  async (event) => {
    const object = event.data;
    const name = object.name;
    if (!name) return;
    const valid = await new FirebaseAssetStore().finalizeObject(
      name,
      String(object.generation),
      Number(object.size),
      object.contentType ?? "application/octet-stream",
      (object.metadata ?? {}) as Record<string, string>,
      object.bucket
    );
    if (!valid) {
      await getStorage().bucket(object.bucket).file(name).delete({
        ifGenerationMatch: String(object.generation)
      }).catch((error: { code?: number }) => {
        if (error.code !== 404) throw error;
      });
      const match = /^users\/([^/]+)\/assets\/[a-f0-9]{64}$/.exec(name);
      const reservationId = object.metadata?.reservationId;
      if (match && reservationId) {
        await new FirebaseAssetStore().releaseReservation(match[1], reservationId, "failed");
      }
    }
  }
);

export const maintainCloudStorage = onSchedule(
  { schedule: "every 1 hours", region: "us-east1", timeoutSeconds: 540, maxInstances: 1 },
  reconcileCloudStorage
);
