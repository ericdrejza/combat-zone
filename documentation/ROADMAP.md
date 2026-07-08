# Project Roadmap

This roadmap is derived from `DESIGN.md`, `ARCHITECTURE.md`, and
`ACCEPTANCE.md`. Work is ordered by dependency: shared state and Redux history
infrastructure must land before feature tools, and feature tools must land
before persistence and final MVP verification.

To reference completed items, see `ROADMAP_COMPLETE.md`.

After completing a numbered section (## X.), move the completed section to the end of `ROADMAP_COMPLETE.md`

## 8. Library

- [x] Add a "Library" button to toolbar
  - New leftmost toolbar tool section;  
  - Button has a book icon in it
- [x] Implement Asset Library
  - Clicking Library tool button opens a large library modal
  - Library modal tabs for sections: "Encounters", "Backgrounds", "Tokens"
  - Traditional file system look and feel for each section
  - Left side of modal is the file explorer for the given section
    - Expand and collapse folders, right click gives basic file system changes:
      - Rename, Delete
    - Dragging and dropping a file (a directory also counts a file) into another
      folder moves it into that target folder.
      - Highlight the name of which folder it would be moved into while dragged over.
  - Place a "plus"/"add" icon on the left side for creating/adding new items
    - The add options it gives you should be upload new image
    - create new folder
    - create a link to an existing asset already in this section
      - should prompt you with a singular Miller column to navigate and select the asset
- [x] Implement the Library panel
  - Contains tokens from the Tokens section when Select tool is selected.
  - Contains reduced size background images from the Backgrounds section when
    the Background tool is selected.
  - This panel body should act as a singular Miller column with only the parent
    directory (back arrow / return up icon) (if not already at the root of the
    section folder) at the top, the available folders in the current folder, 
    followed by files.
- [x] Allow backgrounds to be clicked in library panel; this should update the canvas
  with the new background.
  - Hovering a background image in the library panel will expand the image size
    slightly (20%) with a smooth, quick animation.  Unhovering will set the image
    thumbnail back to the original size in the panel.

## 9. Actors: Placement, Movement, and Zoneless State
- [ ] Allow actors to be dragged from the Library Panel onto the canvas into
  a zone.
- [ ] Implement actor movement between zones.
  - Update `currentZoneId`.
  - Recalculate layout in both source and destination zones.
- [ ] Implement actor movement to empty canvas space.
  - Actor becomes zoneless.
- [ ] Implement invalid drop handling.
  - No drop allowed outside of canvas.
  - Snap back to pre-drag position.
  - Do not create a Redux history entry for snap-back.
- [ ] Add Actor properties editing.
- [ ] Add Vitest coverage for actor create/place/move/zoneless behavior,
  invalid drops, undo, and redo.

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
