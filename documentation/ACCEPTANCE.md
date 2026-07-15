# Acceptance Criteria — MVP Scope

Referenced by `AGENT.md`. Each item below must be independently verifiable
(manually or via Vitest) before a feature is considered done. This file
covers `DESIGN.md` §15 "Must have" scope only.

## Zones (polygon draw/edit)

- [x] GM can draw a new polygonal zone with the Zone Tool via sequential
      point placement, closing the shape on click-near-start or double-click.
- [x] Existing zone vertices can be dragged individually to reshape the
      polygon.
- [x] A zone can be assigned a layout strategy (FLEX / SEQUENTIAL /
      SPLIT_FLEX / SPLIT_SEQUENTIAL) via the Properties Panel, and actors inside
      re-flow immediately per the new strategy.
- [x] Deleting a zone: contained actors become zoneless (verified via state
      inspection, not just visually), edges connected to it are removed,
      engagements parented to the deleted zone are removed to avoid dangling
      zone references, and the whole operation undoes as a single Redux
      history entry.

## Actors (drag/drop)

- [x] Zoneless actors are represented in a collapsible bottom-center panel,
      sorted alphabetically, with optional Hero/Neutral/Enemy grouping.
- [x] Actors can be selected in the zoneless panel and dragged individually or
      as a selected group into a zone; dropping outside a zone leaves them in
      the panel without creating history.
- [x] Actors can be dragged directly from a zone into the zoneless panel.
- [x] The zoneless panel can be resized horizontally and vertically and has a
      reset-size control after resizing by dragging its left, right, or top
      edge.
- [x] While collapsed, the zoneless panel is transparent and uses a
      luminance-derived color for its border and controls.
- [x] Actor name text uses the canvas luminance helpers to choose a readable
      black or white contrast color; selected canvas actor labels use the fill
      color of their containing zone.
- [x] Uploaded token names omit their source file extension, while actors
      inherit the token name when created from the library.
- [ ] Actor can be dragged from Library Panel onto canvas into a zone.
- [ ] Actor dragged from one zone to another updates `currentZoneId` and
      triggers layout recalculation in both the source and destination zone.
- [ ] Actor dropped on invalid target (e.g. outside any valid drop zone for
      current tool rules) snaps back to its pre-drag position, and this
      snap-back does **not** create a spurious Redux history entry.
- [ ] Actor dragged to empty canvas space becomes zoneless.

## Polygon FLEX actor packing (logic phase)

- [x] A singular actor targets the center of every FLEX zone shape.
- [x] Multiple FLEX actors in rectangle, circle, hexagon, and user-drawn
      polygon zones use rendered rectangle/circle
      footprints, deterministic collection order, and polygon packing without
      overlap.
- [x] Preferred 16px border spacing adaptively falls back to 12px, 8px, and
      4px when the actor set needs more room.
- [x] Actor creation or movement is rejected when no valid non-overlapping
      packing exists in every zone shape, including OFF, ADVISORY, ASSISTED,
      and STRICT modes.
- [x] The pure placement result preserves an incoming drop point and returns
      the packed target for the later animation phase.
- [ ] Canvas actor rendering uses the incoming drop point and packed targets
      for animated transitions (requires explicit approval for the animation
      phase).

## Native image drops

- [x] With the Background Tool selected, dropping an external image onto the
      canvas sets or replaces the canvas background.
- [x] With the Actor Tool selected, dropping an external image onto the canvas
      creates an actor using the active actor toolbar configuration and the
      dropped image.
- [x] Native image-drop creation and background changes are undoable and
      redoable as single Redux history entries.

## Engagement groups

- [ ] Dragging Actor A onto Actor B creates a new Engagement containing
      exactly {A, B}.
- [ ] Dragging Actor C onto that Engagement adds C to the same group (not a
      nested/sub-group).
- [ ] Dragging one Engagement onto another merges both into a single group
      containing all participants from both.
- [ ] Removing a participant such that the Engagement has fewer than 2
      members auto-dissolves the Engagement (per `AGENT.md` Resolved Edge
      Cases), and this is verified in state, not just visually.
- [ ] Engagement respects its assigned layout strategy (FLEX / SEQUENTIAL)
      for participant positioning.

## Edges (basic graph)

- [ ] GM can create a directional edge between two zones with the Edge Tool.
- [ ] Edge directionality (one-way / two-way) is settable and visually
      distinguishable.
- [ ] Edge movement rule (free / blocked / skillCheck / difficult) is
      settable via Properties Panel.
- [ ] Edge visibility rule (clear / obscured / blocked / oneWay) is settable
      via Properties Panel.
- [ ] Deleting either connected zone auto-deletes the edge as part of the
      same Redux history entry (single undo restores both).

## Initiative tracker

- [ ] Actors can be added to and reordered within an initiative list.
- [ ] Advancing to the next turn updates the "current actor" indicator.
- [ ] Initiative order survives undo/redo of unrelated actions (e.g. moving
      an actor between zones does not corrupt initiative order).

## Toolbar interaction system

- [ ] Every tool has a visible tooltip describing its function
      (per `DESIGN.md` §5.1 mandatory tooltip requirement).
- [ ] Switching tools does not require a global mode change — each tool's
      selection/drag/click rules are self-contained and switching tools
      never leaves stale interaction state (e.g. a half-drawn polygon)
      dangling.

## Undo/redo

- [ ] Every state-changing action type listed above (zone create/delete/reshape,
      actor move, engagement create/merge/split, edge create/delete,
      initiative reorder) has a passing Vitest test verifying undo exactly
      restores prior state.
- [ ] Rapid sequential actions (10+ commits in quick succession) followed
      by 10 undos returns to the exact original state (no drift).
- [ ] Redo after undo re-applies the exact same state, not a re-derived
      approximation.

## Local persistence

- [ ] Autosave triggers on every committed Redux history entry (or on a reasonable
      debounce) to local browser storage.
- [ ] Manual "Save" / "Load" round-trips the full encounter state including
      all entity types without loss.
- [ ] Exported JSON includes a `schemaVersion` field (per `AGENT.md`).
- [ ] Reloading the app after a browser refresh restores the last
      autosaved state.

---

Add new sections here as MVP scope is confirmed to have grown; don't fold
these back into `AGENT.md` or `DESIGN.md`.
