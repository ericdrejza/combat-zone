# Firebase Backend Implementation Plan

## Status and objective

This document plans the optional cloud-sync phase selected in
[`database_decision.md`](./database_decision.md). It does not replace local
persistence: IndexedDB remains the local source of truth, while the Firebase
backend adds authenticated backup and multi-device synchronization. Cloud
Firestore remains the database within that backend; Firebase and Firestore are
not alternative choices.

Uploaded-image storage, limits, reservations, and object lifecycle are defined
separately in
[`object_storage_implementation.md`](./object_storage_implementation.md). This
document covers only the database and synchronization side of that boundary.
The application-facing Firebase contract and callable API are defined in
[`firebase_api_implementation.md`](./firebase_api_implementation.md).

The implementation will provide:

- Google-only Firebase Authentication.
- Cloud Firestore storage for versioned workspace documents.
- Second-generation Cloud Functions for privileged writes and workflows.
- Firebase Cloud Storage for uploaded background and token images.
- Firebase App Check for production Firestore, Storage, and Functions access.
- Google Drive Picker integration for linking images without copying them into
  Firebase Cloud Storage.
- A durable IndexedDB outbox for offline changes.
- Revision-based synchronization and lossless conflict copies.
- Detailed cloud status in Settings and a compact toolbar indicator.

Cloud sync is not live multi-user collaboration. Redux history, transient
interaction state, viewport state, and derived rendering data remain local and
session-only.

## Product decisions to record

Before implementing runtime behavior, update `documentation/DESIGN.md` and
`documentation/ACCEPTANCE.md` with these resolved decisions:

- Signing in with Google automatically starts cloud synchronization after the
  entitlement check.
- The active encounter selection is device-local and is not synchronized.
- The recovery draft is synchronized.
- The five most recently accessed saved encounters are synchronized and shown
  in a derived **Recent** group at the top of the Encounters Library.
- Cloud controls and detailed state live in Settings. A separate compact cloud
  state indicator appears beside the existing local save status.
- Local reset signs out and removes local sync state without deleting remote
  data.
- Google Drive-linked assets remain owned and stored in Drive, become available
  after Google authorization, and are not copied into Cloud Storage.

Update `documentation/ARCHITECTURE.md` when the new interfaces and data flow are
implemented. Mark the Cloud Sync roadmap item complete only after every test and
acceptance requirement in this plan passes.

## Dependencies and Firebase configuration

- Add the modular Firebase web SDK to the application.
- Initialize only Authentication, Firestore, Functions, Storage, and App Check;
  do not enable Realtime Database or unrelated Firebase products.
- Enable the Google Drive API and Google Picker API in the same Google Cloud
  project used for Firebase Authentication.
- Request only the non-sensitive `drive.file` OAuth scope and use Google Picker
  so users explicitly choose the files shared with the application. Do not
  request full-drive or drive-wide read scopes.
- Add Firebase Admin, second-generation Cloud Functions, and Firebase CLI
  tooling for trusted synchronization services and the Emulator Suite.
- Keep Cloud Functions in a separate TypeScript package so browser builds never
  include Admin credentials or server dependencies.
- Read browser Firebase configuration from typed Vite environment variables.
  No environment-specific project identifiers belong in application modules.
- Add checked-in `firebase.json`, Firestore rules, Storage rules, index
  configuration, and emulator configuration.
- Connect Authentication, Firestore, Storage, and Functions SDKs to their
  emulators only when the explicit emulator environment flag is enabled.
- Configure App Check with `ReCaptchaEnterpriseProvider`, token auto-refresh,
  and a typed
  `VITE_FIREBASE_APP_CHECK_RECAPTCHA_ENTERPRISE_SITE_KEY` environment value.
  Register only real deployment domains with the production key. Use the App
  Check debug provider only in explicit local-development environments, and
  never ship a debug token in a production bundle.
- Roll out App Check in monitoring mode before enforcing it for Firestore,
  Storage, and callable Functions.
- If Firebase configuration is absent, render cloud sync as unavailable while
  preserving all local features.
- Use the same production region for Firestore, Cloud Storage, and Cloud
  Functions to avoid unnecessary latency and cross-region transfer.
- Keep Firebase Hosting out of this backend implementation. The Vite build may
  use it later through a separate deployment decision.
- Keep Google Drive OAuth access tokens in memory only. When Drive authorization
  expires, reauthorize the Firebase Google user with the `drive.file` scope;
  never store provider access or refresh tokens in Firestore or IndexedDB.

## Interfaces and module boundaries

Keep `WorkspaceRepository` unchanged as the interface used by Redux and UI
orchestration. Add focused companion interfaces under `core/persistence`:

### Shared image-source contract

Replace string/data-URL-only image fields with one shared discriminated source
type used by Library assets, actor images, and encounter backgrounds:

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

Keep name, media type, and dimensions beside the source in the owning image
record. A Drive cache is stored separately by file ID and is never duplicated
inside EncounterState or Library state. Rendering resolves each source through
a shared selector/service and uses the cached bytes only as a derived local
resource.

Bump and migrate the affected encounter and persistence schema versions:

- Existing HTTP(S) `dataUrl` values migrate to `kind: "url"`.
- Existing base64/blob `dataUrl` values migrate to `kind: "embedded"`.
- Migration must be lossless and must not modify IDs, relationships, ordering,
  or history behavior.
- Import/export validation must understand all source variants and reject an
  invalid or incomplete Drive reference before it reaches Redux.

### `LocalSyncRepository`

Own durable local synchronization state:

- Read and update the authenticated sync identity and last acknowledged remote
  revisions.
- List, coalesce, and acknowledge pending record operations.
- Persist encounter deletion tombstones.
- Record local recent-encounter access timestamps.
- Cache the last server-authoritative object-storage usage snapshot for offline
  UI.
- Clear only application-owned sync records during reset.

The IndexedDB adapter implements this interface alongside
`WorkspaceRepository`. Its in-memory equivalent supports deterministic unit
tests.

### `CloudWorkspaceRepository`

Own Firestore-specific behavior:

- Detect, read, validate, and subscribe to the authenticated user's workspace.
- Read and subscribe through the authenticated Firestore client SDK.
- Submit revision-checked encounter, Library, recovery-draft, recent-access,
  and tombstone writes through authenticated callable Functions.
- Atomically commit each remote record and its server-derived asset-reference
  metadata in trusted Function transactions.
- Reject unsupported cloud schema versions before returning data to the sync
  coordinator.
- Never return Firebase SDK types outside the adapter.

### `CloudAssetRepository`

Own the object-storage integration used by synchronization. Its upload,
download, usage, and lifecycle contracts are defined in
[`object_storage_implementation.md`](./object_storage_implementation.md).

### `GoogleDriveAssetRepository`

Own Google Picker and Drive API behavior:

- Open an image-filtered Picker after the Firebase-authenticated user grants the
  `drive.file` scope.
- Return selected file IDs and validated name, MIME type, size, modified time,
  and image dimensions when available.
- Fetch selected blob content with an authorized Drive request when rendering,
  caching, or exporting requires the bytes.
- Refresh authorization through the Google sign-in flow when access expires.
- Distinguish deleted files, revoked permission, download restrictions, and
  transient network failures without replacing valid local metadata.

### `CloudSyncEntitlement`

Resolve the authenticated user's server-authoritative tier and feature
entitlements. Billing, checkout, subscription lifecycle, and webhook processing
remain outside this plan, but a future billing adapter can replace the
entitlement implementation.

### `CloudSyncCoordinator`

Own the synchronization state machine, initial reconciliation, outbox draining,
remote listeners, offline retry, conflict resolution, asset ordering, and
sign-out/reset suspension. UI and Redux code must not call Firebase directly.

Expose a `CloudSyncContextValue` containing:

- `user`, entitlement state, object-storage usage snapshot, and last successful
  synchronization time.
- `signIn`, `signOut`, `retry`, and initial-reconciliation actions.
- `unavailable`, `signedOut`, `authenticating`, `entitlementRequired`,
  `reconciling`, `syncing`, `synced`, `offline`, or `error` status.
- A user-facing error that does not discard the underlying diagnostic cause.

## Firebase service boundaries

- Authentication establishes the Firebase UID and Google identity used by
  every cloud adapter.
- Firestore stores only versioned structured records and stable asset
  references.
- Callable Functions perform privileged or cross-record mutations and use the
  Admin SDK; browser code never receives Admin credentials.
- Cloud Storage stores uploaded image bytes through `CloudAssetRepository`.
- App Check attests requests from the deployed application and remains
  defense-in-depth alongside Authentication, Security Rules, and IAM.
- The Emulator Suite is the required local and CI integration environment.
- Google Drive remains an external Google API integration and is not a Firebase
  storage service.

## Local IndexedDB changes

Bump the IndexedDB database version and add application-owned `sync_state` and
`sync_outbox` object stores.

The outbox is a coalesced record queue rather than an unbounded action log:

- Keys identify the record category and ID.
- An operation records upsert or deletion, local revision, last acknowledged
  remote revision, and queue timestamp.
- A newer operation for the same record replaces the older pending operation.
- Encounter deletion retains a tombstone until the remote deletion is
  acknowledged.
- Library, draft, and encounter mutations journal their pending operation in
  the same IndexedDB transaction as the local record change where possible.
- Startup compares local records and acknowledged revisions to repair a queue
  entry lost to an interrupted write.
- Workspace import or overwrite rebuilds the coalesced outbox against the last
  acknowledged remote record set.

Only the tab holding the existing workspace writer lock may run the coordinator
or mutate the outbox. A tab gaining the lock reloads IndexedDB before starting
sync.

## Firestore document model

Store one logical workspace below each authenticated Firebase UID:

- The workspace document contains cloud schema version, workspace revision,
  update time, and at most five recent-access entries shaped as encounter ID and
  access timestamp.
- Each saved encounter has its own versioned document containing the complete
  binary-free encounter aggregate, folder ID, revision, timestamps, and
  optional deletion tombstone.
- Library and recovery draft are independently revisioned singleton documents.
- Uploaded-image fields contain stable cloud asset references rather than image
  bytes. Firestore asset-control records are owned by the object-storage plan.
- Drive-linked assets contain the Drive file ID and display metadata, but no
  Google access token or copied image bytes.

Do not store `activeEncounterId`, Redux history, action logs, interaction
drafts, viewport state, layout caches, route caches, or derived geometry in
Firestore.

All remote records have an independent cloud schema version. Validate and
migrate them before creating local records. Reject unsupported newer versions
without mutating IndexedDB.

## Object-storage integration

Use a remote wire representation separate from local domain and export types:

- Ask `CloudAssetRepository` to resolve embedded uploaded image data to a ready,
  stable cloud reference before writing a Firestore document.
- Represent a Drive-linked image as a stable reference containing its Firestore
  asset ID and Google Drive file ID. The Drive file remains the authoritative
  source and is not copied into Firebase Cloud Storage.
- Preserve ordinary HTTP(S) image URLs as URLs without copying them into Cloud
  Storage.
- Upload the object before committing a Firestore document that references it.
- On download, resolve asset references and reconstruct the existing local data
  representation so offline rendering and lossless JSON export still work.
- Cache Drive content in application-owned IndexedDB only after it is fetched.
  The cache is evictable and non-authoritative: a cache hit permits offline
  rendering, while a cache miss shows an unavailable-image placeholder without
  blocking the rest of the encounter.
- Treat Drive references as live links, matching existing HTTP(S) linked-image
  behavior. A changed Drive file refreshes the cache and displayed content on
  the next successful fetch; Redux history owns the reference, not external
  Drive revisions.
- If a Drive file is deleted, download-restricted, or no longer shared with the
  application, retain the Library reference, show its unavailable state, and
  offer reauthorization, relinking, removal, or upload-to-cloud actions.
- Full workspace and encounter exports must remain lossless. Resolve Drive
  references and embed their bytes in the export envelope at export time. If
  any required Drive file cannot be fetched and is absent from the local cache,
  fail the export with the affected asset names rather than silently producing
  an incomplete file.
- Export resolution operates on a cloned envelope: Drive sources become
  embedded sources in the exported copy without changing the live Library,
  EncounterState, Redux history, or subsequent synchronization behavior.
- Preflight the binary-free Firestore document size and fail cloud sync before a
  document reaches Firestore's size limit. Preserve the valid local record and
  show an export recovery action.

Never commit a reference until `CloudAssetRepository` reports the object ready.
If the subsequent Firestore commit fails, leave object retry and garbage
collection to the repository. Uploaded-file limits, usage accounting,
deduplication, finalization, and deletion are not database responsibilities and
are specified only in the object-storage plan.

## Authentication and initial reconciliation

Support Google sign-in only. Prefer popup authentication and fall back to the
Firebase redirect flow when a popup cannot be used. Observing an authenticated
user immediately starts the entitlement check and reconciliation.

Request Drive authorization incrementally when the user first chooses
**Link from Google Drive**. Thereafter, an authenticated Google user may access
previously selected files granted through `drive.file`; if the provider token
has expired or the grant is unavailable on a new device, prompt to reconnect
Google Drive without signing the user out of Combat Zone.

If the user has no cloud workspace:

1. Flush local persistence.
2. Resolve embedded uploads through `CloudAssetRepository`.
3. Upload the latest local records and mark their remote revisions acknowledged.

If cloud data already exists, pause remote writes while local editing remains
available and offer:

- **Merge**: validate the remote workspace, apply existing collision-safe local
  merge semantics, then synchronize the merged result.
- **Use cloud**: create a local backup, atomically replace local records, and
  load the cloud workspace with fresh Redux history.
- **Keep this device**: download the cloud workspace into a local recovery
  backup, require destructive confirmation, then replace cloud records.

Flush the latest local state immediately before applying the selected action.
Invalid or unsupported remote data leaves IndexedDB unchanged.

Sign-out stops listeners and queue draining but preserves local data, remote
data, and pending operations. Signing in again repeats reconciliation when the
remote baseline changed.

## Continuous sync and conflict handling

Push assets before their referencing documents. Use Firestore transactions to
compare the last acknowledged remote revision with the current revision.

For encounter update conflicts:

- Keep the remote state under the original encounter ID.
- Save the local state under a collision-safe new ID and append
  **(Conflict copy)** to its name, using a numeric suffix when needed.
- Queue the new encounter for upload.
- If the user was editing the local version, keep the new conflict copy active
  on that device.

For a local deletion conflicting with a newer remote update:

- Honor the local deletion of the original identity.
- Preserve the newer remote state under a new conflict-copy ID locally and
  remotely.

For concurrent recovery drafts, retain the latest draft by update timestamp and
convert the other draft into a saved conflict-copy encounter. Never discard a
valid draft silently.

Three-way merge concurrent Library changes using the last acknowledged Library
as the base:

- Apply changes made on only one side.
- Accept identical changes once.
- Preserve the remote node under its original ID when both sides changed it
  differently.
- Clone the local node or subtree with collision-safe IDs and a conflict-copy
  name.
- Rewrite parent, child, link target, and encounter-folder references within
  the cloned structure.
- Treat delete-versus-modify as a conflict and preserve the modified version as
  a conflict copy.

Retain remote deletion tombstones long enough for offline clients to observe
them. Tombstone cleanup must not occur until the configured acknowledgement
policy is satisfied.

## Recently accessed encounters

- Record access only after successfully loading a saved encounter; recovery
  drafts are excluded.
- Persist local access timestamps even while signed out.
- Merge local and remote entries by taking the newest timestamp per encounter.
- Remove missing or tombstoned encounter IDs, sort newest first, and retain five.
- Update the remote list using a revision transaction.
- Render the derived Recent group above the existing encounter hierarchy. Reuse
  the existing encounter-card behavior and do not create duplicate Library
  nodes or persisted encounter records.

## UI behavior

Add a Cloud Sync section to Settings with:

- Google sign-in and sign-out actions.
- Authenticated profile summary.
- Entitlement and connection state.
- Last successful synchronization time and retry action.
- Object-storage status supplied by `CloudAssetRepository`.
- Google Drive connection state and a reconnect action when Drive authorization
  expires independently of Firebase Authentication.
- Actionable authentication, object-storage, offline, conflict, and sync errors.

Add a separate accessible toolbar indicator for authenticating, reconciling,
syncing, synced, offline, and error states. Keep the local save status distinct.
Use established icons and Motion for status transitions.

Add **Link from Google Drive** to the Add controls for the Backgrounds and
Tokens Library sections. Open an image-filtered, multi-select Google Picker,
create reference-backed Library nodes, and visually distinguish Drive-linked
assets from uploaded or ordinary URL-linked assets. These controls require an
authenticated Google user but do not create a Cloud Storage object.

## Security and reset behavior

- Firestore Rules deny unauthenticated access and restrict every workspace path
  to the matching UID.
- Firestore Rules validate ownership and constrain client reads and queries.
- Callable Functions validate allowed fields, schema versions, record ID
  consistency, expected revisions, and asset readiness before using the Admin
  SDK to commit server-controlled writes.
- Client reads and listeners are allowed only for the owning UID. Direct client
  writes to server-controlled synced records are denied; callable Functions
  perform those writes after checking Authentication and App Check context.
- Object access, upload validation, and garbage-collection security are defined
  in the object-storage plan.
- Only trusted Functions and Admin SDK code may update entitlements or other
  server-owned synchronization state.
- Never place Admin credentials or secret keys in browser code.

Local reset must first suspend sync, stop listeners, and cancel new uploads. It
then signs out, clears Firebase client caches where supported, clears the local
outbox and cached cloud-service status, and runs the existing
interrupted-reset-safe IndexedDB cleanup. Remote data is not deleted. A later
sign-in offers the normal reconciliation choices.

## Verification plan

Add Vitest unit coverage for:

- Remote/local asset serialization and lossless rehydration.
- Legacy image-source migration for embedded data URLs and HTTP(S) URLs across
  Library, actor, and background records, including import/export round trips.
- Uploaded data URLs, retained HTTP(S) URLs, digest deduplication, upload
  ordering, orphan cleanup, and Firestore document-size rejection.
- Drive Picker selection, `drive.file` authorization, Drive-reference
  serialization, authenticated fetching, cache hits and misses, changed files,
  expired authorization, revoked access, deleted files, download restrictions,
  relinking, and lossless export embedding.
- Proof that Drive-linked and HTTP(S)-linked assets are not submitted to
  `CloudAssetRepository` for upload.
- Outbox coalescing, atomic journaling, startup repair, tombstones, acknowledgement,
  import, overwrite, reset, and writer-lock transfer.
- First upload, Merge, Use cloud, Keep this device, sign-out, reconnect, offline
  retry, unsupported versions, and write failures.
- Encounter update/delete conflicts, recovery-draft conflicts, and Library
  three-way merge with complete reference remapping.
- Recent-list timestamp merging, deletion filtering, five-item truncation, and
  derived Library presentation.
- Cloud status, Settings controls, object-storage errors, and accessible labels.

Use the Firebase Emulator Suite to verify:

- Unauthenticated denial and strict UID isolation.
- App Check monitoring and enforcement behavior, including rejected missing or
  invalid attestations and accepted emulator/debug requests.
- Firestore schema and revision rules.
- Direct client-write denial and authenticated callable commit behavior.
- Function retries remain idempotent and never partially update a record and
  its asset-reference metadata.
- Cloud asset references are rejected until the object-storage adapter reports
  the referenced object ready.
- Revision conflicts, offline queue replay, conflict copies, and remote
  preservation after local reset.

File-size boundaries, reservations, deduplication, object ownership, deletion,
and usage-accounting tests belong to the object-storage plan and test suite.

Completion requires `npm run test:agent`, the emulator test command,
`npm run typecheck`, and `npm run build` to pass. Update the persistence
architecture documentation and move the Cloud Sync roadmap item to completed
only after this verification succeeds.

Before production enablement, configure Firebase budget alerts, usage
dashboards, and structured Function logging for repeated sync failures,
authorization denials, abnormal request volume, and object-reference drift.

## Assumptions and non-goals

- Firebase is the managed backend platform and Cloud Firestore is its selected
  cloud database.
- Firebase Realtime Database is not used. Presence and continuous shared-state
  streaming are not current requirements.
- Firebase Hosting, Analytics, Remote Config, Cloud Messaging, and other
  unlisted Firebase products remain out of scope.
- Google Drive is an external, live asset source. Drive-linked files remain
  subject to the user's Drive ownership, sharing, download, and availability
  settings rather than application object storage.
- Local IndexedDB data remains usable after authentication, entitlement,
  network, Functions, Firestore, or Storage failures.
- This plan does not add billing, GraphQL, CRDTs, live collaboration, RxDB,
  public provider plugins, or server-side analytics.

## References

- [Firebase Google sign-in](https://firebase.google.com/docs/auth/web/google-signin)
- [Choose between Cloud Firestore and Realtime Database](https://firebase.google.com/docs/database/rtdb-vs-firestore)
- [Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/rules-conditions)
- [Firebase App Check](https://firebase.google.com/docs/app-check)
- [App Check with reCAPTCHA Enterprise for web](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider)
- [Cloud Storage Security Rules](https://firebase.google.com/docs/storage/security)
- [Authenticated callable functions](https://firebase.google.com/docs/functions/callable)
- [Firebase Local Emulator Suite](https://firebase.google.com/docs/emulator-suite)
- [Google Drive API scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [Google Picker for web apps](https://developers.google.com/workspace/drive/picker/guides/web-picker)
- [Downloading Drive files](https://developers.google.com/workspace/drive/api/guides/manage-downloads)
