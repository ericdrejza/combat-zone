import type { CloudAssetType, StorageUsageResult } from "@combat-zone/firebase-api";
import type { ImageAssetSource } from "@core/assets/imageAssetSource";
import type { LocalSyncRepository } from "../syncTypes";
import { doc, onSnapshot } from "firebase/firestore";
import { getBlob, ref, uploadBytesResumable } from "firebase/storage";
import type { FirebaseBackendServices } from "./firebaseBackend";
import { FirebaseApiClient } from "./firebaseApiClient";

export type UploadProgress = (uploadedBytes: number, totalBytes: number) => void;

export type CloudAssetRepository = {
  ensureUploaded(source: ImageAssetSource, assetType: CloudAssetType, mediaType: string, onProgress?: UploadProgress): Promise<ImageAssetSource>;
  download(assetId: string, generation: string): Promise<Blob>;
  getUsage(): Promise<StorageUsageResult>;
};

async function sha256(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function waitUntilReady(
  services: FirebaseBackendServices,
  uid: string,
  assetId: string,
  timeoutMs = 60_000
): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      unsubscribe();
      reject(new Error("The uploaded image was not finalized in time."));
    }, timeoutMs);
    const unsubscribe = onSnapshot(
      doc(services.firestore, `users/${uid}/assets/${assetId}`),
      (snapshot) => {
        const data = snapshot.data();
        if (data?.status === "ready" && data.generation) {
          clearTimeout(timer);
          unsubscribe();
          resolve(String(data.generation));
        } else if (data?.status === "failed") {
          clearTimeout(timer);
          unsubscribe();
          reject(new Error("The uploaded image failed server validation."));
        }
      },
      (error) => {
        clearTimeout(timer);
        unsubscribe();
        reject(error);
      }
    );
  });
}

export class FirebaseCloudAssetRepository implements CloudAssetRepository {
  private readonly api: FirebaseApiClient;

  constructor(
    private readonly services: FirebaseBackendServices,
    private readonly localSync: LocalSyncRepository
  ) {
    this.api = new FirebaseApiClient(services);
  }

  async ensureUploaded(source: ImageAssetSource, assetType: CloudAssetType, mediaType: string, onProgress?: UploadProgress): Promise<ImageAssetSource> {
    if (source.kind !== "embedded") return source;
    const blob = await fetch(source.dataUrl).then((response) => response.blob());
    const uploadMediaType = blob.type || mediaType;
    const assetId = await sha256(blob);
    const reservation = await this.api.reserveAssetUpload({ assetId, assetType, expectedBytes: blob.size, mediaType: uploadMediaType });
    if (reservation.status === "ready") return { kind: "cloud_storage", assetId, generation: reservation.generation };
    if (reservation.status === "pending") {
      const uid = this.requireUid();
      return { kind: "cloud_storage", assetId, generation: await waitUntilReady(this.services, uid, assetId) };
    }
    try {
      const object = ref(this.services.storage, `users/${this.requireUid()}/assets/${assetId}`);
      const task = uploadBytesResumable(object, blob, {
        contentType: uploadMediaType,
        customMetadata: {
          assetId,
          ownerId: this.requireUid(),
          reservationId: reservation.reservationId
        }
      });
      await new Promise<void>((resolve, reject) => {
        task.on("state_changed", (snapshot) => onProgress?.(snapshot.bytesTransferred, snapshot.totalBytes), reject, resolve);
      });
      const generation = await waitUntilReady(this.services, this.requireUid(), assetId);
      return { kind: "cloud_storage", assetId, generation };
    } catch (error) {
      await this.api.cancelAssetUpload(reservation.reservationId).catch(() => undefined);
      throw error;
    }
  }

  async download(assetId: string, generation: string): Promise<Blob> {
    const key = `cloud:${assetId}:${generation}`;
    const cached = await this.localSync.getCachedAsset(key);
    if (cached) return cached.blob;
    const blob = await getBlob(ref(this.services.storage, `users/${this.requireUid()}/assets/${assetId}`));
    await this.localSync.putCachedAsset({ blob, byteLength: blob.size, key, lastAccessedAt: Date.now() });
    await this.evictCache();
    return blob;
  }

  async getUsage(): Promise<StorageUsageResult> {
    const usage = await this.api.getStorageUsage();
    await this.localSync.setStorageUsageSnapshot(usage);
    return usage;
  }

  private requireUid(): string {
    const uid = this.services.auth.currentUser?.uid;
    if (!uid) throw new Error("Google sign-in is required for cloud assets.");
    return uid;
  }

  private async evictCache(): Promise<void> {
    const estimate = await navigator.storage?.estimate?.();
    const adaptive = estimate?.quota ? Math.floor(estimate.quota * 0.2) : 250_000_000;
    await this.localSync.evictCachedAssets(Math.min(250_000_000, adaptive));
  }
}
