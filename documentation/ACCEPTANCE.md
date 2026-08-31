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
- [x] A zone with automatic resizing enabled expands to the minimum
      actor-fitting size when an added actor would not fit, preserving aspect
      ratio when possible, keeping rectangles rectangular, and rejecting
      expansions that overlap another zone.

## Actors (drag/drop)

- [x] Zoneless actors are represented in a collapsible bottom-center panel on
      larger screens and in the compact panel drawer below 1024px, sorted
      alphabetically, with optional Hero/Neutral/Enemy grouping.
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

- [x] A singular actor targets the center of every FLEX zone shape when its
      footprint fits there; otherwise the polygon fit algorithm moves it to a
      valid in-zone position without intersecting the zone border.
- [x] Multiple FLEX actors in rectangle, circle, hexagon, and user-drawn
      polygon zones use rendered rectangle/circle
      footprints, deterministic collection order, and polygon packing without
      overlap.
- [x] Shared polygon packing retains at least 4px actor-footprint clearance in
      dense FLEX, SEQUENTIAL, SPLIT_FLEX, and SPLIT_SEQUENTIAL layouts; FLEX
      additionally distributes spare room around actors in two dimensions
      instead of unnecessarily pushing actors toward zone borders.
- [x] Non-split SEQUENTIAL actors use the shared polygon packer in collection
      order, with clockwise targets and the same incremental border-spacing
      fallback used by FLEX.
- [x] Rectangular SEQUENTIAL actors use an aligned left-to-right,
      top-to-bottom row-major layout based on each actor's footprint, moving
      row baselines as needed to preserve the no-overlap rule.
- [x] SPLIT_FLEX and SPLIT_SEQUENTIAL allocate only the section size required
      by each faction, distribute remaining space by faction actor-footprint
      area, and clip curved sections to circle/hexagon zone boundaries before
      validating footprints.
- [x] Split section boundaries move during zone resizing when an internal
      layout needs a different row/column shape, borrowing spare room across
      adjacent sections before actor-area weighting is applied.
- [x] SPLIT_FLEX lays out each faction independently with section-scoped FLEX
      space-around distribution; actors in another section do not affect its
      internal shape or spacing.
- [x] SPLIT_SEQUENTIAL centers collection-ordered actors on aligned lines
      inside each faction section and wraps to a new line when full.
- [x] Split layouts expose a persisted section-divider visibility control
      beside Orientation; enabled dividers are clipped to the zone and render
      dashed in its border color at 70% opacity.
- [x] The hard polygon no-overlap fit check applies to FLEX, SEQUENTIAL,
      SPLIT_FLEX, and SPLIT_SEQUENTIAL zone layouts in every validation mode.
- [x] Preferred 16px border spacing adaptively falls back to 12px, 8px, and
      4px when the actor set needs more room.
- [x] Actor creation or movement is rejected when no valid non-overlapping
      packing exists in every zone shape, including OFF, ADVISORY, ASSISTED,
      and STRICT modes.
- [x] The pure placement result preserves an incoming drop point and returns
      the packed target for the later animation phase.
- [x] Canvas actor rendering uses the incoming drop point and packed targets
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

## Canvas background and navigation

- [x] Adding or replacing a background records its intrinsic dimensions,
      defaults to whole-image fit, preserves aspect ratio, and proportionally
      scales existing Zone polygons from the top-left origin.
- [x] Background controls provide dimensions-derived To fit, Fit width, and
      Fit height radio commands plus 10% Shrink and Expand actions. Shrinking
      clamps before an existing Zone/actor layout becomes invalid.
- [x] Background sizing controls remain available without an image, and fit
      commands target the currently zoomed visible viewport.
- [x] Canvas-size and background mutations are single undoable/redoable Redux
      history entries; deleting a background retains the current canvas size.
- [x] Zoom to fit, Zoom out, and Zoom in affect perception only, preserve the
      viewed center, stay within 20–400%, and do not create history entries.
- [x] The toolbar displays the current zoom percentage and Reset zoom restores
      the fixed 100% perceptual anchor.
- [x] Canvas resizing preserves zoom and the proportionally centered canvas
      point, centering automatically on axes that no longer overflow.
- [x] The canvas scrolls vertically by wheel, horizontally by Shift + wheel,
      and by arrow keys while focused. Default-enabled, toggleable right-drag
      panning scrolls both axes and suppresses context actions only after a pan.
      Native scrollbar chrome remains hidden.
- [x] Drawing, dragging, resizing, selection, overlays, and native drops share
      the same SVG coordinate transform at every zoom and scroll position.
- [x] On touch screens, one pointer performs active-tool editing and two
      pointers pan and pinch zoom without history; touch hold does not emulate
      right-click.

## Engagement groups

- [x] Dragging Actor A onto Actor B creates a new Engagement containing
      exactly {A, B}.
- [x] Actor → unengaged Actor, existing Engagement participant, or Engagement
      token intent appears only after 500ms hover; dropping before that moves
      all dragged actors to the target zone without joining/creating, and
      dropping after creates or joins the intended Engagement.
- [x] Dragging Actor C onto that Engagement adds C to the same group (not a
      nested/sub-group).
- [x] Dragging one Engagement onto another merges both into a single group
      containing all participants from both.
- [x] Dragging multiple selected actors moves every dragged actor, including
      across zones, with the defined actor/group move semantics.
- [x] Dragging a proper subset of an Engagement retracts every connector
      branch touching those actors with the single-actor tether behavior.
      Dragging the complete participant set translates its token and complete
      connector network by exactly the actors' transient drag vector, without
      duplicate overlay tethers.
- [x] Dragging every participant of an Engagement to another zone before
      engagement intent matures preserves its ID and membership while updating
      its parent zone and the participants' actor zone IDs; a matured intent
      instead groups the dragged actors and hovered actor as indicated. A
      partial-group quick drop retains the established leave/unengaged behavior.
- [x] Removing a participant such that the Engagement has fewer than 2
      members auto-dissolves the Engagement (per `AGENT.md` Resolved Edge
      Cases), and this is verified in state, not just visually.
- [x] The non-toggle desktop Engage action immediately right of Select groups selected
      actors independently per zone, ignores zones with fewer than two
      selections, removes only selected actors from prior groups, leaves
      unselected members intact, and records the complete change as one history
      action with auto-dissolution included.
- [x] Engagement respects its assigned layout strategy (FLEX / SEQUENTIAL)
      and orientation for participant positioning.
- [x] Engagements render in their own layer after Edges and before Actors: a
      24px circular token uses the crossed-swords asset; its fill and border
      match the parent Zone border color and its icon uses luminance-derived
      black or white contrast. Connectors and token are behind actor tokens.
- [x] In settled layouts, engagement participants form non-overlapping,
      comfortably spaced clusters around their token with a 10px preferred and
      4px hard-minimum participant gap. Actor-to-actor connector branches use
      at least a 10px edge-to-edge gap so the line remains visible. Connectors
      avoid actor footprints and other connector lines. Direct connectors
      share only their own token endpoint; bounded routing falls back to a same-style
      actor-to-connected-actor tree whose branches may meet only at their
      connected participant endpoint. When both paths are clear, the token
      spoke is preferred unless the actor branch is at most half as long;
      invalid paths are excluded before that comparison. Other Engagement tokens and accepted
      connectors are obstacles; regression coverage includes three
      Engagements with three actors each in one zone. Every participant has
      one token-to-actor or actor-to-actor connector; incomplete connector
      networks are blocked in every validation mode. The packer-approved token
      point is preserved through worker/cache geometry and shared by rendering
      and hit-testing; 8/4/3-group coverage verifies every token clears every
      actor and every participant line remains present. Collision geometry is
      shape-aware for circle/circle, rectangle/rectangle, circle/rectangle,
      token/actor, and connector/actor pairs; independent 2px connector
      strokes cannot overlap.
- [x] Unequal Engagements use token-owned participant regions: every actor
      remains closer to its own token than another Engagement token, so a
      large group cannot wrap around or contain a smaller group. Elongated
      chains do not reserve circular empty space; a fitting smaller Engagement
      can still gain participants, while a join that requires nesting is
      blocked.
- [x] During a Zone drag, its Engagement tokens and every connector endpoint
      translate by exactly the same transient vector as its actors and polygon,
      without repacking or persisting derived coordinates.
- [x] Dragging an Engagement token works in Actor and Select; dragging an
      engaged actor retains its connector through 30px of movement and then
      recoils it to the token center in approximately 150ms. Returning within
      30px reattaches the tether and preserves membership on drop without a
      history entry, while settled layouts retain the routing guarantees.
      Token drag previews use MotionValues, connectors follow the token
      endpoint, and a non-merge same-zone drop slides home without a history
      entry.
- [x] Actor/Engagement drag targets preview the impending action in the
      toolbar: matured 500ms actor engagement intent or a token merge target
      activates Engage, moving an engaged actor beyond its tether activates
      Disengage, and a token targeted for merge receives a Zone-name-color
      outline. The matured actor intent badge contains the crossed-swords icon.
- [x] Clicking an Engagement token selects all participant actors. The
      icon-only Lucide `Unlink2` Disengage action beside Engage enables when
      any selected actor is engaged and removes only selected participants,
      including auto-dissolution and exact undo/redo coverage.
- [x] On mobile, Engage and Disengage are contextual bottom-left canvas
      actions for Actor and Select tools: Engage requires at least two selected
      actors in one Zone, Disengage requires at least one selected engaged
      actor, and Disengage is to the right of Engage when both are visible.
      Delete remains leftmost when it shares the action row, and the compact
      rename button scrolls with the primary toolbar tools.
- [x] In SPLIT_FLEX and SPLIT_SEQUENTIAL zones, unengaged actors remain in
      faction sections and each Engagement receives a separate isolated section
      in dynamic `engagements.allIds` order between the hero and neutral
      sections; its participants and 24px token fit inside that section.
- [x] Spacious FLEX engagement clusters try wider participant clearance, while
      dense layouts retain the 10px preferred and 4px minimum fallback.
      Multiple Engagements in an ordinary FLEX Zone prefer distant Zone-local
      candidate regions before compact fallback; mixed small/medium groups
      continue to fit beside a larger Engagement and a loose large actor.
      Engagement size has no numeric cap; multi-ring packing and exact-center
      candidates allow at least 20 medium participants in a fitting 500×360
      FLEX Zone in every validation mode. When multiple radial clusters do not
      fit, all groups are rearranged with token-anchored serpentine chains;
      growth from neighboring groups of 9 and 8 actors is covered in every
      validation mode. Circle and hexagon candidate searches discard
      out-of-polygon centers before layout/routing work and meet the shared
      performance budget for neighboring 8/4/3 groups. Every settled
      participant and token retains at least 4px from the actual polygon edge,
      including curved approximations and sloped hexagon edges.
      Engagement participants in split sections prefer one line along the
      divider axis, wrap into parallel lines when a larger group cannot fit,
      and use actor-to-actor connector chaining when direct token spokes are
      obstructed. Eight-actor coverage spans every split strategy/orientation.
- [x] An engagement creation, join, merge, or move that leaves no valid
      non-overlapping in-zone geometry is blocked in every validation mode.
- [x] A final validator independently audits all settled actor and Engagement
      token footprint pairs after packing. Negative actor/actor, actor/token,
      and token/token fixtures hard-block in OFF, ADVISORY, and STRICT;
      positive separated fixtures and multi-actor moves into a Zone containing
      an existing Engagement are accepted.
- [x] Vitest coverage verifies engagement creation, delayed intent (including
      existing groups), join, merge, multi-drag/cross-zone movement, Engage and
      selected-only Disengage actions, token selection, leave/split,
      auto-dissolution, layout/routing contracts, and exact undo/redo snapshots.

## Edges (basic graph)

- [x] GM can drag from a source Zone to a target Zone with the Edge Tool to
      create a bilateral or unilateral Edge.
- [x] A Zone pair supports one bilateral Edge and one unilateral Edge in each
      direction; dragging into an occupied slot replaces it in one history
      entry, while an identical preset only selects it.
- [x] Edge directionality is visually distinguishable with target or
      bidirectional arrowheads and cannot be edited after creation.
- [x] Edge movement rules (`blocked`, `skillCheck`, `difficult`) are
      independently settable via the toolbar and Properties Panel; an empty
      selection means unrestricted movement.
- [x] Edge visibility (`visible`, `obscured`, `hidden`) and shape (`straight`,
      `rightAngled`, `curved`, `sigmoid`) are settable and visually distinct.
      Visible has no redundant path icon; obscured uses dashed-eye, hidden uses
      eye-off, and difficult movement uses chevrons-down consistently.
      Shape is an icon radio group in the toolbar and Properties Panel using
      move-right, corner-down-right, spline, and activity respectively.
- [x] Right-angled Edge arrows are cardinal and follow the dominant direction
      of their local endpoint path segment. Orthogonally facing Zones use a
      straight shortest span unless an obstacle requires 90-degree turns.
      Routing minimizes turns before length, and an unobstructed route has at
      most one turn.
- [x] Curved Edges scale curvature with distance and follow obstacle routing;
      their concavity follows relative Zone position and initially progresses
      toward an unobstructed target.
- [x] Edge routes use derived boundary anchors, avoid Zones, update while Zones
      move, keep 12px preferred obstacle clearance, and separate same-pair
      lanes and boundary anchors. Rule badges stay around the traveled-path
      midpoint rather than overlapping a Zone. Routing geometry is not
      persisted. A target-snapped creation preview participates in pair-lane
      spacing and cannot hide behind another Edge; occupied-slot previews keep
      that slot's lane.
- [x] Valid Edge paths, arrowheads, and creation previews use readable contrast
      selected from the sampled canvas background luminance; red unroutable
      diagnostics remain red.
- [x] Rendered Edge rule icons have tooltips of at most two words, and a
      selected Edge's canvas status badge shows source, target, movement,
      visibility, tags, and notes without shape.
- [x] Edge interaction tags are Enter-created removable pills in Properties.
      Tagged Edges show a tag icon with a read-only, canvas-contrast pill
      tooltip; noted Edges show an info icon last with the note tooltip.
- [x] GM can batch-edit selected Edge rules/shape, delete selected Edges, reset
      the sticky toolbar preset, and clear all Edges through confirmation.
- [x] Deleting either connected zone auto-deletes the edge as part of the
      same Redux history entry (single undo restores both).

## Initiative tracker

- [x] Actors can be added to and reordered within an initiative list.
- [x] Advancing to the next turn updates the "current actor" indicator.
- [x] Initiative order survives undo/redo of unrelated actions (e.g. moving
      an actor between zones does not corrupt initiative order).

## Toolbar interaction system

- [x] Every tool has a visible tooltip describing its function
      (per `DESIGN.md` §5.1 mandatory tooltip requirement).
- [x] Holding any tooltip-bearing control for 500ms with a touch pointer shows
      its tooltip without activating it; mouse click-and-hold does not invoke
      the touch tooltip path.
- [ ] Switching tools does not require a global mode change — each tool's
      selection/drag/click rules are self-contained and switching tools
      never leaves stale interaction state (e.g. a half-drawn polygon)
      dangling.

## Responsive workspace

- [x] Below 1024px, every primary toolbar tool is an icon-only 44px-minimum
      target in a horizontally scrollable row and active subtools render in a
      separate horizontal bar.
- [x] Compact Zoom opens in the subtool bar without changing the active editing
      tool; desktop Zoom starts expanded and can collapse to one icon.
- [x] The compact panel launcher defaults to Library, supports tap-to-toggle
      and 500ms hold/drag/release selection in the documented wrapping order,
      and has equivalent keyboard operation.
- [x] Compact drawers close through their header, backdrop, launcher, or
      Escape, while touch drags from Library and Zoneless continue after the
      drawer closes.
- [x] Library backgrounds apply on tap without dragging; only actor assets
      support drag-to-canvas, and an actor tap uses a previously selected Zone.
- [x] The current Encounter name is visible at every width and a trimmed,
      non-empty rename is one undoable and redoable history action.
- [x] The workspace, Asset Library, panels, dialogs, and canvas remain usable
      in portrait and landscape from 320px through wide desktop widths.

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
