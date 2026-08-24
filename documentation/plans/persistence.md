# Local-First Persistence Plan

## Status and decision summary

This document records the persistence architecture selected and implemented
for Roadmap Part 14 on 2026-08-24.

- IndexedDB is the MVP persistence engine, accessed through the application's
  typed Promise-based adapter. This avoids a runtime dependency while keeping
  raw IndexedDB requests and transactions behind the repository boundary.
- The application owns a typed repository boundary, document schemas,
  migrations, validation, and import/export behavior.
- RxDB, GraphQL, live collaboration, and user-configurable storage providers
  are not part of the MVP.
- Optional post-MVP cloud sync uses Firestore for versioned manifests and
  Firebase Cloud Storage for uploaded maps and tokens.
- IndexedDB remains the local source when cloud sync is introduced.

`localStorage` is not suitable for encounter or library data because it is
synchronous, string-only, and too constrained for uploaded image data. RxDB is
a database and replication layer over storage engines such as IndexedDB rather
than a separate storage location; its additional synchronization machinery is
not needed for the MVP.

## Persisted model and repository boundary

Add an internal `WorkspaceRepository` interface rather than coupling Redux or
UI components to IndexedDB. It must support:

- Workspace initialization and manifest reads/writes.
- Encounter creation, listing, loading, revision-checked saving, duplication,
  movement within the Encounter Library, and deletion.
- One autosaved recovery draft that has not yet been assigned a Library path.
- Asset Library persistence and explicit save flushing.
- Atomic workspace import, safety-backup creation, and reference remapping.
- Schema inspection and migration before data reaches Redux.
- Complete local-data reset through a separate `LocalDataResetService`.

Persist records by responsibility so an encounter edit does not rewrite the
entire workspace:

- A workspace manifest containing its schema version and active encounter ID.
- One versioned record per saved encounter.
- At most one unfiled recovery-draft record.
- Library folders, encounter entries, backgrounds, and tokens.
- Recoverable pre-import backups.

Every persisted `EncounterState` retains its encounter `schemaVersion`. The
workspace/export envelope has its own schema version and a `kind` discriminator.
Load and import must validate the envelope, migrate supported older versions,
reject unsupported newer versions, and leave existing local data untouched on
failure.

Only the current `EncounterState` is durable. Redux `past` and `future`
snapshots, action logs, interaction drafts, viewport state, layout caches, and
other derived render data remain session-only. Loading an encounter creates a
fresh history state around the loaded snapshot, clears transient interaction
and log state, and zooms the canvas to fit.

## Local autosave and manual save

- Request persistent origin storage with `navigator.storage.persist()` when
  available, without blocking the application if the request is denied.
- Queue an encounter autosave after every commit, undo, and redo, using a
  500ms trailing debounce. Library mutations save their own records separately.
- Flush pending writes before switching encounters and when the document
  becomes hidden. An explicit Save always bypasses the debounce.
- Surface `Saving`, `Saved`, and `Save failed` states beside the encounter
  title. A failed write must preserve the in-memory state and offer JSON export
  as a recovery path.
- Restore the latest active saved encounter or recovery draft before rendering
  the editable workspace after a refresh.

A new encounter begins as an autosaved recovery draft. Its first explicit Save
opens an Encounter Library folder picker. Saving there creates the durable
encounter record and Library entry. All later autosaves and explicit saves
overwrite that record using its stable ID and revision. Attempting to load or
create another encounter while an unfiled draft is active prompts the user to
Save, Discard, or Cancel.

Replace the static **Combat Zone** toolbar heading with an inline editor for
the active encounter name. Enter or blur commits one validated, history-tracked
rename; Escape cancels. Place an accessible icon-only Save button and save-state
indicator beside it, and map Ctrl/Cmd+S to the same save operation.

## Encounter Library behavior

The Encounters tab is the local encounter-management surface. Its Add menu is:

1. **Create encounter**
2. A visual separator
3. **Create folder**

The tab supports loading, renaming, duplicating, moving, and confirmed deletion
of saved encounters. Loading first flushes the current saved encounter, then
replaces the active encounter and resets session-only state.

After confirmed deletion of the active encounter, show a non-dismissible modal
with this prompt:

> You've just deleted your encounter. What would you like to do?

- **Load encounter** opens an encounter-only Library view. The user may select
  an existing encounter or create one there.
- **Create new encounter** creates and opens a new recovery draft.

## Export and import

Support two JSON envelope kinds, each with a `schemaVersion`:

- A full-workspace export containing every encounter, Library folder, and
  asset required for a lossless restore.
- An encounter-only export containing one complete `EncounterState` and its
  required embedded data.

Workspace import/export is available only in Settings. Encounter import is
available only from **Library → Encounters → Add → Import encounter**. Choosing
a valid envelope of the wrong kind shows a modal directing the user to the
correct import action without changing local data.

Full-workspace import validates the complete input before presenting **Merge**
and **Overwrite**, then requires confirmation of the selected operation.

- Merge retains the currently loaded encounter, assigns new IDs to imported
  workspace-level encounters and Library nodes, rewrites their references,
  and commits the complete merge atomically. Entity IDs inside an encounter
  remain unchanged because they are scoped to that encounter.
- Overwrite first creates a recoverable local pre-import backup, atomically
  replaces the workspace, and loads the imported active encounter.

Encounter-only import validates the file, asks for a destination folder in the
Encounter Library, assigns a collision-safe encounter ID, saves it, and loads
it. Invalid or partially migrated data must never replace existing records.

## Single-editor browser-tab policy

Acquire a workspace-wide Web Lock for the lifetime of the editing tab. A tab
that cannot acquire the lock remains read-only for all EncounterState and
Library mutations; central Redux/repository guards enforce this independently
of disabled UI controls.

Show a persistent toolbar warning with a lock icon and the text
**Read-only—open in another tab**. A read-only tab may navigate, inspect, and
export. When the writer releases the lock, a waiting tab may acquire it, reload
the latest persisted workspace, and become editable.

Use a same-origin channel to announce saves, resets, and lock-state changes to
other tabs. A reset invalidates any state they have already loaded.

## Settings and local-data reset

Add an accessible icon-only Settings button in a persistent footer at the
bottom-left of the page, below the area in which docked panels are allowed. It
remains available when the left panel dock is collapsed. The button opens a
Settings modal that can accommodate future settings.

The Settings modal has a Data section with a visually separated destructive
**Reset local data** action. Reset removes all application-owned local data:

- Saved encounters and the recovery draft.
- Library folders and uploaded assets.
- Import backups and workspace metadata.
- Persistence revisions and pending sync operations.
- Locally stored UI preferences.
- Firebase authentication and local Firebase caches after cloud sync exists.

The reset flow must:

1. Require the active writer-tab lock. A read-only tab cannot initiate reset.
2. Suspend autosave and cloud synchronization.
3. Explain that the local deletion cannot be undone and that remote cloud data,
   if present, will not be deleted.
4. Offer **Export workspace** before deletion.
5. Require the exact phrase `RESET LOCAL DATA` before enabling the destructive
   confirmation button.
6. Record a reset-in-progress marker, clear the application stores and
   namespaced preferences, and recover or retry safely if interrupted.
7. Disconnect or sign out of cloud sync without deleting remote data.
8. Notify other tabs, restore default preferences, and create a clean workspace
   containing a new **Untitled Encounter** recovery draft.

The reset must not clear unrelated browser data belonging to the origin. A
later cloud reconnection must explicitly ask whether to restore the remote
workspace, merge it with the fresh local workspace, or replace the remote data
with the fresh local workspace; destructive replacement requires confirmation.

## Future Firestore synchronization

Cloud sync is an optional post-MVP phase, not an alternate MVP storage mode.

- Firebase Authentication owns user identity.
- Firestore stores versioned workspace and encounter manifests.
- Firebase Cloud Storage stores uploaded maps and tokens because Firestore
  documents have a 1 MiB size limit.
- A sync coordinator mirrors local repository changes to the remote services;
  Redux does not write directly to Firebase.
- Firestore transactions compare expected document revisions. If the same
  encounter changed independently on two devices, preserve the local edit as a
  clearly named conflict-copy encounter rather than silently overwriting data.
- Offline changes remain queued in IndexedDB and retry after reconnection.
- Firebase Security Rules restrict manifests and files to their owning user.

Do not add GraphQL, CRDTs, live multi-user editing, RxDB replication, or a
public bring-your-own-provider contract as part of this work.

## Verification plan

Add Vitest coverage for:

- Lossless encounter and complete-workspace round trips, including every
  entity type and uploaded image data.
- Debounced autosave, immediate explicit save, undo/redo persistence, first
  save destination selection, draft recovery, and refresh restoration.
- Loading an encounter with fresh history and cleared transient state.
- Schema migrations, corrupt data, unsupported versions, quota/write failures,
  and preservation of the last valid data after any failure.
- Import Merge and Overwrite confirmation, backup creation, atomicity, ID
  remapping, and reference integrity.
- Writer-lock enforcement, read-only mutation blocking, lock transfer, and
  cross-tab reset notification.
- Reset phrase validation, export-before-reset, complete local removal,
  interrupted-reset recovery, default preference restoration, clean-workspace
  creation, and preservation of remote data.
- Encounter title rename history and validation behavior.

The future cloud phase must additionally use Firebase Emulator coverage for
authentication and Storage rules, revision conflicts, offline retry, conflict
copies, asset ownership, and local-reset disconnection.

## Implementation verification

- `npm run test:agent` covers persistence envelopes, repository round trips,
  autosave/restore, fresh Redux history on load, read-only mutation guards,
  reset confirmation, and encounter-title history behavior.
- `npm run typecheck` passes.
- `npm run build` passes. Vite reports its existing advisory for the main
  bundle size, but produces the production bundle successfully.
- Roadmap Part 14 and its matching acceptance criteria were completed after
  those checks passed.

Encounter Library folder deletion is currently blocked while the folder or
one of its descendants contains saved encounters, preventing orphaned local
records. A future UX refinement may move those encounters to the root after
the product behavior is confirmed.

## Assumptions

- MVP has one logical workspace containing multiple encounters.
- Encounter names need not be unique; stable IDs are authoritative.
- There is at most one unfiled recovery draft because leaving it requires Save,
  Discard, or Cancel.
- Browser persistence and JSON portability are MVP functionality. Firebase
  backup and multi-device sync remain optional post-MVP functionality.
