# Object Storage and Database Implementation Plan

## Summary

This document is the sole authority for uploaded-file limits, storage quotas,
upload validation, object lifecycle, and garbage collection.

The related database plans have narrower responsibilities:

- `database_decision.md` records the architectural choice: Firestore stores
  structured metadata while Firebase Cloud Storage stores uploaded bytes.
- `database_implementation.md` stores asset references and integrates with the
  object-storage boundary, but should contain no numeric file-size limits,
  per-asset-type quota fields, boundary tests, or upload-enforcement details.
- This document owns the 25 MB background limit, 10 MB token limit, and 250 MB
  total user quota.

## Database integration contract

- Firestore stores server-authoritative asset metadata, usage snapshots, and
  object references.
- The database sync layer uploads required objects before committing documents
  that reference them.
- Upload admission, byte limits, reservations, deduplication, and deletion
  accounting are delegated to `CloudAssetRepository` and defined exclusively
  in this document.
- Google Drive and HTTP(S) references remain external and are not represented
  as stored Cloud Storage objects.

The database implementation plan owns general authentication, entitlement,
synchronization, and error-state requirements. It intentionally contains no
numeric file-size limits, upload-admission algorithm, or object-lifecycle test
matrix.

## Object storage contracts

Extend the shared image-source contract:

```ts
type ImageAssetSource =
  | { kind: "embedded"; dataUrl: string }
  | { kind: "url"; url: string }
  | { kind: "google_drive"; fileId: string }
  | {
      kind: "cloud_storage";
      assetId: string;
      generation: string;
    };
```

- Use the lowercase SHA-256 digest as the per-user `assetId`, with immutable
  objects stored at `users/{uid}/assets/{assetId}`.
- Persist only `assetId` and `generation` in cloud references. Never persist
  bucket paths, signed URLs, or Firebase download URLs.
- Add a `CloudAssetRepository` behind the existing persistence and sync
  boundaries for reservation, resumable upload, readiness polling,
  authenticated blob retrieval, usage retrieval, and retries.
- Store Firestore control records for assets, upload reservations, storage
  usage, and server-derived reference sets.
- Use the asset lifecycle states `reserved`, `ready`, `pending_delete`,
  `deleted`, and `failed`. All transitions and accounting operations must be
  idempotent.

## Storage and lifecycle behavior

Enforce these decimal-byte limits only within the object-storage subsystem:

- Background upload: 25,000,000 bytes.
- Token upload: 10,000,000 bytes.
- Total reserved plus finalized storage: 250,000,000 bytes per user.

Validate the file locally, calculate its SHA-256 digest, and obtain a trusted
reservation before starting a resumable upload.

A ready object with the same digest is reused without increasing usage. Reuse
for another asset type is permitted only when the object satisfies that type's
limit. An asset of 10 MB or less can serve as either a token or background and
is stored once; a larger background cannot be used as a token.

A trusted finalize handler verifies size, MIME type, digest, reservation,
ownership, and object generation before marking an asset ready. Encounter,
Library, draft, and backup documents may reference only ready assets. Remote
commits atomically update their server-derived asset-reference sets.

When the last reference disappears, retain the live object for seven days and
continue counting it toward quota. A new reference cancels deletion. After the
grace period, recheck references and delete the exact object generation before
decrementing usage. Generation preconditions protect against deletion races;
see [Google Cloud request preconditions](https://docs.cloud.google.com/storage/docs/request-preconditions).

Disable bucket-level soft delete so the application's seven-day recovery
period is the only retention window; see the
[Google Cloud soft-delete policy](https://docs.cloud.google.com/storage/docs/disable-soft-delete).

Keep the bucket private. Rules permit only authenticated owner reads and
reservation-backed immutable creates. Clients cannot overwrite or delete
objects. Rules validate size, MIME type, metadata, and Firestore reservation
records; see
[Firebase Storage Rules](https://firebase.google.com/docs/storage/security/rules-conditions).
Require valid Firebase App Check attestation for production Storage and
callable Function requests. App Check supplements rather than replaces Firebase
Authentication, Storage Rules, Firestore Rules, and server-side authorization.
Use the shared Firebase web configuration's reCAPTCHA Enterprise provider with
token auto-refresh; allow the debug provider only in explicit local-development
and emulator environments.

Store only original uploaded bytes. Do not create server-side thumbnails or
derivatives initially. Resolve objects through the authenticated Storage SDK
and maintain an evictable IndexedDB cache keyed by `{assetId, generation}`.

Google Drive and HTTP(S) assets remain externally hosted and consume no Cloud
Storage quota.

## Migration and failure behavior

- Migrate existing `dataUrl` values to the `embedded` source variant.
- Upload embedded bytes before substituting cloud references in remote
  documents.
- Keep a valid local asset unchanged and exportable when a cloud upload is
  rejected or fails.
- Lossless exports embed required Cloud Storage or Google Drive bytes. Abort
  with an actionable list of unavailable assets when required bytes cannot be
  resolved from the provider or local cache.
- Periodically reconcile expired reservations, orphaned objects, missing
  objects, stale reference sets, and quota drift without deleting referenced
  assets automatically.

## Rollout

Implement in this order:

1. Shared source schema, validation, and migrations.
2. Firebase rules, trusted functions, App Check monitoring, and Emulator Suite
   configuration.
3. Upload and local-cache adapter.
4. Sync and reference integration.
5. Garbage collection and reconciliation.
6. Production App Check enforcement and enablement with operational metrics and
   alerts.

## Verification

Add unit coverage for source migration, hashing, quota calculations,
deduplication, cross-type eligibility, cache keys, and idempotent lifecycle
transitions.

Use Firebase Emulator coverage for:

- Ownership isolation and unauthenticated access.
- Missing, invalid, and valid App Check context for Storage and callable
  Function operations, including the explicit emulator/debug path.
- Forged paths, sizes, asset types, metadata, tiers, and reservation IDs.
- Concurrent reservations at the 250 MB boundary.
- Duplicate uploads and retried finalize or deletion events.
- Background-versus-token limit enforcement when reusing objects.
- Direct overwrite and deletion denial.
- Atomic source-document and reference-set updates.
- Seven-day deletion, re-reference recovery, generation-safe deletion, and
  quota decrement.
- Expired reservations, orphan reconciliation, and missing-object handling.

Add integration coverage for Library uploads, background and actor rendering,
reload, offline cached access, cache eviction, multi-device retrieval, Google
Drive exclusion from quota, failed-upload recovery, and lossless export.

Keep all exact byte-boundary tests in the object-storage test suite rather than
the database synchronization suite. Run `npm run test:agent`,
`npm run typecheck`, and `npm run build` before considering the implementation
complete.
