## REDUX HISTORY SCHEMA (locked)

Every committed EncounterState mutation must flow through Redux history using
the serializable types in `../src/core/history/types.ts`.

Rules:

- History stores `past`, `present`, and `future` EncounterState snapshots.
  Undo restores the previous snapshot exactly; redo restores the next snapshot
  exactly.
- Each committed mutation includes a serializable action record containing
  `id`, `type`, `timestamp`, `payload`, and optional `validationResult`.
- Action records are metadata, not executable command objects. Do not store
  functions in Redux state.
- Destructive and cascading operations rely on snapshot history for exact
  undo/redo restoration. Feature-specific reducers may still prepare useful
  action payloads, but the historical truth is the stored EncounterState
  snapshot.
- Every committed mutation flows through: **Tool Handler → Interaction Engine
  → Validation Pipeline → Action Record Creation → Redux History Commit →
  Layout Recalculation → Render** (per `DESIGN.md` §5, `AGENT.md` process
  rules below). No shortcuts that bypass Redux history, even for
  "trivial" mutations — this is what makes undo/redo reliable under rapid
  interaction, per the design doc's success criteria.
- Executing a new committed action after undo truncates the redo branch
  (standard linear undo/redo, no branching history in MVP).

If you need history behavior that doesn't cleanly fit this shape, ask before
inventing a variant schema.

## LOCAL PERSISTENCE TOPOLOGY (locked)

The persistence decision record is `documentation/plans/persistence.md`.
This section defines module boundaries and data flow. Product behavior remains
in `documentation/DESIGN.md` §11, while detailed persistence workflows and
entry-point rules remain in the persistence decision record.

- `src/core/persistence/types.ts` owns the `WorkspaceRepository` contract,
  persisted record types, schema versions, and revision errors. Envelope
  validation and migrations live in `envelope.ts`; storage adapters live
  behind that contract in `indexedDbRepository.ts` and the in-memory test
  repository. `localDataReset.ts` is the boundary for application-owned reset.
- `src/ui/persistence/PersistenceProvider.tsx` owns hydration, the serialized
  write queue, trailing autosave, explicit-save/visibility flushes, repository
  load/import/reset orchestration, and installation of loaded state. UI code
  consumes `PersistenceContext`; it must not access IndexedDB directly.
- IndexedDB stores the workspace manifest, one record per saved encounter, at
  most one recovery draft, the Library record, and recoverable import backups.
  Only the current `EncounterState` is persisted for an encounter; Redux
  history, interaction state, viewport state, layout caches, and render data
  remain in memory. Namespaced UI preferences are separate and application-owned.
- Startup and cross-tab reload flow from repository reads through validation /
  migration, then dispatch `loadEncounterState` and `loadLibraryState`; loaded
  encounters must begin with fresh history and cleared transient state. Writes
  flow from Redux `present` or Library state through the provider queue to a
  repository revisioned operation. Multi-record imports use one atomic
  repository operation, with overwrite backup created first. Reset uses its
  in-progress marker and recoverable clear/reinitialize sequence.
- `useWorkspaceWriterLock` and
  `src/store/persistenceWriteGuardMiddleware.ts` enforce the single-editor
  policy independently of UI affordances. Read-only tabs may read and export;
  they must not commit EncounterState, Library, import, or reset mutations.
  BroadcastChannel notifications cause other tabs to reload saved/reset data.
- Any future cloud sync belongs in a coordinator/adapter above the repository.
  Redux and UI modules must never write directly to Firebase or another remote
  service; IndexedDB remains the local source of truth, with repository
  revisions used for remote conflict detection and explicit conflict copies.

## PROCESS RULES (from original constraints — retained, not duplicated from documentation/DESIGN.md)

- **No simulation logic.** Represent state and relationships only. Do not
  implement RPG rules engines, dice systems, or narrative generation.
- **GM authority is absolute outside Strict mode except geometric fit.**
  Validation is advisory unless Strict mode is explicitly enabled (see
  `documentation/DESIGN.md` §5.5 for the four validation levels). The
  universal no-overlap and in-zone footprint invariant is the explicit
  exception and blocks invalid actor movement/creation in every mode.
- **Every committed mutation goes through Redux history.** No direct
  EncounterState writes may bypass the history reducer, including "internal"
  or "derived" updates like layout recalculation after a move. See
  `documentation/ARCHITECTURE.md` if more architecture information is needed.
- **Tool-driven UI, no global mode system.** Each tool in `interaction/tools/`
  owns its own selection rules, drag behavior, click behavior, and keyboard
  shortcuts. Do not introduce a global "mode" enum that tools all branch on.
- **Layout strategies are pluggable, not hardcoded.** FLEX / SEQUENTIAL /
  SPLIT_FLEX / SPLIT_SEQUENTIAL live behind a shared strategy interface in
  `core/layout/`, used by both Zones and Engagements. Adding a new strategy
  should not require touching Zone or Engagement code.
- **Engagements are groups, never pairwise.** No participant should ever be
  linked only to one other participant — membership is transitive within
  the group.
- **Edges are graph objects, not geometry.** Do not derive edge validity or
  behavior from canvas coordinates or polygon adjacency — edges are
  explicit directional relationships with their own rules
  (`documentation/DESIGN.md` §4.5). Edge paths, boundary anchors, lane offsets,
  and routing failures are derived render state. A non-persisted route cache
  may reuse a working path across replacement, undo, and Zone movement, but it
  must never become an authoritative EncounterState fact.
