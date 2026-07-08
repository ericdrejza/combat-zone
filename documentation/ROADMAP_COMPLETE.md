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
  - `SPLIT_FLEX`
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

- [x] Implement tool registration and dispatch without a global setup/combat
  mode.
- [x] Add MVP tools.
  - Select Tool
  - Zone Tool
  - Edge Tool
  - Actor Tool
  - Annotation Tool
  - Background Tool
- [x] Give every tool a visible tooltip describing its function.
- [x] Implement tool-owned interaction contracts.
  - Selectable entity types
  - Drag behavior
  - Click behavior
  - Keyboard shortcuts
- [x] Implement selection rules.
  - Tool-dependent selection scope
  - No cross-type selection
  - Shift-click toggles selection
  - Ctrl-click invokes contextual action
  - Box select
  - Ctrl+Shift additive box select
- [x] Ensure switching tools clears stale interaction state, including
  half-drawn polygons.

## 7. Zones: Polygon Draw, Edit, Layout, and Deletion

- [x] Implement polygon zone creation with the Zone Tool.
  - Zones are stored and edited as polygon point lists.
  - Rectangle and circle-like regions are represented by their polygon points.
  - Sequential point placement.
  - Close on click-near-start.
  - Close on double-click.
- [x] Implement vertex dragging for existing zones.
- [x] Add Zone properties editing.
  - Name
  - Layout strategy
  - Tags and other documented metadata
- [x] Re-flow actors immediately when a zone layout strategy changes.
- [x] Implement Zone deletion as a single reversible history entry.
  - Contained actors become zoneless.
  - Connected edges are auto-deleted.
  - Engagements parented to the deleted zone are auto-deleted to avoid
    dangling `parentZoneId` references.
  - Undo restores the zone, actors' prior zone assignments, and deleted edges.
- [x] Add Vitest coverage for create, reshape, layout change, delete, undo,
  and redo.

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