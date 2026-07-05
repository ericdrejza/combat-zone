# Acceptance Criteria — MVP Scope

Referenced by `AGENT.md`. Each item below must be independently verifiable
(manually or via Vitest) before a feature is considered done. This file
covers `DESIGN.md` §15 "Must have" scope only.

## Zones (polygon draw/edit)

- [ ] GM can draw a new polygonal zone with the Zone Tool via sequential
      point placement, closing the shape on click-near-start or double-click.
- [ ] Existing zone vertices can be dragged individually to reshape the
      polygon.
- [ ] A zone can be assigned a layout strategy (FLEX / SEQUENTIAL /
      SPLIT_SEQUENTIAL) via the Properties Panel, and actors inside
      re-flow immediately per the new strategy.
- [ ] Deleting a zone: contained actors become zoneless (verified via state
      inspection, not just visually), edges connected to it are removed,
      and the whole operation undoes as a single Command.

## Actors (drag/drop)

- [ ] Actor can be dragged from Library Panel onto canvas into a zone.
- [ ] Actor dragged from one zone to another updates `currentZoneId` and
      triggers layout recalculation in both the source and destination zone.
- [ ] Actor dropped on invalid target (e.g. outside any valid drop zone for
      current tool rules) snaps back to its pre-drag position, and this
      snap-back does **not** create a spurious Command/history entry.
- [ ] Actor dragged to empty canvas space becomes zoneless.

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
      same Command (single undo restores both).

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

- [ ] Every command type listed above (zone create/delete/reshape, actor
      move, engagement create/merge/split, edge create/delete, initiative
      reorder) has a passing Vitest test verifying `undo()` exactly
      restores prior state.
- [ ] Rapid sequential actions (10+ commands in quick succession) followed
      by 10 undos returns to the exact original state (no drift).
- [ ] Redo after undo re-applies the exact same state, not a re-derived
      approximation.

## Local persistence

- [ ] Autosave triggers on every committed Command (or on a reasonable
      debounce) to local browser storage.
- [ ] Manual "Save" / "Load" round-trips the full encounter state including
      all entity types without loss.
- [ ] Exported JSON includes a `schemaVersion` field (per `AGENT.md`).
- [ ] Reloading the app after a browser refresh restores the last
      autosaved state.

---

Add new sections here as MVP scope is confirmed to have grown; don't fold
these back into `AGENT.md` or `DESIGN.md`.
