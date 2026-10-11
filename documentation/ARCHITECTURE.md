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
- Optional cloud sync is implemented as a coordinator and focused adapters
  above `WorkspaceRepository`. `CloudSyncCoordinator` drains a coalesced,
  durable IndexedDB outbox, applies validated remote snapshots through
  `LocalSyncRepository`, and owns initial reconciliation and conflict copies.
  `CloudWorkspaceRepository` contains Firestore reads/listeners and callable
  writes; `CloudAssetRepository` contains private Storage uploads/downloads;
  `GoogleDriveAssetRepository` contains incremental Drive authorization and
  selected-file access. Redux and feature UI never write directly to Firebase.
- IndexedDB version 3 adds `sync_state`, `sync_outbox`, and `asset_cache` stores.
  Domain writes and their outbox record share an IndexedDB transaction. Only
  the writer-lock tab runs synchronization. Provider-backed cached blobs are
  derived, evictable data and never become a second domain source of truth.
- IndexedDB version 5 adds the authoritative `assets` store for local upload
  bytes. Domain documents reference these content-addressed blobs with a
  `local_asset` descriptor, so large media is not duplicated through Redux,
  JSON serialization, or every persisted encounter. The store is distinct
  from the derived `asset_cache`: referenced local blobs are durable, while
  cached provider blobs remain evictable. Startup migrates legacy embedded
  data URLs and removes blobs not referenced by the Library, a saved
  encounter, or the recovery draft. Deferring collection until the next
  writer-tab startup keeps session undo/redo references valid and prevents a
  read-only tab from collecting assets used by the active editor.
- A persisted image-compression strategy runs before PNG/JPEG Library uploads
  enter the authoritative asset store. The default stores original bytes;
  opt-in maximum-quality and balanced WebP strategies keep only smaller valid
  results.
  This boundary keeps the local Blob, digest, exported bytes, MIME metadata,
  and eventual Cloud Storage object identical. Codec failures preserve the
  original upload, and animated PNGs bypass the single-frame canvas encoder.
- Image-bearing domain fields use the shared `ImageAssetSource` union:
  embedded bytes, repository-backed local asset ID and byte length, HTTP(S)
  URL, Google Drive file ID, or Cloud Storage asset ID plus generation.
  Encounter schema 6 and export/workspace schema 2 migrate legacy strings
  explicitly. Rendering shares short-lived object URLs between consumers;
  lossless exports replace local and provider references with embedded bytes
  in a cloned envelope so exported files remain portable.
- The Library is the authoritative catalog for application-managed image
  objects. Embedded or provider-backed object-storage assets must be created or
  imported through a Library asset node before an entity can use them; entity
  creation flows select those Library assets instead of creating standalone
  stored objects. Explicit HTTP(S) links remain external references and are not
  application-owned object storage.
- Firestore stores binary-free, independently revisioned workspace metadata,
  encounter aggregates, Library state, and recovery draft below the Firebase
  UID. Callable Functions own validated writes, idempotency, revision checks,
  tombstones, and atomic asset-reference counts. Uploaded objects use immutable
  digest paths in private Cloud Storage with reservations and delayed deletion.

## PROCESS RULES (from original constraints — retained, not duplicated from documentation/DESIGN.md)

- **No simulation logic.** Represent state and relationships only. Do not
  implement RPG rules engines, dice systems, or narrative generation.
- **GM authority is absolute outside Strict mode except geometric fit.**
  Validation is advisory unless Strict mode is explicitly enabled (see
  `documentation/DESIGN.md` §5.5 for the four validation levels). The
  Zone no-overlap/in-zone fit and spatial canvas-fit/snapping invariants are
  explicit exceptions and block invalid geometry in every validation mode.
  Actor overlap is allowed in Grid and Free (§17).
- **Every committed mutation goes through Redux history.** No direct
  EncounterState writes may bypass the history reducer, including "internal"
  or "derived" updates like layout recalculation after a move. See
  `documentation/ARCHITECTURE.md` if more architecture information is needed.
- **Tool-driven UI, no global mode system.** Each tool in `interaction/tools/`
  owns its own selection rules, drag behavior, click behavior, and keyboard
  shortcuts. Encounter movement rules (DESIGN §17) are durable domain
  constraints independent of editing tool. Shared movement helpers enforce them;
  do not scatter policy throughout tool implementations.
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

## Movement rule persistence

Encounter schema 22 persists independent movementRules and grid configuration.
Actor spatialPosition is authoritative while Zone lock is off; locked positions
remain derived. Configuration and drawing drafts stay in interaction state.
Geometry, membership, occupancy, and spatial mutations live in core/movement;
shared grid controls live in ui/toolbar/grid and rendering in ui/canvas/grid.
The movement rules middleware cancels ineligible Cell Tracer drafts and blocks
invalid spatial commits behind the persistence writer guard. Historical schema
migrations retain their existing conversion steps; there is no old-mode-to-rule
migration requirement for this feature. Cloud contracts accept schema 22 while
retaining historical wire validation.

Encounter schema 18 adds an optional bilinear grid warp. Schema 17 migrations
preserve regular-grid configuration and spatial coordinates. Warp coefficients
map cell-normalized local lattice coordinates before the existing origin/rotation
transform; manual transforms remain consistent while background resizing leaves
grid geometry fixed. The grid
geometry engine owns forward/inverse mapping, local token scale, and lattice
neighborhoods. Rendering uses exact quadratic SVG edge paths for warped cells.
Spatial validation rejects non-invertible/folded geometry in every validation
mode, including imports. Calibration mode, click samples, and detection results
remain interaction drafts; only an applied grid enters history and persistence.

Grid image detection uses a dedicated transient worker and transfers analysis
pixel buffers. Resolution passes are capped at 384 and 1,152 pixels, retain
native aspect ratio, and never enlarge original images. Worker cancellation
terminates analysis immediately; previews remain interaction-only and require
the existing writer/validated-history boundary on Apply.

Encounter schema 19 adds optional `backgroundImage.frame` for edge-completion
margins. Schema 18 migrates without changing full-canvas background rendering.
Intrinsic media dimensions remain asset metadata; frame is the sole authority
for explicit logical placement. Rendering, luminance sampling, detection, and
subsequent background sizing use that frame. Edge completion measures original
cell coverage, translates geometry together, and commits through existing
validation/history/repository boundaries. Cloud contracts accept schemas 17–19.

Encounter schema 20 adds optional `gridCoverage` only for image-less encounters.
With a background, coverage derives from its frame. Completion is automatic in
grid settings/calibration, enabling actor snapping, and canvas sizing. Schema 19 active
grids migrate to whole-cell bounds without mutating the source record. A union
of coverage and perimeter cells clips rendered grid fragments without storing
derived polygons. Cloud contracts accept spatial schemas 17–20.

Background sizing changes coverage dimensions independently of grid geometry and
saved spatial coordinates. The pure resize helper completes cells before applying
the explicit overflow policy; the shared Background commit path reads that policy
from Interface preferences and commits resizing/unplacements in one history entry.
Zone polygons retain uniform scaling and existing layout clamps. This adds only a
local Interface preference, without changing the encounter schema or migrations.

Encounter schema 21 reinterprets `grid.cellSize` as the authoritative user-facing
map-scale value. Runtime grid geometry resolves physical spacing to 64 units;
calibration/detection retain measured spacing only in transient geometry drafts.
Actor footprints share the Zone size function in every mode, independent of warp.
The shared core resize candidate/clamp helper serves Background and Grid controls,
updates map scale inversely, completes edges, and applies the overflow preference
inside one validated history operation. Alignment uses an exact resize candidate
and rejects invalid fit instead of clamping into approximate alignment. Viewport zoom remains session-only.
Schemas 17–20 validate with their legacy physical grid/footprint semantics before
schema-21 conversion scales canvas, coverage, Zones, grid origin, and saved actor
coordinates by 64/old-cell-size. Normalized warp coefficients and the old scale
value remain unchanged. Completion recalculates after conversion; source records
are never mutated. Current schema snapshots remain lossless. Cloud contracts
accept schema 21 while retaining supported legacy versions.

## Independent canvas rules (schema 22)

Schema 22 replaces movementStrategy with movementRules (zoneLocked, snapToGrid,
snapZoneVertices, allowOverlap, trimTokens). Zone and Grid are separate editing
tools. Locked placements remain derived; unlocked placements use Actor
spatialPosition. Grid topology, occupancy, membership deciders, grid-aware Zone
packing, vertex snapping, and Cell Tracer edge routing share core/movement
geometry. Membership choice dialogs resolve on the main thread before validated
history commits; workers never perform UI decisions. Cell Tracer checkpoints and
paths are transient, and completed Zones persist as ordinary polygons.

Canvas defaults and membership/tracer policies are namespaced global preferences
with cross-tab/reset support. Grid Properties commits type immediately and
color/opacity once on blur. A separate gridAppearancePreview updates only the
SVG Grid Layer, avoiding history and map/layout previews while dragging. The
full settings dialog retains transient Apply/Cancel previews.
All changes use validated history and the central writer boundary. No movement
mode migration is added for schema 22; repository, envelopes, and cloud contracts
validate the new shape. Trim clips artwork only and never changes actor fit or
hit testing.

## Isometric grids (schema 23)

Schema 23 adds `isometric` to GridType. Schema 22 migrates without geometry
changes; earlier migrations retain their placement-rule conversions. Local
envelope validation and Firebase contracts reject isometric grids in older
schemas and reject unsupported newer versions before mutation.

The shared grid projection maps square lattice coordinates to 2:1 diamonds
after logical warp and before origin/rotation, with an exact inverse. Square
topology serves reservations, Zone snapping, tracer paths, and boundary cells.
Calibration and image detection use the existing worker and preview boundaries.
Canvas token projection uses nested Motion transforms, separate from logical
hit areas and upright labels. Its Canvas preference is browser-local, defaults
off, and uses established reset and cross-tab synchronization.

Schema 24 adds optional grid.isometricAngle in [1,45] degrees. Absence preserves
the exact prior 2:1 projection; schema 23 migrates without geometry changes.
Local/Firebase validators reject explicit angles in older schemas. The shared
projection and its inverse, SVG pattern, warp checks, calibration, and token
presentation all derive from this single field. Detection fits two line-family
orientations to estimate projection angle separately from grid rotation.
