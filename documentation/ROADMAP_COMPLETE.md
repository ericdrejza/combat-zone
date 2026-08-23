## 1. Core Encounter State Foundation

- [x] Define the full `Encounter` runtime state shape.
  - Include `zones`, `edges`, `actors`, `engagements`, `annotations`,
    `initiativeTracker`, and `validationState`.
- [x] Define entity models for Zones, Actors, Engagements, Edges, and
  Annotations.
  - Zones include polygon geometry, layout strategy, and tags; zone contents
    are derived from actor and engagement state.
  - Actors include current zone, actor type, status effects, stats, image, and
    metadata; initiative values belong to tracker entries.
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

## 9. Actors: Placement, Movement, and Zoneless State

- [x] The Actor tool now enables Library panel to be populated with
  tokens from the asset library instead of the Select tool
  - The select tool should collapse the Library panel automatically
- [x] Allow tokens to be dragged from the Library Panel onto the canvas into
  a zone.
- [x] Implement layout strategies
- [x] Implement actor movement between zones.
  - Click, drag, and drop actor into zone
  - Update `currentZoneId`.
  - Recalculate layout in both source and destination zones.
- [x] Implement actor movement to empty canvas space.
  - Actor becomes zoneless.
- [x] Implement invalid drop handling.
  - No drop allowed outside of canvas.
  - Layout may never place token outside zone
    - If not a split layout, move token toward center of zone if layout would
      attempt to place token outside zone.
  - Snap back to pre-drag position.
  - Do not create a Redux history entry for snap-back.
- [x] Represent zoneless actors in a collapsible bottom-center panel.
  - Actors are alphabetized and can optionally be grouped Hero, Neutral, Enemy.
  - Selected actors can be dragged into zones; invalid panel drops leave them
    zoneless without a history entry.
  - Actors can be dragged from zones back into the panel.
  - The panel supports horizontal and vertical resizing from its left, right,
    and top edges with a reset-size control.
  - The collapsed panel is transparent and uses luminance-derived contrast
    colors for its border and controls.
  - Actor name text uses luminance-derived contrast colors, including selected
    canvas labels based on their containing zone fill.
- [x] Strip uploaded token file extensions when creating library token names;
  actors inherit those token names when created.
- [x] With the actor tool selected, you may click on a zone to target it
  (looks like a throbbing selection outline); click and release (no drag) on a
  token from the Library panel adds an actor with that token to that target zone.
  - Clicking out of a zone or right clicking untargets a zone
- [x] With the Actor or Select tool, actors on the canvas are selected with a click.
  - Delete key deletes the selected actor
  - Ctrl+C copies the actor and Ctrl+V pastes a new copy/instance of that actor
    - Copy is pasted in the same zone as the original if no target zone is selected.
    - Copy is pasted in the target zone if one is selected.
- [x] Add Actor properties editing.
- [x] The Actor tool chooses how moved dragged tokens from the library will
  become actors and their representation on the canvas.
  - Below the Actor tool, there should be button groups (only one active
    selection per button group) for:
    - "Faction" (options: "Hero" (blue circle), "Neutral" (yellow circle), "Enemy" (red circle))
    - "Size" - options:
      - "Small" (small solid black square)
      - "Medium" (medium solid black circle)
      - "Large" (2 x 2 square grid icon)
      - "X-Large" (3 x 3 square grid icon)
      - Size multipliers for actor tokens displayed on canvas
        (starting from time of dragging if dragged):
        - small (0.75)
        - medium (1)
        - Large (2)
        - X-Large (3)
    - "Shape" options:
      - Circle
      - Rectangle
    - Button group buttons should only have icons in them
- [x] Add Vitest coverage for actor create/place/move/zoneless behavior,
  invalid drops, undo, and redo history.
- [x] Implement deterministic polygon-footprint packing as the shared FLEX
      strategy for every zone shape.
- [x] Support configurable preferred/minimum border spacing, actor gaps,
  rendered rectangle/circle footprints, stable ordering, incoming drop-point
  metadata, and fit rejection.
- [x] Enforce no-overlap packing failures in every validation mode for actor
  movement and creation.
- [x] Add the approved canvas animation phase with Motion for React.

## 10. Engagement Groups

- [x] Implement Engagement entity creation through drag/drop.
  - Actor A dragged onto Actor B creates one Engagement containing exactly
    `{A, B}`.
  - Add and style Engagement entity on canvas
- [x] Implement adding actors to an existing Engagement.
  - Actor C dragged onto an Engagement joins the same group.
  - Do not create nested or sub-groups.
- [x] Implement Engagement merge.
  - Engagement dragged onto other Engagement merges all participants into one group.
- [x] Implement actor movement out of Engagements.
  - Actor dragged to empty zone leaves the Engagement.
- [x] Implement automatic Engagement dissolution.
  - Any Engagement with fewer than two members is deleted immediately.
  - Dissolution occurs as part of the history-tracked action that caused it.
- [x] Add Engagement properties editing, including layout strategy.
- [x] Apply Engagement layout strategies to participant CSS layout.
- [x] Add Vitest coverage for create, join, merge, split/leave,
  auto-dissolve, layout, undo, and redo.

## 11. Edges: Basic Zone Graph

- [x] Implement directional Edge creation between zones with the Edge Tool.
- [x] Implement visual distinction for edge directionality.
  - Bilateral
  - Unilateral
- [x] Add Edge properties editing.
  - Read-only directionality and endpoints
  - Movement rules: `blocked`, `skillCheck`, `difficult`
  - Visibility rule: `visible`, `obscured`, `hidden`
  - Shape: `straight`, `rightAngled`, `curved`, `sigmoid`
  - Interaction tags
  - Notes
- [x] Add sticky Edge toolbar presets, reset, occupied-slot replacement, and
      confirmed clear-all.
- [x] Route Edges around Zones with derived anchors, lane separation, live
      Zone-move updates, route caching, and non-blocking routing diagnostics.
- [x] Ensure edges remain graph-first and geometry-independent.
- [x] Ensure deleting either connected zone auto-deletes the edge as part of
      the same reversible history entry.
- [x] Add Vitest coverage for create, edit, delete, cascading zone delete,
      undo, and redo.

## 12. Initiative Tracker

- [x] Implement Initiative Panel.
- [x] Allow actors to be added to and removed from the initiative list.
  - [x] Add Selected adds all selected actors.
  - [x] Add Visible adds all actors currently assigned to Zones.
  - [x] Add All adds every actor in the encounter.
  - [x] Add Remove Selected and Remove All controls; removed composite entries
        discard their scoped initiative values.
- [x] Allow initiative entries to be reordered and automatically sorted by
      initiative value.
- [x] Implement start/end combat and next-turn/previous-turn advancement.
  - [x] Update the current actor indicator.
  - [x] Track the current round and increment automatically when advancing
        from the last actor to the first.
- [x] Ensure initiative order survives undo/redo of unrelated actions.
- [x] Select initiative participants on click and use a swappable double-click
      strategy to make a participant current without changing the round.
- [x] Reflect selected participants with bold names and support Ctrl toggle and
      cumulative Shift range selection within initiative order without native
      text highlighting.
- [x] Auto-scroll the initiative viewport when a reordered participant is
      dragged against a scrollable edge.
- [x] Preserve active rounds with an empty participant list; empty Next/Prev
      changes only the round, and adding participants assigns the first current.
- [x] Add Vitest coverage for add, edit, reorder, advance turn, removal,
      validation modes, unrelated undo/redo stability, undo, and redo.
