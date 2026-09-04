import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { FirebaseAssetStore } from "./assetStore.js";

const TOMBSTONE_MS = 30 * 24 * 60 * 60 * 1000;

/** Repairs expired reservations and safely removes expired unreferenced data. */
export async function reconcileCloudStorage(): Promise<void> {
  const db = getFirestore();
  const now = Timestamp.now();
  const assetStore = new FirebaseAssetStore();
  const expiredReservations = await db.collectionGroup("upload_reservations")
    .where("status", "==", "reserved")
    .where("expiresAt", "<=", now)
    .limit(200)
    .get();
  for (const snapshot of expiredReservations.docs) {
    const data = snapshot.data();
    await assetStore.releaseReservation(String(data.uid), snapshot.id, "expired");
  }

  const pendingAssets = await db.collectionGroup("assets")
    .where("status", "==", "pending_delete")
    .where("deleteAfter", "<=", now)
    .limit(100)
    .get();
  for (const snapshot of pendingAssets.docs) {
    const data = snapshot.data();
    if (Number(data.refCount ?? 0) !== 0 || !data.generation) continue;
    const uid = snapshot.ref.parent.parent?.id;
    if (!uid) continue;
    const usageRef = db.doc(`users/${uid}/usage/storage`);
    const claimed = await db.runTransaction(async (transaction) => {
      const [fresh, usage] = await Promise.all([
        transaction.get(snapshot.ref),
        transaction.get(usageRef)
      ]);
      const current = fresh.data();
      if (current?.status !== "pending_delete" || Number(current.refCount ?? 0) !== 0 || String(current.generation) !== String(data.generation)) return false;
      transaction.update(snapshot.ref, { status: "deleted", deletedAt: now, updatedAt: now });
      transaction.set(usageRef, {
        limitBytes: Number(usage.data()?.limitBytes ?? 250_000_000),
        reservedBytes: Number(usage.data()?.reservedBytes ?? 0),
        storedBytes: Math.max(0, Number(usage.data()?.storedBytes ?? 0) - Number(current.size ?? 0)),
        updatedAt: now
      });
      return true;
    });
    if (!claimed) continue;
    const object = getStorage().bucket().file(`users/${uid}/assets/${snapshot.id}`);
    try {
      await object.delete({ ifGenerationMatch: String(data.generation) });
    } catch (error) {
      const code = (error as { code?: number }).code;
      if (code === 404) continue;
      await db.runTransaction(async (transaction) => {
        const [fresh, usage] = await Promise.all([transaction.get(snapshot.ref), transaction.get(usageRef)]);
        const current = fresh.data();
        if (current?.status !== "deleted" || String(current.generation) !== String(data.generation)) return;
        transaction.update(snapshot.ref, { status: "pending_delete", deletedAt: null, deleteAfter: now, updatedAt: now });
        transaction.set(usageRef, {
          limitBytes: Number(usage.data()?.limitBytes ?? 250_000_000),
          reservedBytes: Number(usage.data()?.reservedBytes ?? 0),
          storedBytes: Number(usage.data()?.storedBytes ?? 0) + Number(current.size ?? 0),
          updatedAt: now
        });
      });
      throw error;
    }
  }

  const tombstoneCutoff = Timestamp.fromMillis(now.toMillis() - TOMBSTONE_MS);
  const tombstones = await db.collectionGroup("encounters")
    .where("deleted", "==", true)
    .where("deletedAt", "<=", tombstoneCutoff)
    .limit(200)
    .get();
  const batch = db.batch();
  for (const snapshot of tombstones.docs) batch.delete(snapshot.ref);
  if (!tombstones.empty) await batch.commit();
}
