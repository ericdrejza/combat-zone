import { createHash, randomUUID } from "node:crypto";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import type {
  ReserveAssetUploadPayload,
  ReserveAssetUploadResult,
  StorageUsageResult
} from "@combat-zone/firebase-api";
import { ApiError } from "./errors.js";

export const STORAGE_LIMITS = {
  backgroundMaxBytes: 25_000_000,
  tokenMaxBytes: 10_000_000,
  totalStorageBytes: 250_000_000
} as const;
const RESERVATION_MS = 24 * 60 * 60 * 1000;

function usageData(data: FirebaseFirestore.DocumentData | undefined) {
  return {
    limitBytes: STORAGE_LIMITS.totalStorageBytes,
    reservedBytes: typeof data?.reservedBytes === "number" ? data.reservedBytes : 0,
    storedBytes: typeof data?.storedBytes === "number" ? data.storedBytes : 0
  };
}

/** Owns quota reservations and idempotent object finalization. */
export class FirebaseAssetStore {
  private readonly db = getFirestore();

  async reserve(uid: string, payload: ReserveAssetUploadPayload): Promise<ReserveAssetUploadResult> {
    const perFileLimit = payload.assetType === "background"
      ? STORAGE_LIMITS.backgroundMaxBytes
      : STORAGE_LIMITS.tokenMaxBytes;
    if (payload.expectedBytes > perFileLimit) throw new ApiError("QUOTA_EXCEEDED", "The image exceeds the limit for this asset type.");
    const now = Timestamp.now();
    return this.db.runTransaction(async (transaction) => {
      const assetRef = this.db.doc(`users/${uid}/assets/${payload.assetId}`);
      const usageRef = this.db.doc(`users/${uid}/usage/storage`);
      const [assetSnapshot, usageSnapshot] = await Promise.all([
        transaction.get(assetRef),
        transaction.get(usageRef)
      ]);
      const asset = assetSnapshot.data();
      if (asset?.status === "ready") {
        if (asset.size > perFileLimit) throw new ApiError("QUOTA_EXCEEDED", "The stored image is not eligible for this asset type.");
        return { status: "ready", assetId: payload.assetId, generation: String(asset.generation) };
      }
      if (asset?.status === "reserved" && asset.expiresAt?.toMillis?.() > now.toMillis()) {
        return { status: "pending", assetId: payload.assetId };
      }
      const usage = usageData(usageSnapshot.data());
      const previousReservation = asset?.status === "reserved" ? Number(asset.size ?? 0) : 0;
      const nextReserved = Math.max(0, usage.reservedBytes - previousReservation) + payload.expectedBytes;
      if (usage.storedBytes + nextReserved > usage.limitBytes) throw new ApiError("QUOTA_EXCEEDED", "The account storage allowance is full.");
      const reservationId = randomUUID();
      const expiresAt = Timestamp.fromMillis(now.toMillis() + RESERVATION_MS);
      transaction.set(this.db.doc(`users/${uid}/upload_reservations/${reservationId}`), {
        ...payload,
        uid,
        reservationId,
        status: "reserved",
        createdAt: now,
        expiresAt
      });
      if (previousReservation > 0 && asset?.reservationId) {
        transaction.set(
          this.db.doc(`users/${uid}/upload_reservations/${String(asset.reservationId)}`),
          { status: "expired", updatedAt: now },
          { merge: true }
        );
      }
      transaction.set(assetRef, {
        assetId: payload.assetId,
        mediaType: payload.mediaType,
        ownerId: uid,
        reservationId,
        size: payload.expectedBytes,
        status: "reserved",
        expiresAt,
        updatedAt: now
      });
      transaction.set(usageRef, { ...usage, reservedBytes: nextReserved, updatedAt: now });
      return { status: "reserved", assetId: payload.assetId, reservationId, expiresAt: expiresAt.toMillis() };
    });
  }

  async cancel(uid: string, reservationId: string): Promise<void> {
    await this.releaseReservation(uid, reservationId, "cancelled");
  }

  async usage(uid: string): Promise<StorageUsageResult> {
    const snapshot = await this.db.doc(`users/${uid}/usage/storage`).get();
    const usage = usageData(snapshot.data());
    return { ...usage, updatedAt: snapshot.data()?.updatedAt?.toMillis?.() ?? Date.now() };
  }

  async finalizeObject(name: string, generation: string, size: number, mediaType: string, metadata: Record<string, string>, bucketName?: string): Promise<boolean> {
    const match = /^users\/([^/]+)\/assets\/([a-f0-9]{64})$/.exec(name);
    if (!match) return false;
    const [, uid, assetId] = match;
    const reservationId = metadata.reservationId;
    if (!reservationId || metadata.assetId !== assetId || metadata.ownerId !== uid) return false;
    const reservationRef = this.db.doc(`users/${uid}/upload_reservations/${reservationId}`);
    const reservation = (await reservationRef.get()).data();
    if (!reservation || reservation.status !== "reserved" || reservation.assetId !== assetId || reservation.expectedBytes !== size || reservation.mediaType !== mediaType || reservation.expiresAt?.toMillis?.() <= Date.now()) return false;
    const [bytes] = await getStorage().bucket(bucketName).file(name).download();
    if (createHash("sha256").update(bytes).digest("hex") !== assetId) return false;
    const finalized = await this.db.runTransaction(async (transaction) => {
      const assetRef = this.db.doc(`users/${uid}/assets/${assetId}`);
      const usageRef = this.db.doc(`users/${uid}/usage/storage`);
      const [assetSnapshot, usageSnapshot, reservationSnapshot] = await Promise.all([
        transaction.get(assetRef), transaction.get(usageRef), transaction.get(reservationRef)
      ]);
      const asset = assetSnapshot.data();
      if (asset?.status === "ready" && String(asset.generation) === generation) return true;
      if (reservationSnapshot.data()?.status !== "reserved" || reservationSnapshot.data()?.expiresAt?.toMillis?.() <= Date.now() || asset?.reservationId !== reservationId) return false;
      const usage = usageData(usageSnapshot.data());
      const now = Timestamp.now();
      transaction.set(assetRef, { ...asset, generation, refCount: 0, status: "ready", updatedAt: now });
      transaction.update(reservationRef, { status: "finalized", finalizedAt: now, generation });
      transaction.set(usageRef, {
        ...usage,
        reservedBytes: Math.max(0, usage.reservedBytes - size),
        storedBytes: usage.storedBytes + size,
        updatedAt: now
      });
      return true;
    });
    return finalized;
  }

  async releaseReservation(uid: string, reservationId: string, status: string): Promise<void> {
    const reservationRef = this.db.doc(`users/${uid}/upload_reservations/${reservationId}`);
    await this.db.runTransaction(async (transaction) => {
      const reservationSnapshot = await transaction.get(reservationRef);
      const reservation = reservationSnapshot.data();
      if (!reservation || reservation.status !== "reserved") return;
      const assetRef = this.db.doc(`users/${uid}/assets/${reservation.assetId}`);
      const usageRef = this.db.doc(`users/${uid}/usage/storage`);
      const [assetSnapshot, usageSnapshot] = await Promise.all([transaction.get(assetRef), transaction.get(usageRef)]);
      const usage = usageData(usageSnapshot.data());
      const now = Timestamp.now();
      transaction.update(reservationRef, { status, updatedAt: now });
      if (assetSnapshot.data()?.reservationId === reservationId) transaction.update(assetRef, { status: "failed", updatedAt: now });
      transaction.set(usageRef, { ...usage, reservedBytes: Math.max(0, usage.reservedBytes - reservation.expectedBytes), updatedAt: now });
    });
  }
}
