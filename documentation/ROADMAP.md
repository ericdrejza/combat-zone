# Project Roadmap

This roadmap is derived from `DESIGN.md`, `ARCHITECTURE.md`, and
`ACCEPTANCE.md`. Work is ordered by dependency: shared state and Redux history
infrastructure must land before feature tools, and feature tools must land
before persistence and final MVP verification.

To reference completed items, see `ROADMAP_COMPLETE.md`.

After completing a numbered section (## X.), move the completed section to the end of `ROADMAP_COMPLETE.md`

## 10. Engagement Groups

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

## 11. Edges: Basic Zone Graph

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

## 12. Initiative Tracker

- [ ] Implement Initiative Panel.
- [ ] Allow actors to be added to the initiative list.
- [ ] Allow initiative entries to be reordered.
- [ ] Implement next-turn advancement.
  - Update the current actor indicator.
- [ ] Ensure initiative order survives undo/redo of unrelated actions.
- [ ] Add Vitest coverage for add, reorder, advance turn, unrelated undo/redo
  stability, undo, and redo.

## 13. Properties, Status, and Validation Panels

- [ ] Implement context-sensitive Properties Panel sections.
  - Actor properties
  - Zone properties
  - Edge properties
  - Engagement properties
- [ ] Implement Validation Panel display for validation pipeline results.
- [ ] Implement Bottom Status display for current tool and interaction state.
- [ ] Ensure panel updates are driven by selection context.

## 14. Local Persistence, Save/Load, and Export

- [ ] Implement autosave to local browser storage.
  - IndexedDB
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

## 15. MVP Acceptance Hardening

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

## 16. Post-MVP Backlog

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
