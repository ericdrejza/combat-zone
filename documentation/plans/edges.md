# Edges — Basic Zone Graph Implementation Plan

## Purpose and status

Part 11 of `documentation/ROADMAP.md` implements graph-first Edges between
Zones. This document is the implementation handoff and decision record. The
product/domain source of truth remains `documentation/DESIGN.md`; this plan
must be updated if an approved Edge behavior changes.

## Domain contract

- An Edge stores `fromZoneId`, `toZoneId`, `directionality`,
  `movementRules[]`, `visibilityRule`, `shape`, `interactionTags[]`, and
  `notes`. It stores no route, vertex, lane, or other geometry.
- `directionality` is `bilateral` or `unilateral`. Endpoints and
  directionality are immutable after creation.
- `movementRules` is a multiselect of `blocked`, `skillCheck`, and `difficult`;
  an empty array means unrestricted movement.
- `visibilityRule` is `visible`, `obscured`, or `hidden` (`hidden` blocks
  visibility completely). `shape` is `straight`, `rightAngled`, `curved`, or
  `sigmoid`.
- A canonical Zone pair has at most three slots: one bilateral Edge, one
  unilateral Edge from A to B, and one unilateral Edge from B to A. When all
  three exist, the bilateral route is centered between the two unilateral
  routes.

## Interaction and UI

- The Edge Tool starts creation by dragging from a source Zone to a target
  Zone. Escape, pointer cancellation, or an invalid drop cancels without a
  history entry.
- The toolbar exposes a sticky preset with accessible button groups:
  directionality radio (`bilateral` default / `unilateral`), movement-rule
  multiselect, visibility (`visible` default / `obscured` / `hidden`), and
  shape (`straight` default / `rightAngled` / `curved` / `sigmoid`). Include a
  reset-to-defaults action.
- Dropping into an occupied slot replaces that Edge in one history action. An
  identical preset selects the existing Edge and creates no history entry.
  Replacement preserves no stale tags/notes and receives a new entity ID;
  the derived route cache may reuse the prior working route.
- Edge rendering uses target arrowheads for unilateral Edges and arrowheads at
  both ends for bilateral Edges. Visibility is visually distinct (solid,
  dashed, and dotted treatments); visible has no redundant path icon,
  obscured uses dashed-eye, hidden uses eye-off, and difficult uses
  chevrons-down. Valid paths, arrowheads, and transient creation previews use
  readable contrast selected from the sampled canvas background luminance;
  red unroutable diagnostics remain red. Rule badges are placed by
  traveled-path distance away from Zone boundaries. Use a wide transparent hit
  path for reliable selection.
- Edge Properties show endpoints and directionality read-only. They batch-edit
  movement rules, visibility, and shape; shape is an icon radio group using
  MoveRight, CornerDownRight, Spline, and Activity. Tags and notes are editable
  for a single selected Edge. Select-tool modifiers, Delete, and selected-edge
  deletion are supported. Clear All Edges requires an accessible confirmation
  and commits one undoable action.

## Routing and rendering

- Routing is derived from current Zone polygons and recomputed as Zones move;
  it is never persisted in `EncounterState`.
- Select the closest available boundary vertex/anchor along the path from the
  source. If obstacle navigation reaches the opposite side of the target,
  connect to the vertex on that side rather than forcing the source-facing
  side.
- Prefer the shortest direct collision-free route. Routes must not overlap
  Zones; navigate around intervening Zones when required. Use 12px preferred
  obstacle clearance and 12px same-pair lane separation, with deterministic
  fallback behavior in tight passages. Unrelated Edges may cross; discourage
  coincident segments.
- `straight` uses the direct routed path, `rightAngled` uses orthogonal 90°
  turns, and `curved`/`sigmoid` smooth the routed path while preserving Zone
  collision checks. When facing Zone sides overlap horizontally or vertically,
  use that shortest orthogonal span; a right-angled Edge stays straight on that
  span unless an obstacle requires 90-degree turns. Right-angled endpoint
  arrows follow the dominant cardinal direction of their local path segment.
  Minimize right-angle turns before route length; an unobstructed route has no
  more than one turn. Scale direct curve bends with distance and select their
  concavity from the target's relative position so they start toward the
  target, while obstacle waypoints guide obstructed curves. Lane ordering is
  deterministic and keeps the bilateral lane between unilateral lanes.
- Include target-snapped creation previews in temporary pair-lane layout so
  both preview and established Edges remain distinct. A preview replacing an
  occupied slot uses that existing slot's lane.
- Give every rendered movement/visibility icon a tooltip of at most two words.
  When selected, summarize the Edge's source, target, movement, visibility,
  tags, and notes in the canvas status badge; omit shape.
- Keep a non-persisted route cache keyed by pair slot and Zone geometry
  signature. Existing Edges that become unroutable retain their last valid
  path with a warning; a new unroutable Edge shows endpoint warning markers
  and no path. Routing diagnostics are non-blocking and never delete or alter
  the graph relationship.
- Compose the Edge SVG layer between Zones and Engagements. Move/animation
  transitions use Motion, while transient drag previews remain local and do
  not commit state.

## State, validation, and history

- Add focused Edge mutators for create/replace, property updates, batch
  updates, selected deletion, and clear-all. Enforce canonical pair slots and
  reject self-references or missing endpoints through the shared validation
  pipeline.
- Every committed Edge mutation goes through Redux encounter history. Undo and
  redo must restore exact Edge data and IDs, including occupied-slot
  replacement, batch updates, clear-all, and cascading Zone deletion.
- Deleting a Zone auto-deletes all connected Edges in the same reversible
  history entry; one undo restores the Zone, its actors' prior assignments,
  and those Edges.
- STRICT mode blocks invalid graph mutations; ADVISORY records the validation
  result but permits the mutation according to the existing validation
  contract. Routing warnings remain non-blocking in all modes.
- Record meaningful create, replace, update, delete, clear-all, cascade, and
  blocked/warning outcomes in the encounter log.

## Verification and completion

- Unit-test slot canonicalization, defaults, create/replace/no-op behavior,
  immutable endpoints/directionality, property and batch updates, deletion,
  Zone cascades, validation modes, and exact undo/redo snapshots.
- Test routing with direct paths, closest anchors, opposite-side targets,
  Zone obstacles, all four shapes, lane ordering/separation, live Zone moves,
  cache reuse, and unroutable diagnostics.
- Test toolbar accessibility/defaults/reset, sticky presets, drag preview and
  cancellation, occupied-slot replacement, Properties Panel batch editing,
  selection/Delete, and clear-all confirmation.
- Run `npm run test:agent` (with the agent reporter), type checking, and the
  production build. Check all Part 11 boxes only after the acceptance criteria
  and undo/redo coverage pass; then move the completed roadmap section to
  `documentation/ROADMAP_COMPLETE.md`.

## Decision log — questions and answers

The planning exchange explicitly resolved the questions below. They are
recorded so later implementation work does not silently reinterpret them.

| Question | Answer / settled decision |
| --- | --- |
| Which directionality controls belong in the Edge toolbar? | A radio group with `Bilateral` (default) and `Unilateral`. |
| What is the rule model for directionality and movement? | A bilateral Edge's tags/rules apply in both directions; a unilateral Edge's tags/rules apply only from `fromZoneId` to `toZoneId`. Movement rules are independently combinable, and an empty multiselect is unrestricted. |
| Which movement rules can an Edge carry? | A multiselect of `blocked`, `skill check` (`skillCheck`), and `difficult`; selecting none means unrestricted. |
| Which visibility rules are supported? | `visible`, `obscured`, and `hidden`; hidden blocks visibility completely. |
| Which route shapes are supported? | `straight`, `right angled` (90-degree turns), `curved`, and `sigmoid`. |
| How many Edges may connect one Zone pair? | Up to one bilateral Edge and two unilateral Edges, one in each direction. |
| What does bilateral mean? | Its tags/rules apply in both directions. |
| What does unilateral mean? | Its tags/rules apply only from its source Zone to its target Zone. |
| Where does the bilateral route render when all three slots are present? | Between the two unilateral routes. |
| How should Edges avoid Zones? | They must not overlap Zones; they navigate around intervening Zones and otherwise use the most direct route. |
| Which target vertex should a route use? | The closest available vertex along the route from the source Zone. |
| What if obstacle navigation reaches the target's opposite side? | Connect to a vertex on that opposite side because the route led there. |
| What happens when Zones move? | Existing Edge routes update from the new Zone geometry. |
| What gesture creates an Edge? | Drag from the source Zone to the target Zone with the Edge Tool; cancellation or an invalid drop does not commit history. |
| What happens when the destination pair slot is already occupied? | The occupied slot is replaced as one full replacement mutation/history entry. The old Edge's endpoints and directionality are not retained as editable data; tags/notes are not copied into the replacement. A non-persisted route cache may reuse the old slot's last valid route as a starting candidate. |
| How should the three same-pair routes be routed relative to one another? | Derive one shared shortest obstacle-avoiding routed spine where practical, then apply symmetric lane margins so the bilateral route remains centered between the two unilateral routes; lane offsets are derived, never persisted. |
| What do the 12px and 8px routing values mean? | Use 12px preferred obstacle clearance and 8px same-pair lane separation now, represented as routing constants so they can become future user settings without changing the Edge schema. |
| How should line styles and rule indicators communicate Edge state? | Use solid/dashed/dotted line styles for visible/obscured/hidden. Visible is assumed and has no path icon; obscured uses dashed-eye, hidden uses eye-off, and difficult uses chevrons-down. Place badges away from Zone boundaries. |
| What does `hidden` mean when there is no separate player/GM visibility layer? | It means visibility is blocked completely for the relationship/targeting rule, but the editor still renders the Edge to everyone as a dotted path with a hidden/eye-off icon so it can be inspected and targeted for editing. |
| Can unrelated Edges cross? | Yes. Unrelated crossing is allowed; coincident same-segment routes are discouraged and same-pair lanes remain separated. |
| What happens when the preferred clearance cannot fit? | Reduce obstacle clearance deterministically down to zero to find a route; never intentionally route through a Zone. |
| What happens when an existing Edge loses its route? | Keep its last valid cached path and show a warning. The graph relationship remains intact and routing does not block the mutation. |
| What happens when a newly created Edge has no route at all? | Render no path and show warning markers at the derived endpoint/anchor positions; do not silently remove or reject the graph Edge. |
| Where should routing warnings appear? | Show the non-blocking warning on the canvas and record it in the encounter Log; it is a render diagnostic rather than graph validation failure. |
| What are the approved creation and replacement defaults? | The sticky preset defaults to bilateral, unrestricted movement, visible, and straight; an occupied slot is replaced, while an identical preset only selects the existing Edge. |
| What toolbar lifecycle controls are required? | Presets remain sticky between creations; Reset restores the defaults. Clear All Edges is a separate action that opens an accessible confirmation modal and commits one undoable deletion. |
| How should multiple selected Edges be edited? | Properties supports batch editing of movement rules, visibility, and shape. Directionality and endpoints remain read-only; tags/notes are single-Edge fields. |
| Does an identical preset create another history entry? | No. It selects the existing matching Edge and performs no state mutation or history commit. |
| Can endpoints or directionality be edited later? | No. They are read-only/immutable after creation. |
| Is route geometry part of persisted state? | No. Paths, anchors, lane offsets, and routing failures are derived render state; a cache may reuse a working route but is not authoritative. |
