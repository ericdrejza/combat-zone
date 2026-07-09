# Part 9: Actors Placement, Movement, and Zoneless State

  ## Summary

  Implement Actor placement and movement end-to-end using Redux history, derived layout descriptors, and tool-driven interaction. Add a top-level Actor.size domain
  field per user decision, and add core-only Actor Properties editing for name, actorType, layoutGroup, image, and size.

  ## Key Changes

  - Extend actor domain types with size: "small" | "medium" | "large" | "xLarge" and render multipliers 0.75, 1, 2, 3.
  - Add actor mutations in entities/actor/ for create, move, update properties, delete, and duplicate/copy, all returning new EncounterState.
  - Add/extend validation so actor.create and actor.move reject missing actors/zones in STRICT, but commit with validation messages in ADVISORY.
  - Move Library Panel token visibility from Select tool to Actor tool; Select tool no longer populates token assets and should collapse/empty the Library panel
    automatically.

  - Add Actor tool controls below/near the toolbar for:
      - Faction/layout group: hero, neutral, enemy.
      - Size: small, medium, large, xLarge.
      - Icon-only buttons with accessible names.

  ## Canvas Behavior

  - Add an actor render layer using derived zone layout from calculateZoneLayout; do not persist actor coordinates.
  - Render zoneless actors in the free-floating actor layer as a stable, deterministic area outside zones.
  - Allow dragging token assets from the Library Panel onto the SVG canvas:
      - Drop inside a zone creates an actor with selected faction, size, token image, and currentZoneId.
      - Drop on empty canvas creates a zoneless actor.
      - Drop outside the canvas creates no actor and no history entry.

  - Support Actor-tool target zone:
      - Clicking a zone targets it with a throbbing outline.
      - Clicking outside a zone or right-clicking clears the target.
      - Clicking and releasing a token in Library Panel with no drag creates an actor in the target zone.

  - Support moving existing actors with Actor or Select tool:
      - Drag actor into another zone updates currentZoneId.
      - Drag actor to empty canvas sets currentZoneId to zoneless.
      - Invalid drops snap back via local drag-preview state only, with no Redux history entry.
      - Source and destination zone layout reflow is automatic because layout is derived from actor zone assignments.

  - Ensure rendered token placement is clipped/constrained to the zone visual area; for non-split layouts, bias oversized or crowded tokens toward the zone center
    rather than allowing them outside the zone.

  ## Selection, Keyboard, and Properties

  - With Actor or Select tool, actor click selects actors without cross-type selection.
  - Delete removes selected actors through one history-tracked mutation.
  - Ctrl+C/Cmd+C stores selected actor copy data in interaction/UI state.
  - Ctrl+V/Cmd+V creates a new actor instance:
      - In selected Actor target zone if present.
      - Otherwise in the original actor’s current zone assignment.

  - Add ActorPropertiesPanel and route Properties Panel content by selected entity type.
  - Actor properties edit only: name, actorType, layoutGroup/faction, token image, and size.

  ## Tests

  - Add Vitest coverage for actor mutations:
      - invalid snap-back does not dispatch/commit a history entry.
      - STRICT blocks invalid actor create/move; ADVISORY commits and records validation messages.

  - Add layout tests proving actor movement changes derived source/destination zone descriptors without persisted coordinates.
  - Add UI tests for:
      - Library Panel token assets appear for Actor tool and not Select tool.
      - Actor tool faction/size controls affect newly created actors.
      - Actor selection, Delete, copy, and paste behavior.
      - Target zone outline/clear behavior.

  - After tests pass, check Part 9 items in documentation/ROADMAP.md and move the completed section to documentation/ROADMAP_COMPLETE.md.

  ## Assumptions

  - Actor.size is intentionally added as a top-level domain field, overriding the default “do not add properties not in DESIGN.md” rule for this roadmap item.
  - Actor Properties editing is limited to core fields: name, actorType, layoutGroup, image, and size; initiative, status effects, stats, and arbitrary metadata
    are deferred.

  - Engagement-specific actor drag/drop behavior remains for Part 10; Part 9 only handles actor-to-zone, actor-to-empty-canvas, library-to-zone, and library-to-
    empty-canvas.