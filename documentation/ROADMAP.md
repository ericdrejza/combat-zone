# Project Roadmap

This roadmap is derived from `DESIGN.md`, `ARCHITECTURE.md`, and
`ACCEPTANCE.md`. Work is ordered by dependency: shared state and Redux history
infrastructure must land before feature tools, and feature tools must land
before persistence and final MVP verification.

## 1. Core Encounter State Foundation

- [x] Define the full `Encounter` runtime state shape.
  - Include `zones`, `edges`, `actors`, `engagements`, `annotations`,
    `initiativeTracker`, and `validationState`.
- [x] Define entity models for Zones, Actors, Engagements, Edges, and
  Annotations.
  - Zones include polygon geometry, layout strategy, and tags; zone contents
    are derived from actor and engagement state.
  - Actors include current zone, actor type, initiative, status
    effects, stats, image, and metadata.
  - Engagements are transitive participant groups, not actor pairs, and own
    participant membership.
  - Edges are explicit graph relationships, not derived from geometry.
- [x] Establish ID, lookup, and entity-normalization conventions.
- [x] Represent zoneless actors explicitly.
- [x] Add baseline state inspection helpers needed by acceptance tests.

## 2. Redux History and Undo/Redo Infrastructure

- [x] Implement the locked Redux history schema from `ARCHITECTURE.md`.
  - Store `past`, `present`, and `future` EncounterState snapshots.
  - Store serializable action records as history metadata.
  - Do not store executable command objects or functions in Redux state.
- [x] Implement the History Store in Redux.
  - Undo by restoring the latest past snapshot.
  - Redo by restoring the latest future snapshot.
  - Truncate redo history when a new committed action runs after undo.
- [x] Route every state mutation through the required flow:
  Tool Handler -> Interaction Engine -> Validation Pipeline -> Action Record
  Creation -> Redux History Commit -> Layout Recalculation -> Render.
- [x] Add tests proving undo/redo exactness for rapid state commits.
  - 10+ commits followed by 10 undos returns to exact original state.
  - Redo reapplies the exact same state, not a re-derived approximation.

## 3. Layout Strategy System

- [x] Create the shared pluggable layout strategy interface.
- [x] Implement Zone layout strategies.
  - `FLEX`
  - `SEQUENTIAL`
  - `SPLIT_SEQUENTIAL`
- [x] Implement Engagement layout strategies.
  - `FLEX`
  - `SEQUENTIAL`
- [x] Ensure layout recalculation is deterministic.
- [x] Ensure layout recalculation follows Redux history rules whenever it
  changes encounter state.
- [x] Add tests for immediate re-flow after layout strategy changes.

## 4. Validation Pipeline Foundation

- [x] Implement validation pipeline structure.
  - Action -> Validators[] -> Result -> Redux history commit or warning.
- [x] Add validation mode state.
  - `OFF`
  - `ADVISORY`
  - `ASSISTED`
  - `STRICT`
- [x] Implement MVP validators as advisory/non-blocking outside Strict mode.
  - `MovementValidator`
  - `EdgeValidator`
  - `EngagementValidator`
  - `ZoneIntegrityValidator`
- [x] Ensure GM authority is preserved outside Strict mode.
- [x] Add validation result plumbing for the status/validation panel.

## 5. Canvas Shell and Rendering Order

- [x] Build the workspace frame.
  - Toolbar
  - Left docked panel area
  - Canvas
  - Right docked panel area
  - Status, initiative, and validation side panels
- [x] Implement collapsible, vertically stackable, draggable dock panels.
- [x] Implement render layers in documented order.
  - Background
  - Zones
  - Edges
  - Free-floating actors
  - Engagement overlays
  - Annotations
  - UI overlays
- [x] Add selection overlay support for later tools.

## 6. Toolbar and Interaction Engine

- [ ] Implement tool registration and dispatch without a global setup/combat
  mode.
- [ ] Add MVP tools.
  - Select Tool
  - Zone Tool
  - Edge Tool
  - Actor Tool
  - Engagement Tool
  - Annotation Tool
  - Delete Tool
- [ ] Give every tool a visible tooltip describing its function.
- [ ] Implement tool-owned interaction contracts.
  - Selectable entity types
  - Drag behavior
  - Click behavior
  - Keyboard shortcuts
- [ ] Implement selection rules.
  - Tool-dependent selection scope
  - No cross-type selection
  - Shift-click toggles selection
  - Ctrl-click invokes contextual action
  - Box select
  - Ctrl+Shift additive box select
- [ ] Ensure switching tools clears stale interaction state, including
  half-drawn polygons.

## 7. Zones: Polygon Draw, Edit, Layout, and Deletion

- [ ] Implement polygon zone creation with the Zone Tool.
  - Circle and Rectangle only for MVP
  - Sequential point placement.
  - Close on click-near-start.
  - Close on double-click.
- [ ] Implement vertex dragging for existing zones.
- [ ] Add Zone properties editing.
  - Name
  - Layout strategy
  - Tags and other documented metadata
- [ ] Re-flow actors immediately when a zone layout strategy changes.
- [ ] Implement Zone deletion as a single reversible history entry.
  - Contained actors become zoneless.
  - Connected edges are auto-deleted.
  - Undo restores the zone, actors' prior zone assignments, and deleted edges.
- [ ] Add Vitest coverage for create, reshape, layout change, delete, undo,
  and redo.

## 8. Actors: Library, Placement, Movement, and Zoneless State

- [ ] Implement the Library Panel for actor templates.
- [ ] Allow actors to be dragged from the Library Panel onto the canvas into
  a zone.
- [ ] Implement actor movement between zones.
  - Update `currentZoneId`.
  - Recalculate layout in both source and destination zones.
- [ ] Implement actor movement to empty canvas space.
  - Actor becomes zoneless.
- [ ] Implement invalid drop handling.
  - Snap back to pre-drag position.
  - Do not create a Redux history entry for snap-back.
- [ ] Add Actor properties editing.
- [ ] Add Vitest coverage for actor create/place/move/zoneless behavior,
  invalid drops, undo, and redo.

## 9. Engagement Groups

- [ ] Implement Engagement entity creation through drag/drop.
  - Actor A dragged onto Actor B creates one Engagement containing exactly
    `{A, B}`.
- [ ] Implement adding actors to an existing Engagement.
  - Actor C dragged onto an Engagement joins the same group.
  - Do not create nested or sub-groups.
- [ ] Implement Engagement merge.
  - Engagement dragged onto Engagement merges all participants into one group.
- [ ] Implement actor movement out of Engagements.
  - Actor dragged to empty zone leaves the Engagement.
- [ ] Implement automatic Engagement dissolution.
  - Any Engagement with fewer than two members is deleted immediately.
  - Dissolution occurs as part of the history-tracked action that caused it.
- [ ] Add Engagement properties editing, including layout strategy.
- [ ] Apply Engagement layout strategies to participant CSS layout.
- [ ] Add Vitest coverage for create, join, merge, split/leave,
  auto-dissolve, layout, undo, and redo.

## 10. Edges: Basic Zone Graph

- [ ] Implement directional Edge creation between zones with the Edge Tool.
- [ ] Implement visual distinction for edge directionality.
  - One-way
  - Two-way
- [ ] Add Edge properties editing.
  - Directionality
  - Movement rule: `free`, `blocked`, `skillCheck`, `difficult`
  - Visibility rule: `clear`, `obscured`, `blocked`, `oneWay`
  - Interaction tags
  - Notes
- [ ] Ensure edges remain graph-first and geometry-independent.
- [ ] Ensure deleting either connected zone auto-deletes the edge as part of
  the same reversible history entry.
- [ ] Add Vitest coverage for create, edit, delete, cascading zone delete,
  undo, and redo.

## 11. Initiative Tracker

- [ ] Implement Initiative Panel.
- [ ] Allow actors to be added to the initiative list.
- [ ] Allow initiative entries to be reordered.
- [ ] Implement next-turn advancement.
  - Update the current actor indicator.
- [ ] Ensure initiative order survives undo/redo of unrelated actions.
- [ ] Add Vitest coverage for add, reorder, advance turn, unrelated undo/redo
  stability, undo, and redo.

## 12. Properties, Status, and Validation Panels

- [ ] Implement context-sensitive Properties Panel sections.
  - Actor properties
  - Zone properties
  - Edge properties
  - Engagement properties
- [ ] Implement Validation Panel display for validation pipeline results.
- [ ] Implement Bottom Status display for current tool and interaction state.
- [ ] Ensure panel updates are driven by selection context.

## 13. Local Persistence, Save/Load, and Export

- [ ] Implement autosave to local browser storage.
  - Trigger on every committed Redux history entry or a reasonable debounce.
- [ ] Restore the latest autosaved state after browser refresh.
- [ ] Implement manual Save and Load.
  - Round-trip full encounter state.
  - Include all entity types.
- [ ] Implement JSON export/import.
  - Include `schemaVersion` in every exported file.
  - Support full workspace export.
  - Support encounter-only export.
- [ ] Add tests or manual verification for no-loss round trips.

## 14. MVP Acceptance Hardening

- [ ] Create an acceptance test matrix covering every item in
  `ACCEPTANCE.md`.
- [ ] Verify every state-changing action type has an undo test.
  - Zone create/delete/reshape
  - Actor move
  - Engagement create/merge/split
  - Edge create/delete
  - Initiative reorder
- [ ] Verify Redux history remains exact under rapid sequential actions.
- [ ] Verify no direct state mutation paths bypass Redux history.
- [ ] Verify tool switching never leaves stale interaction state.
- [ ] Verify non-Strict validation does not block GM actions.
- [ ] Verify state-based assertions for destructive/cascading behaviors.
  - Zone deletion makes contained actors zoneless.
  - Zone deletion removes connected edges.
  - Engagements with fewer than two members do not persist.

## 15. Post-MVP Backlog

These items are explicitly outside the MVP must-have scope but are listed in
the design as future or nice-to-have work.

- [ ] Advanced validation behavior beyond MVP plumbing.
- [ ] Additional layout strategies.
  - Radial
  - Stack
  - Manual
- [ ] Theme expansion beyond light, dark, and system default.
- [ ] Command palette.
- [ ] Plugins.
- [ ] Cloud sync.
- [ ] Multi-layer encounters.
- [ ] Verticality and multi-level zones.
- [ ] Animated transitions.
- [ ] AI-assisted GM suggestions.
- [ ] Rule system plugins per RPG.
