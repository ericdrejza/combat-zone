# Independent Zone/Grid Rules and Cell Tracer

## Status and objective

Agreed implementation plan, recorded on 2026-10-10. Implemented and verified on 2026-10-11.

Replace mutually exclusive Zone/Grid/Free movement modes with independent
placement rules. Zone lock controls automatic packing and edge-aware movement;
actor snapping adds grid-anchor constraints. Zone vertex snapping is a separate
rule. Cell Tracer draws polygon boundaries along grid cell edges.

This document records the user's approved changes. Before implementing domain
behavior, update `documentation/DESIGN.md`, particularly §17, and the relevant
parts of `documentation/ARCHITECTURE.md` and `documentation/ACCEPTANCE.md`.
DESIGN remains the product/domain source of truth.

The earlier implementation can be traced through commit
`aaa3e7cff9f6c88762bd6e0cf191e584efed2832` if needed.

## 1. Toolbar and properties

- Restore Zone as a standalone tool and add Grid immediately before it, with a
  vertical separator between Grid and Zone. Remove
  the movement cycling button and Free tool. Keep the Zone shortcut.
- Remove all grid subtools from Background.
- Zone retains its shape controls, uses `VectorPolygon` for Polygon, adds the
  Waypoints **Cell Tracer** as the last shape subtool. A separate Lock/Unlock
  group appears first.
  Locked uses the active appearance; unlocked uses the muted, inactive
  appearance but remains enabled and visibly clickable.
- Grid contains these subtools:
  - Eye, Magnet (**Snap Actors to Grid**), and VectorSquare (**Snap Zone Vertices
    to Grid**) in one group, in that order.
  - Blend, labeled **Overlap**.
  - `LayoutGrid` (**Align grid to background**) immediately before Grid
    Settings, in one group.
  - Scissors, labeled **Trim**, implemented in the final phase.
- Selecting a tool changes the editing context, not the rules. Grid visibility,
  actor snapping, Zone vertex snapping, and Zone lock are independent.
- Enabling Zone lock turns Overlap off and disables that control. Unlocking
  does not automatically restore Overlap.
- Selecting Grid displays `src/ui/panels/GridPropertiesPanel.tsx`. Keep only
  grid type, line color, and line opacity there. Type commits immediately;
  color/opacity preview until focus leaves the control, committing once. Clicking
  Line color again closes its picker. There is no Apply button.
- Retain every current field in
  `src/ui/toolbar/grid/GridSettingsDialog.tsx`, including its form-based draft,
  preview, Apply, and Cancel behavior. Unapplied settings remain transient.
- Preserve compact toolbar portals, responsive layouts, accessible labels and
  pressed states, visible hover/focus feedback, and read-only enforcement.
  Use established Lucide icons and Motion for animations.

## 2. Authoritative state and actor placement

Replace `EncounterState.movementStrategy` with one authoritative
`movementRules` object:

```ts
type MovementRules = {
  zoneLocked: boolean;
  snapToGrid: boolean;
  snapZoneVertices: boolean;
  allowOverlap: boolean;
  trimTokens: boolean;
};
```

Persist these rules once. Keep manual actor coordinates in the existing
`Actor.spatialPosition`; derive automatic placements rather than storing a
second copy of layout results.

### Locked placement

- With actor snapping off, retain existing automatic Zone packing, footprint
  clearance, layout strategies, movement validation, and keyboard behavior.
- With actor snapping on, use grid-aware automatic Zone packing. Preserve
  FLEX, SEQUENTIAL, split sections, layout orientation, engagement layout, and
  the existing permitted Zone auto-resize behavior.
- Each actor's full token footprint must fit inside its Zone and the canvas.
  With snapping enabled, reserve disjoint full anchor-cell sets instead of token-to-token
  footprint clearance; differently anchored large tokens may geometrically
  overlap.
- If a destination is occupied, the automation finds a viable anchor inside
  the destination Zone. Retain auto-resize policies before declaring failure.
  Reject ordinary movement if the Zone still cannot accommodate it.
- Locked arrow movement retains existing Zone-to-Zone destinations and
  edge/validation rules, then packs actors onto valid anchors when required.
- Actors placed outside all Zones go to the Zone list panel.

### Unlocked placement

- Saved actor coordinates are authoritative. Manual movement updates Zone
  membership and ignores edges, even when edges exist.
- Arrows use existing grid stepping with actor snapping on and existing free
  nudging with it off.
- With snapping on and Overlap off, another actor at the same anchor makes that
  anchor occupied. Do not test token footprint intersection for occupancy.
- Search for the nearest fitting open anchor on the canvas; break distance ties
  top-to-bottom, then left-to-right. Resolve multi-actor operations
  deterministically and atomically.
- Log movement adjusted to another anchor. If no fitting open anchor exists,
  reject an ordinary move, preserve prior placement, and log the failure.
- Overlap has no effect on unsnapped movement.
- Actors outside Zones may remain on the canvas. The list holds unplaced actors
  rather than every actor whose Zone assignment is zoneless.

### Rule changes and history

- Attempt to accommodate actors before unplacing them, including nearest-open
  anchors and existing permitted Zone auto-resizing.
- During rule changes, send individual actors that still cannot fit to the Zone
  list. This differs from an ordinary movement failure, which rejects the move.
- Rule changes, adjusted coordinates, Zone assignments, geometry changes, and
  engagement cascades commit together as one history action.
- Enforce full-canvas fit in every validation mode. Preserve existing
  mode-dependent behavior for other validation constraints.

## 3. Zone vertex snapping

- The Grid VectorSquare toggle operates independently of actor snapping and Zone
  lock. It defaults off.
- Enabling it immediately reconciles existing Zones and repacks affected actors
  in one undoable action. Reject the toggle atomically if valid geometry cannot
  be maintained.
- For user-drawn polygons, snap every actual vertex to a grid cell vertex.
- For generated rectangles, circles, and hexagons, snap drawing start/end
  controls and manipulated resize corners, then regenerate the shape normally.
  Do not independently snap every sampled outline point or distort generated
  shapes by doing so.
- Use actual square/hex cell vertices, including rotation and warp, rather than
  actor center anchors. Show snapped geometry during previews.
- Maintain the constraints during Zone movement, grid geometry changes,
  background/map resizing, and automatic Zone enlargement. Reconcile geometry
  and packing in the originating history action; reject changes that cannot
  preserve valid geometry.
- Derive generated control points from existing geometry. Do not persist
  duplicate bounds or drawing state.

## 4. Cell Tracer

### Availability and persisted result

- Cell Tracer is a Zone drawing mode, using Waypoints as its icon.
- Enable it only when **Zone vertex snapping** is on and the grid is unwarped.
  Actor snapping is not required. Standard square, flat-top hex, and pointy-top
  hex grids are supported, including rotation.
- Disable it for warped grids because warped hex edges can be curved while
  Zones currently store straight polygon segments.
- Save completed results as ordinary `shape: "polygon"` Zones. Do not persist
  a tracer marker, control-point history, or edge-following behavior. Later
  edits use normal polygon and Zone vertex-snapping rules.

### Drawing and route selection

- Snap each selected point to a grid cell vertex.
- Between consecutive selected points, trace along actual grid cell edges.
  Choose the route with the fewest edges, then the fewest turns, then stable
  top-to-bottom/left-to-right ordering. Edge count, not geometric path length,
  is the primary criterion.
- Keep selected endpoints and insert intermediate vertices at turns.
- Store selected points and generated segments separately in transient drawing
  state. Right-click removes the last selected point and its entire incoming
  generated path; it must not remove only one generated corner.
- Preview the traced route to the pointer's snapped vertex.
- Use the existing Polygon completion gestures. Trace the closing segment
  along grid edges too and require a valid, nondegenerate polygon.
- Disabling Zone vertex snapping, introducing a warp, or changing drawing mode
  clears the tracer draft and exits Cell Tracer.
- Draft changes and rejected selections create no encounter history entries.

### Invalid-route preference

Add a Canvas preference with these choices:

- **Reject invalid route** (default): keep the current draft and explain why the
  shortest route would produce invalid geometry. Do not silently take a longer
  route.
- **Find shortest valid detour**: search valid routes within canvas bounds,
  avoiding invalid overlap with existing Zones and self-intersection of the
  draft. Use the same edge-count, turn-count, and deterministic tie ordering.

If no valid route exists, reject the selection and retain the draft.
Place grid graph/pathfinding in focused geometry helpers and interaction
orchestration outside `CanvasShell`.

## 5. Membership and Engagement behavior

### Unlocked Zones and Engagements

- Zone, Edge, and Engagement tools, rendering, and editing remain available
  while Zone lock is off.
- Unlocked Zone movement/resizing leaves actor coordinates unchanged and
  reevaluates membership. Zone deletion clears affected membership but retains
  manual canvas placement.
- Unlocked actor movement preserves Engagement membership and manual positions.
  Disable drag-over engagement activation and automatic disengagement;
  engagement/disengagement buttons and hotkeys remain available.
- Allow unlocked participants of one Engagement to occupy different Zones.
  Retain `parentZoneId` as the group's home Zone and relax participant
  co-location requirements while unlocked. Derive tokens/connectors around
  the manual placements without repacking participants.
- Locking attempts to accommodate the participants in their home Zone. If the
  group cannot fit, dissolve the Engagement and resolve each actor individually.
  Do not unplace actors merely because the group cannot fit; apply the normal
  individual locking/fit rules afterward.

### Membership methods

Canvas preferences offer:

- Actor center.
- Anchor-cell centers while snapping, with a separately configurable fallback
  of actor center or geometric token overlap when snapping is off. Initially
  use actor center as the fallback.
- Any geometric token/Zone overlap.

For anchor-cell membership and Trim, share these cell groups:

| Actor size | Cell group |
| --- | --- |
| Small / Medium | Its center anchor cell |
| Large | All cells sharing the snapped intersection or vertex |
| xLarge | Its center cell and all touching neighbors: eight square or six hex |

### Ordered membership deciders

Provide draggable, keyboard-reorderable setting tiles, initially ordered:

1. Most shared cells.
2. Nearest Zone Center.
3. Keep current Zone.
4. Ask Me.

Each automatic decider narrows matching candidates or resolves a single
candidate; ties continue to the next tile. Shared cells counts the actor's
anchor-cell centers inside each Zone and is skipped without actor snapping.
Nearest Zone Center measures distance to the polygon centroid. Keep current
Zone selects it only when it remains a matching candidate.

Ask Me opens a dialog with remaining candidates. Offer fallback to the next
decider if one exists. If the sequence is exhausted without resolution, open
a final choice dialog without fallback, including when Ask Me was previously
encountered and skipped. Cancel cancels the complete pending action.

Resolve choices before committing encounter state, with stale-state checks.
Keep multi-actor decisions and their cascades atomic. Dialogs and pending
decisions are transient, not persisted or executed inside reducers/workers.

## 6. Canvas settings and preferences

- Add a Canvas tab to Settings.
- Under **Defaults**, use one compact row for new-encounter Zone lock, actor
  snapping, Zone vertex snapping, and Overlap preferences. Do not give each
  preference a separate full-width row.
- Initial defaults are locked, both snapping rules off, and Overlap off.
  Default Overlap is unavailable while default lock is enabled. Trim starts off.
- Include membership methods/fallback, ordered decider tiles, and the Cell
  Tracer invalid-route preference in Canvas settings.
- Persist global preferences through the established namespaced
  preference/provider pattern, with cross-tab synchronization and reset support.
- New-encounter defaults do not modify existing encounters. Membership and
  tracer preferences apply to future relevant actions; changing preferences
  does not immediately mutate active encounter membership.
- Reset restores these defaults and uses them for the clean draft.

## 7. Persistence and engineering boundaries

- Introduce a new encounter schema version and update repository, envelope,
  import, and cloud contract validation together.
- Do not add migration of existing movement-mode encounters; the user confirmed
  there is no data requiring that migration. Keep normal schema validation,
  unsupported-version handling, and last-valid-data preservation.
- Replace mode-based tool reconciliation, rendering suspension, and validator
  gating with behavior-specific rule checks. Structural relationship
  validation remains active even with lock off.
- All encounter changes use the existing validated Redux history boundary and
  central persistence writer guard. UI/Redux must not access storage adapters
  directly. Only `encounter.present` is durable.
- Keep layout, grid geometry, occupancy, membership resolution, drawing state,
  and rendering in focused modules. Keep `CanvasShell` a composition component.
- Keep source files under 300 lines where practical, use path aliases across
  module boundaries, and use snake_case for new multi-word directories.

## 8. Final phase: Trim

Implement Trim after the priority features have passed their checks.

- Make the Scissors toggle available only with actor snapping on. Turning actor
  snapping off turns Trim off and disables it.
- Clip Large/xLarge hex token artwork to the union of their anchor cells.
- Skip square grids and Small/Medium tokens; they do not need clipping for
  this feature.
- Clipping is purely visual. Preserve token size, placement, footprint
  validation, and hit testing.

## 9. Implementation sequence and verification

1. Update the domain specification and acceptance criteria with these decisions.
2. Introduce independent rules, schema/contracts, rule-specific validation, and
   shared placement/geometry helpers.
3. Implement automatic grid packing, unlocked membership/Engagement behavior,
   and rule-change reconciliation through validated history.
4. Restore the tools, move grid controls, and split immediate Properties edits
   from the modal settings form.
5. Add Canvas preferences, ordered membership decisions, and choice dialogs.
6. Implement Zone vertex snapping and Cell Tracer with preview/cancellation.
7. Implement Trim, then complete acceptance and regression checks.

Required coverage:

- Every combination of Zone lock and actor snapping, Overlap mutual exclusion,
  independent vertex snapping, nearest-open-anchor adjustments, no-space
  rejection, and deterministic multi-actor operations.
- Square/hex/rotated/warped geometry, full-canvas/Zone containment, existing-Zone
  snapping, drawing/resizing/movement previews, generated-shape preservation,
  grid changes, auto-resize, and invalid-geometry rejection.
- Membership methods and cell groups, reordered deciders, ties, Ask Me fallback,
  cancellation, stale-state protection, and atomic multi-actor decisions.
- Unlocked Zone edits/deletion, manual Engagement preservation, cross-zone
  groups, relocking reconciliation, and dissolution without unnecessary
  unplacement.
- Cell Tracer route ordering, inserted turns, live previews, closure, right-click
  whole-segment removal, both invalid-route policies, unavailable routes,
  disabling/cancellation, and ordinary-polygon persistence.
- Undo/redo for rule toggles and every placement, geometry, and relationship
  cascade. Verify universal fit constraints in every validation mode and STRICT
  blocking versus ADVISORY acceptance for mode-dependent constraints.
- Toolbar availability/grouping, immediate Properties edits, settings
  Apply/Cancel, preference persistence/cross-tab/reset, and Trim geometry without
  styling assertions.
- Repository/envelope round trips, schema rejection, imports, write failures and
  last-valid-data preservation, autosave/explicit save, fresh history on load,
  read-only mutation blocking, reset recovery, and updated cloud contracts.

Run `npm run test:agent`, typechecks, build, and relevant Firebase emulator
coverage. Use `--reporter=agent` for direct Vitest calls. Use real application
testing if an issue persists after repeated fixes. Update ROADMAP checkboxes
only after the feature's acceptance criteria and required checks pass.


## 10. Completion and validation

Implemented separate Zone/Grid tools, independent persisted placement rules,
grid-aware Zone and Engagement packing, unlocked membership workflows, Canvas
preferences, immediate Grid Properties, vertex snapping, Cell Tracer, and hex
artwork Trim. Updated DESIGN, ARCHITECTURE, ACCEPTANCE, and ROADMAP alongside
schema 22 local/cloud contracts.

Validation completed:

- `npm run test:agent -- --maxWorkers=2 --testTimeout=15000`: 278 files and
  1,517 tests passed. Lower concurrency avoids contention in existing UI tests.
- `npm run test:emulator`: 23 tests passed, including historical and schema 22
  Firestore round trips and preservation after invalid writes.
- `npm run typecheck`: application, Firebase API, and Functions passed.
- `npm run build`: passed with the existing Vite chunk-size warning.
- `git diff --check`: passed.

### Toolbar and background follow-up

- Placed Grid before Zone with a separator visible at compact and desktop sizes.
- Added desktop tooltip fallback for toolbar icon subtools, preserving touch-hold
  help, and made icon tooltips an explicit AGENTS.md requirement.
- Separated browser membership preferences from worker-safe validation imports.
  Worker startup/runtime failures now fall back to synchronous validation.
- Reconciled snapped Zone vertices before validating background resize candidates.
- Verified worker isolation/recovery, ADVISORY and STRICT behavior, web-image
  application with snapped Zones, undo/redo, tooltip semantics, and tool order.

Follow-up validation: the full suite passed 1,526 tests with one failure in a
new test's native-image-size expectation. Corrected that assertion to the
existing viewport-fit behavior and reran all affected validation, encounter,
resize, toolbar, and keyboard/engagement tests: 47 files and 263 tests passed.
Application, Firebase API, and Functions typechecks passed; production build
passed with the existing chunk-size warning. `git diff --check` passed.


### Appearance, occupancy, and drawing refinement

Grid Properties now previews color/opacity through dedicated interaction-only
appearance state and commits once on blur. Line color retains the original
native color picker; a repeat click blurs the field and finishes its edit.
Type remains immediate; Grid Settings still requires Apply.

Zone lock is its own first subtool group. Cell Tracer follows Polygon as the
last item in the shape group. Grid alignment uses LayoutGrid and Zone vertex
snapping uses VectorSquare, consistently including Canvas defaults.

Locked grid packing reserves each actor's complete cell set, including Large
and xLarge neighborhoods, with deterministic backtracking and capacity checks.
Cell Tracer previews the valid closing route when hovering its starting vertex.

Zone moves preserve every edge vector through one translation, snapping the
whole translation to the regular square/hex lattice. Warped movement preserves
the shape and rejects moves whose other drawing controls cannot remain snapped,
per the user's explicit decision. Existing polygon coordinates remain the sole
geometry source; no redundant vector/link fields are persisted. A snapped drag
that returns to the original position adds no history.


Zone Properties retains its existing color palette choices in collapsible Fill,
Border, and Engagement color fields. Each field displays its current swatch and
hex value, opens on click, and closes on selection or a repeat click. Selection
uses the existing validated color mutation and restores the opener's focus.
Match border color continues disabling the Engagement field while showing its
inherited color. The Grid Properties color input remains the original native
picker, independently of these Zone palette controls.


Validation for these refinements:

- Full suite after the movement/appearance/tracer changes: 284 files and 1,543
  tests passed (`npm run test:agent -- --maxWorkers=2 --testTimeout=15000`).
- Final native Grid picker and collapsible Zone picker checks, including color
  inheritance, painting, multi-Zone edits, and undo/redo: 6 files and 28 tests
  passed after the latest UI changes.
- Application, Firebase API, and Functions typechecks passed. Final production
  build passed with the existing chunk-size warning; `git diff --check` passed.

Zone drop animation follow-up: release the direct-manipulation transition after
the validated move commits so Zone geometry and drag offset settle together with
the same Motion spring as Actors. Keep direct dragging and reduced-motion
movement immediate. Retain the drop frame while asynchronous validation resolves.
Focused drag, resize, snapping/history, Actor motion, and reduced-motion checks
passed (6 files, 28 tests), as did application/API/Functions typechecks.

Zone drawing/editing follow-up: hide the canvas Zoneless panel during shape,
polygon, and Cell Tracer drafts while retaining mounted panel preferences.
Polygon Zones support double-click vertex insertion/removal through the validated
reshape workflow. The user selected a 12px screen hit range, 24px minimum
insertion spacing, and polygon-only editing. Vertex hits take priority; deletion
retains at least three vertices. Insertions honor grid snapping before checking
spacing. Invalid geometry and validation blocks add no history. Existing
multi-point drawing completion remains available.

Verification: 10 files and 57 tests passed, covering vertex edits, undo/redo,
STRICT/ADVISORY validation, zoom distances, snapping, overlap rejection, panel
restoration, existing drawing/Cell Tracer, selection, resizing, and Zoneless
workflows. Application/API/Functions typechecks and `git diff --check` passed.

Zoneless visibility refinement: Zone drawing, moving (including its settling
animation), and vertex resizing use a 200ms Motion ease-in-out fade. Keep the
panel mounted to preserve expansion and sizing, but make it inert, inaccessible,
and noninteractive immediately while hidden. Reduced-motion preferences make
visibility changes immediate. Focused drawing, editing, resizing, moving, and
Zoneless regressions passed (7 files, 42 tests); application/API/Functions
typechecks and `git diff --check` passed.
