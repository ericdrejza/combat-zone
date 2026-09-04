import { createHash } from "node:crypto";
import type { CloudCommand, CloudCommandResult, ReplaceWorkspacePayload } from "@combat-zone/firebase-api";
import { getFirestore, Timestamp, type DocumentReference, type Transaction } from "firebase-admin/firestore";
import { ApiError } from "./errors.js";

type CommitInput<T> = {
  assetIds?: string[];
  command: CloudCommand<T>;
  data: Record<string, unknown>;
  referenceKey?: string;
  requireExisting?: boolean;
  target: DocumentReference;
  uid: string;
};

type ReferenceChange = { key: string; assetIds: string[]; revision: number };

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function fingerprint(value: unknown): string {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

function currentRevision(data: FirebaseFirestore.DocumentData | undefined): number | null {
  return typeof data?.revision === "number" ? data.revision : null;
}

/** Owns revision, idempotency, and asset-readiness invariants for API writes. */
export class FirestoreApiStore {
  private readonly db = getFirestore();

  async commit<T>({ assetIds = [], command, data, referenceKey, requireExisting = false, target, uid }: CommitInput<T>): Promise<CloudCommandResult> {
    const requestFingerprint = fingerprint(command);
    const updatedAt = Timestamp.now();
    this.assertDocumentSize(data);
    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(target);
      const existing = snapshot.data();
      if (existing?.lastMutationId === command.mutationId) {
        if (existing.lastMutationFingerprint !== requestFingerprint) {
          throw new ApiError("IDEMPOTENCY_MISMATCH", "The mutation ID was reused with different content.");
        }
        return { status: "already_applied", mutationId: command.mutationId, revision: existing.revision, updatedAt: existing.updatedAt.toMillis() };
      }
      const actualRevision = currentRevision(existing);
      if (requireExisting && !snapshot.exists) throw new ApiError("NOT_FOUND", "The cloud record does not exist.");
      if (actualRevision !== command.expectedRevision) {
        throw new ApiError("REVISION_CONFLICT", "The cloud record changed.", false, {
          expectedRevision: command.expectedRevision ?? undefined,
          actualRevision: actualRevision ?? undefined
        });
      }
      const nextRevision = (actualRevision ?? 0) + 1;
      const assetUpdates = referenceKey
        ? await this.prepareReferenceUpdates(transaction, uid, [{ key: referenceKey, assetIds, revision: nextRevision }])
        : [];
      if (!referenceKey) await this.assertAssetsReady(transaction, uid, assetIds);
      transaction.set(target, {
        ...data,
        revision: nextRevision,
        updatedAt,
        lastMutationId: command.mutationId,
        lastMutationFingerprint: requestFingerprint,
        createdAt: existing?.createdAt ?? updatedAt
      });
      if (referenceKey) {
        transaction.set(this.db.doc(`users/${uid}/asset_reference_sets/${referenceKey}`), {
          assetIds,
          revision: nextRevision,
          updatedAt
        });
      }
      for (const update of assetUpdates) transaction.set(update.ref, update.data);
      return { status: "applied", mutationId: command.mutationId, revision: nextRevision, updatedAt: updatedAt.toMillis() };
    });
  }

  user(uid: string): DocumentReference {
    return this.db.doc(`users/${uid}`);
  }

  encounter(uid: string, encounterId: string): DocumentReference {
    return this.db.doc(`users/${uid}/encounters/${encounterId}`);
  }

  singleton(uid: string, id: "library" | "recovery_draft"): DocumentReference {
    return this.db.doc(`users/${uid}/singletons/${id}`);
  }

  async replaceWorkspace(uid: string, command: CloudCommand<ReplaceWorkspacePayload>): Promise<CloudCommandResult> {
    const requestFingerprint = fingerprint(command);
    const updatedAt = Timestamp.now();
    if (Buffer.byteLength(canonical(command.payload), "utf8") > 8_000_000) {
      throw new ApiError("WORKSPACE_TOO_LARGE", "The workspace exceeds the API payload limit.");
    }
    for (const encounter of command.payload.encounters) this.assertDocumentSize(encounter);
    this.assertDocumentSize(command.payload.library);
    if (command.payload.recoveryDraft) this.assertDocumentSize(command.payload.recoveryDraft);
    return this.db.runTransaction(async (transaction) => {
      const root = this.user(uid);
      const [rootSnapshot, existingEncounters] = await Promise.all([
        transaction.get(root),
        transaction.get(this.db.collection(`users/${uid}/encounters`))
      ]);
      const existing = rootSnapshot.data();
      if (existing?.lastMutationId === command.mutationId) {
        if (existing.lastMutationFingerprint !== requestFingerprint) throw new ApiError("IDEMPOTENCY_MISMATCH", "The mutation ID was reused with different content.");
        return { status: "already_applied", mutationId: command.mutationId, revision: existing.revision, updatedAt: existing.updatedAt.toMillis() };
      }
      const actualRevision = currentRevision(existing);
      if (actualRevision !== command.expectedRevision) {
        throw new ApiError("REVISION_CONFLICT", "The cloud workspace changed.", false, {
          expectedRevision: command.expectedRevision ?? undefined,
          actualRevision: actualRevision ?? undefined
        });
      }
      const incomingIds = new Set(command.payload.encounters.map(({ encounterId }) => encounterId));
      const removed = existingEncounters.docs.filter(({ id }) => !incomingIds.has(id));
      const writeCount = 5 + command.payload.encounters.length * 2 + removed.length * 2;
      const revision = (actualRevision ?? 0) + 1;
      const mutation = { lastMutationId: command.mutationId, lastMutationFingerprint: requestFingerprint, updatedAt };
      const referenceChanges: ReferenceChange[] = [
        ...command.payload.encounters.map((encounter) => ({ key: `encounter_${encounter.encounterId}`, assetIds: encounter.assetIds, revision: 1 })),
        ...removed.map((snapshot) => ({ key: `encounter_${snapshot.id}`, assetIds: [], revision: (currentRevision(snapshot.data()) ?? 0) + 1 })),
        { key: "library", assetIds: command.payload.library.assetIds, revision: 1 },
        { key: "recovery_draft", assetIds: command.payload.recoveryDraft?.assetIds ?? [], revision: 1 }
      ];
      const assetUpdates = await this.prepareReferenceUpdates(transaction, uid, referenceChanges);
      if (writeCount + assetUpdates.length > 450) {
        throw new ApiError("WORKSPACE_TOO_LARGE", "The workspace requires too many atomic writes.");
      }
      transaction.set(root, { ...command.payload.workspace, ...mutation, revision });
      for (const encounter of command.payload.encounters) {
        transaction.set(this.encounter(uid, encounter.encounterId), { ...encounter, ...mutation, deleted: false, revision: 1 });
        transaction.set(this.db.doc(`users/${uid}/asset_reference_sets/encounter_${encounter.encounterId}`), { assetIds: encounter.assetIds, revision: 1, updatedAt });
      }
      for (const snapshot of removed) {
        const deletedRevision = (currentRevision(snapshot.data()) ?? 0) + 1;
        transaction.set(snapshot.ref, { encounterId: snapshot.id, deleted: true, deletedAt: updatedAt, ...mutation, revision: deletedRevision });
        transaction.set(this.db.doc(`users/${uid}/asset_reference_sets/encounter_${snapshot.id}`), { assetIds: [], revision: deletedRevision, updatedAt });
      }
      transaction.set(this.singleton(uid, "library"), { ...command.payload.library, ...mutation, deleted: false, revision: 1 });
      transaction.set(this.db.doc(`users/${uid}/asset_reference_sets/library`), { assetIds: command.payload.library.assetIds, revision: 1, updatedAt });
      const draft = command.payload.recoveryDraft;
      transaction.set(this.singleton(uid, "recovery_draft"), draft ? { ...draft, ...mutation, deleted: false, revision: 1 } : { ...mutation, deleted: true, deletedAt: updatedAt, revision: 1 });
      transaction.set(this.db.doc(`users/${uid}/asset_reference_sets/recovery_draft`), { assetIds: draft?.assetIds ?? [], revision: 1, updatedAt });
      for (const update of assetUpdates) transaction.set(update.ref, update.data);
      return { status: "applied", mutationId: command.mutationId, revision, updatedAt: updatedAt.toMillis() };
    });
  }

  private async assertAssetsReady(transaction: Transaction, uid: string, assetIds: string[]): Promise<void> {
    for (const assetId of assetIds) {
      const snapshot = await transaction.get(this.db.doc(`users/${uid}/assets/${assetId}`));
      if (snapshot.data()?.status !== "ready") {
        throw new ApiError("ASSET_NOT_READY", `Asset ${assetId} is not ready.`);
      }
    }
  }

  private async prepareReferenceUpdates(
    transaction: Transaction,
    uid: string,
    changes: ReferenceChange[]
  ): Promise<Array<{ ref: DocumentReference; data: Record<string, unknown> }>> {
    const referenceRefs = changes.map(({ key }) =>
      this.db.doc(`users/${uid}/asset_reference_sets/${key}`)
    );
    const referenceSnapshots = referenceRefs.length
      ? await transaction.getAll(...referenceRefs)
      : [];
    const deltas = new Map<string, number>();
    changes.forEach((change, index) => {
      const oldIds = new Set<string>(referenceSnapshots[index]?.data()?.assetIds ?? []);
      const nextIds = new Set(change.assetIds);
      for (const id of oldIds) {
        if (!nextIds.has(id)) deltas.set(id, (deltas.get(id) ?? 0) - 1);
      }
      for (const id of nextIds) {
        if (!oldIds.has(id)) deltas.set(id, (deltas.get(id) ?? 0) + 1);
      }
    });
    const requiredIds = new Set(changes.flatMap(({ assetIds }) => assetIds));
    const assetIds = [...new Set([...requiredIds, ...deltas.keys()])];
    const assetRefs = assetIds.map((assetId) =>
      this.db.doc(`users/${uid}/assets/${assetId}`)
    );
    const assetSnapshots = assetRefs.length
      ? await transaction.getAll(...assetRefs)
      : [];
    const now = Timestamp.now();

    return assetSnapshots.flatMap((snapshot, index) => {
      const assetId = assetIds[index];
      const data = snapshot.data();
      if (
        requiredIds.has(assetId) &&
        data?.status !== "ready" &&
        data?.status !== "pending_delete"
      ) {
        throw new ApiError("ASSET_NOT_READY", `Asset ${assetId} is not ready.`);
      }
      const delta = deltas.get(assetId);
      if (!data || delta === undefined) return [];
      const refCount = Math.max(0, Number(data.refCount ?? 0) + delta);
      return [{
        ref: snapshot.ref,
        data: {
          ...data,
          refCount,
          status: refCount === 0 ? "pending_delete" : "ready",
          deleteAfter: refCount === 0
            ? Timestamp.fromMillis(now.toMillis() + 7 * 24 * 60 * 60 * 1000)
            : null,
          updatedAt: now
        }
      }];
    });
  }

  private assertDocumentSize(value: unknown): void {
    if (Buffer.byteLength(canonical(value), "utf8") > 950_000) {
      throw new ApiError("WORKSPACE_TOO_LARGE", "A cloud document exceeds the safe size limit.");
    }
  }
}
