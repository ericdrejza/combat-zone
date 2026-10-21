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
- **Zone gesture rendering is local.** Memoized Zone visuals receive per-Zone
  presentation values and stable callbacks to the latest interaction handlers;
  moving or resizing one Zone must not rerender every Zone's Motion tree.
  The canvas Motion configuration keeps its coordinate-transform callback stable.
  Validation-worker replies restore structural sharing with the submitted snapshot
  so unchanged entities and grid geometry retain their cached identities.
  Immutable polygon pairs reuse overlap results. A resize contained by a convex
  original can reuse that original's clearance against each unchanged obstacle;
  preexisting overlaps and concave outlines retain ordinary collision checks.
  Containment never bypasses shape validity, canvas bounds, or Actor fit rules.
  Locked Actor resize previews apply a bounds-based affine transform to existing
  placement centers, shared with Engagement presentation. Preview transforms do
  not request packing or mutate the committed encounter; token sizes stay fixed.
  Selected resize handles form a separate overlay after all Zone bodies. Polygon
  simplicity checks cache exact coordinate results, so worker cloning does not
  force unchanged sampled outlines through the quadratic segment-intersection
  check again. The coordinate cache is bounded
  and retains invalid results too; changed geometry is checked normally.
  Zone drops expose their requested snapped polygon as transient presentation
  while validation runs. Only an accepted result commits history; rejection
  restores the original target. Edge rendering updates routes against transient
  geometry in the worker, keeping temporary connectors between results.
  Locked rigid moves without Actor snapping perform acceptance validation
  synchronously, excluding non-blocking Edge route searches already owned by
  the route worker. This preserves a committed baseline before the next drag.
  Gesture revisions reject stale presentation/cancellation callbacks. Released
  resizes retain a separate encounter-scoped completion chain: later gestures use
  their requested snapped geometry and clear the old vertex draft, while resize
  acceptance/history commits remain ordered. A subsequent move validates against
  the accepted resize snapshot (or the unchanged snapshot after rejection), not
  its pre-resize render closure. Completion may update a live gesture's baseline
  but only its owner can clear that gesture or restore selection. Actor previews
  compose the pending resize transform with the new drag vector; move-cache
  seeding requires matching, completed source placement geometry. Released resizes
  resolve their exact source Actor layout before deriving the next preview;
  move acceptance awaits that layout asynchronously and translates its geometry
  and retained preview together. Older worker results may satisfy exact-key
  dependencies without replacing the latest fallback geometry. Animation cleanup
  consumes only the retained preview it actually completed. Resize callbacks
  carry gesture revisions and event timestamps to reject queued older input. Pointer
  samples that produce unchanged resize geometry retain the existing draft.
  Resize hit areas keep fixed SVG origins during Motion dragging; only their
  markers follow the resized polygon, preventing drag/layout feedback loops. Pointer
  tracking starts from displayed SVG geometry; Motion values stop old settling
  tracks so they cannot retake control of a newer gesture.
  Zone bodies settle using one absolute polygon track, avoiding overlapping
  polygon and group-offset animations. Each active Zone gesture freezes its Actor
  placement origins; accepted resize geometry rebases those origins without
  adopting packing updates mid-gesture. Move finalization also rebases placements
  when Redux has advanced ahead of React's last render. Packing targets resume
  after the gesture, animating from the retained visible preview.
- **Color sampling is transient UI state.** A shared context connects Properties
  pipettes to canvas capture handlers without persisting callbacks or sampling
  state. Background sampling reads one mapped source pixel over the themed
  background fill. Zone sampling reuses the paintable appearance contract.
  Existing property commands and validated batch updates own history and writer
  guards. Scope changes invalidate pending samples; failures never alter colors.
- **Edges are graph objects, not geometry.** Do not derive edge validity or
  behavior from canvas coordinates or polygon adjacency — edges are
  explicit directional relationships with their own rules
  (`documentation/DESIGN.md` §4.5). Edge paths, boundary anchors, lane offsets,
  and routing failures are derived render state. A non-persisted route cache
  may reuse a working path across replacement, undo, and Zone movement, but it
  must never become an authoritative EncounterState fact.
  Schema 26 adds optional Edge route preferences (orientation and curvature)
  and an optional color override. Schema 25 migrates without changing geometry;
  missing preferences preserve automatic routing and luminance coloring.
  Absolute paths, anchors, and control points remain derived. Pointer editing
  previews are session-only; release commits preferences through validated history.
  A dedicated route worker calculates committed geometry and creation previews.
  Canvas preferences select Route estimates (default: local deformation and exact
  collision validation, with connector fallback) or Live optimization during Zone
  gestures. Estimates never initiate a full route search during the gesture.
  Published connector previews carry the endpoint polygons matching their moved
  anchors, so UI corrections apply only movement since that worker snapshot.
  Failed repairs leave the worker's original cached route baseline intact.
  Forward endpoint movement shortens the outgoing preview span and drops consumed
  leading spans; backward/perpendicular movement retains connector extensions.
  Reversing numeric segments applies the same rule at the target endpoint.
  Worker messages send changed polygons and removed IDs; worker-local sessions
  retain immutable geometry identities, bounded route caches, and stable grid
  graph keys across structured clones. A replacement worker always receives a
  full geometry snapshot; delta bases and result revisions are worker-scoped. A moved Zone invalidates connected pairs
  and routes whose control-hull/endpoint bounds overlap its old or new bounds.
  Sibling pairs reroute together to preserve grid lane reservations. Live-derived
  results are optimized after release. Unaffected geometry is reused.
  Results stream per Edge, prioritizing connected pairs. The worker yields between
  Edges so the latest queued snapshot can supersede the unfinished batch. Messages
  are encounter/revision scoped. Per-Edge timings and reuse/repair flags are exposed
  through the transient combat-zone:edge-route-metrics browser event. Timings are
  inclusive by phase, not additive. Stable per-route revisions avoid rerendering
  unchanged streamed results. No routing diagnostics enter persistence.
  Collision segments use a conservative spatial bucket index before exact polygon
  checks. Curve separating axes/projections are cached by immutable polygon identity.
  Arc-length scoring uses flatness-based subdivision independently of collision
  sampling. Collision validation certifies clear subcurves by their control hulls
  and recursively subdivides unresolved spans, retaining detailed checks at the
  original two-unit/depth thresholds. Curvature-bound probes operate directly on
  numeric segments instead of repeatedly serializing and parsing SVG data. Grid
  routing tries a bounded endpoint region first, accepting only straight/single-elbow
  paths at preferred clearance with sibling separation; harder detours fall back to the full graph
  to preserve turn/distance ordering. All derived caches remain session-only.
  A MotionValue owns the displayed path and retargets from its current geometry
  on each route or endpoint update. Exact cubic conversion and subdivision give
  source and target matching SVG commands even when route topology changes.
  Both the visible path and hit area share that value; badges measure its updates.
  No outgoing path or opacity transition is retained. Direct curvature edits and
  disabled animations jump immediately. Interior side anchors remain stationary
  when a resize leaves their existing point on the same border side.
  Free-pointer Edge creation previews use a dedicated worker. The UI coalesces
  requests to the latest pointer snapshot, ignores stale geometry, and terminates
  pending work when the drag snaps to a Zone, ends, or unmounts. Preview searches
  never mutate encounter state; environments without Worker use the pure calculator.

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

Actor shape schema 25 adds `transparent`. Domain shape remains authoritative;
`actorFootprintShape` derives its rectangular placement geometry without storing
a duplicate field. Migrations preserve schema 24 actor and grid geometry, and
both local and Firebase boundaries reject this shape in older schema claims.
Projected label offsets are derived from presentation transforms only.

Optional Actor `imageFlippedHorizontal` is a compatible schema 25 field, with
absence resolving to false. Local and Firebase boundaries require a boolean
when present. Header and body use one Actor Properties mutation hook; rendering
reflects the image inside the token projection without changing layout facts.

## Zone rotation

Encounter schema 27 adds signed clockwise Zone `rotation`; schema 26 and earlier
migrate to zero without changing polygon coordinates. Local and cloud boundaries
validate finite normalized angles. World `polygon` remains authoritative for
collision, routing, and hit testing. Local bounds are derived by inverse rotation;
no duplicated geometry or persistent Actor placement cache is introduced.

Rotation is a Zone reshape gesture with a frozen source polygon, angle, and pivot.
Its transient polygon feeds Zone visuals and Edge routing. Existing pending reshape
ordering commits polygon and angle together and protects newer gesture ownership.
Actor previews rotate centers through the shared placement transform while artwork
stays upright. Unsnapped derived layouts compute in the local orientation and
transform results to world coordinates; invalid upright footprints fall back to
world packing. Layout cache keys include orientation. Generated-shape resize,
conversion, and snapped controls use the same local frame. Every generated shape,
including rectangles, jointly solves all four bounds-control corners on grid
vertices while preserving its generated outline. Rotation release searches nearby
grid rectangles by control displacement, allowing independent width/height changes
and a nearby valid angle; the accepted polygon and angle propagate together through
validation previews, pending gestures, Actor transforms, and history. Actual grid
coordinates avoid floating-point boundary rejection. Resizing retains orientation
and keeps the opposite control fixed; unsupported fits are rejected centrally.
Custom Polygons snap every stored vertex independently, merging consecutive
coincident results. Zone bodies, resize controls,
and rotation controls share one continuous drag-polygon transform and settling
transition, including reduced-motion behavior.

## Measurement and grid appearance (schemas 28–29)

`core/measurement` owns unprojected distance, topology routes, AoE geometry,
configurable cell inclusion, and pure movement accounting. Rendering samples those
map-space shapes through existing grid transforms. Crosshair edges retain the
first and last quarter of each logical edge, including under warping.

Grid appearance and measurement scale live only in `EncounterState.grid`. Actor
limits live on Actors. Optional `initiativeTracker.movement` stores accepted
distance and diagonal counts keyed by Actor ID; absence means empty accounting.
Actor movement paths and highlighted cells are transient or derived; locked ruler shapes are durable. Runtime
validation composes movement accounting into the same candidate as its move.
Initiative changes retain totals until the configured turn/round reset applies.

Combat movement preferences use the application-owned
`combat-zone.movement-preferences` key with cross-tab notification and local reset
cleanup. Editing accounting settings clears totals through validated history
before updating preferences. Repository and Firebase contracts validate schema
28 together; old schemas migrate without inventing movement totals.

Schema 29 adds normalized `EncounterState.rulers` (points, options, name, color/opacity override). Schema 28 migrates to an empty collection; local envelopes and Firebase validate the same artifact contract. Standard encounter commits handle locks, deletions and metadata changes, so autosave, recovery, export/import and undo/redo retain saved artifacts. Initial drafts and pending edit candidates live only in interaction state. Space commits an edited candidate as one history step; Escape discards it. Dedicated hooks own click/point editing, endpoint pickup and Shift/Space movement pivots. Canvas preferences own shared ruler color/opacity and movement-caption visibility outside encounter history. Reachable-area outlines are derived once per drag origin/budget and follow movement distance rules.

Outside the Ruler tool, saved-artifact hit targets portal into a dedicated SVG
group immediately before ActorLayer. RulerGraphic and RulerLabel keep their visual
geometry in the overlay while React portal bubbling retains the existing context
and touch handlers. Actors therefore receive pointer input over saved AoEs. The
active Ruler tool retains its drawing surface and editable points above Actors.

Snapped cones store their source cell center as the first interaction point; their outward side/corner origins are derived from the target trajectory. Calculated area is optional and controlled by a Canvas preference, while shape labels are measured and constrained to map bounds. Spatial actor drops enter a validating interaction phase before publishing an accepted position, preventing movement ranges from rerendering at the destination.

Ruler feel is a local Canvas preference. Motion springs animate draft outlines and the white live cursor marker only; saved artifact geometry, measurements, and hit targets remain exact. Reduced-motion preferences disable the spring effects. Path is the initial subtool and lock commands use only placed control points, excluding hover preview points.

Canvas preferences select the ruler cell-coverage rule: corners-or-center, center, majority, corners plus one forward cone-origin neighbor, or corners plus all forward origin neighbors. `cellCoverage` counts three true square/isometric vertices or four true hex vertices. `coverageGeometry` clips convex cells against linear boundaries and computes circular intersections from triangles and circular sectors, making the strictly-greater-than-half test independent of render tessellation. Tests cover boundary equality, circle tangencies, cone clipping and hex origin neighbors. Grid projections/warps are inverted before measuring coverage. These are display preferences: saved artifact geometry and encounter history remain unchanged.

Artifact color dialogs keep color/opacity candidates local until Save dispatches one appearance mutation. Cancel/Escape discard the candidate; unchanged Save preserves inherited overrides. A controlled collapsible palette with custom RGB sliders avoids browser-native popup lifetime issues. Hex-alpha validation permits opacity values between slider steps.

Actor drop handoff retains the lead token’s actual pointer endpoint in `ActorMotionTrack` while Motion owns its live transform. Leaving direct manipulation resets the track target without inventing a replay from the old packed position; subsequent accepted snapping starts at the retained endpoint. Movement overlays still end before validation publishes the accepted position.

ActorOverlayLayers supplies SVG hosts below and above Actor tokens. ActorVisual
portals names, resource bars, and conditions to the host selected by selection
state. ActorMotionGroup shares its live Motion x/y values with the portaled
overlays so dragging and placement animations stay synchronized; React portal
bubbling preserves Actor interaction handlers. Standalone previews retain local
overlays when no layer hosts are present.
