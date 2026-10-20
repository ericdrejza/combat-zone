# Project Roadmap

This roadmap is derived from `DESIGN.md`, `ARCHITECTURE.md`, and
`ACCEPTANCE.md`. Work is ordered by dependency: shared state and Redux history
infrastructure must land before feature tools, and feature tools must land
before persistence and final MVP verification.

To reference completed items, see `ROADMAP_COMPLETE.md`.

After completing a numbered section (## X.), move the completed section to the end of `ROADMAP_COMPLETE.md`

## 15. MVP Acceptance Hardening

- [x] Standardize Settings category, section, subsection, and row presentation;
      regroup defaults and panel presentation by purpose. Rename the category
      group Workspace, simplify card size labels, and retain category/scroll
      navigation in memory for the active session. Verify saving, history,
      category placement, accessibility, and compact/desktop layouts.

- [x] Move actor destination warnings and heal/damage dialog preferences to
      Combat, and background resize overflow and Navigation panning to Canvas.
      Verify category placement and preservation of saved preference values.

- [x] Separate Encounters from alphabetized asset tabs and add an empty Characters
      scaffold using shared explorer/card views with adding disabled. Verify tab
      restrictions, view controls, and unchanged Library/encounter state.

- [x] Cycle Library panel views through List, One column, and Two columns,
      independently of modal card sizing. Use Small/Medium/Large/Extra large
      modal size steps and reset hidden-scrollbar visual previews on asset changes.
      Verify view cycling, saved preference compatibility, and preview scroll reset.

- [x] Add the Independent Library card sizes switch with Encounter,
      Background, Character and Token, and Audio sliders; preserve shared/individual values
      across mode changes and apply the selected size in the Library modal.
      Verify preference persistence, synchronization, reset, and size selection.

- [x] Add Timer after the Audio tool asset-type choice; share the always-editable
      Audio Defaults duration threshold with Soundboard default classification.
      Verify destination filtering, metadata fallback, stale reads and undo/redo.

- [x] Add Interface Library preferences for outside-click dismissal (off),
      independent modal/panel view defaults (Grid/Two columns), and discrete modal
      card sizes (Small, Medium, Large, Extra large; initially Medium). Verify persistence, reset, synchronization,
      modal interactions, independent views, and unchanged encounter history.

- [x] Add the Library panel header launcher before the view cycle control; share toolbar
      section selection and verify desktop/compact launch, view controls,
      and absence of encounter history changes.

- [x] Add Ambience type defaults (Asset Icon, Duration threshold, Effect, Track),
      metadata classification with icon fallback, and explicit asset-type Audio
      tool choice; label Library marks as Track/Effect. Verify linked assets,
      atomic creation and undo/redo, preferences, and responsive tool controls.

- [x] Add group Play/Pause before reorder, idle group playback and first-track
      Music playback; add track Stop before Play/Pause with position preservation
      and individual resume. Group Audio Settings defaults with Music Repeat off
      and new Music group Loop on; verify preferences, creation history and playback.

- [x] Use the non-split layout for single-faction zones without Engagements;
      retain dedicated Engagement sections and verify faction-entry/departure
      history, validation, and rendering.

- [x] Fix mixed-size FLEX and same-faction SPLIT_FLEX actor entry with complete
      rendered-shape collision checks and a size-aware packing fallback; verify
      validation modes, asynchronous packing, and exact undo/redo.

- [x] Add touch-only counter swipes for deletion and targeted editing, preserving
      vertical scrolling, value controls, writer enforcement, and undo/redo.

- [x] Reveal newly created Soundboard groups; merge Actor zone triggers and add
      applied-damage and health-status triggers with independent icon toggles,
      undo/redo coverage, and local/cloud persistence round trips.

- [x] Offer confirmed reset to zero when a full clock's maximum is clicked,
      with cancellation, writer enforcement, and exact undo/redo coverage.

- [x] Add Traditional/Box clock styles, two-column mini cards, and
      an Interface default; verify history, schema 15 migration, and cloud.

- [x] Add compact Stack and Row clock styles, alphabetize style choices while
      retaining the Traditional default, and make clock-card trash icons red.
      Verify styles, history, preferences, local/cloud persistence, and card sizing.

- [x] Add clock-card pen controls opening the shared editor at the clicked clock,
      preserving draft editing, cancellation, and exact history.

- [x] Add clock-card trash controls without title layout shifts, with validated
      history and writer enforcement in Zone and Encounter scopes.

- [x] Show Encounter Status with no selected entity, reusing Zone clocks and
      counters with independent resources, schema 16 migration, validated history,
      writer guards, autosave/recovery, and local/cloud round trips.

- [x] Implement Zone Status counters, clocks, shared Edge tags/notes, and schema
      14 persistence; verify validation, writer guards, history, and cloud.

- [x] Make condition, weapon, and armor icon tooltips immediate on hover and
      focus while preserving touch-hold help.

- [x] Group Actor Status conditions into alphabetical Buffs/Debuffs subsections
      with muted headings, preserving visibility, bulk toggles and history.

- [x] Implement the Actor Status panel, optional hit points, custom counters,
      approved condition/weapon/armor controls, Combat preferences and automatic
      health; verify atomic history, schema 13 persistence and cloud round trips.

- [x] Add the Initiative browser popout and customizable I shortcut; persist
      ordinal Actor health with row status controls, dead-participant skipping,
      disabled-control explanations, and exact undo/redo coverage.
- [x] Add a durable, default-on Interface > Panels switch for strikethrough
      on dead Actor names in the Initiative panel and popout.
- [x] Implement aspect-preserving background/canvas sizing commands with
      proportional Zone scaling, safe shrink clamping, and exact history.
- [x] Implement session-only zoom-to-fit, zoom stepping, two-axis scrolling,
      focused arrow-key navigation, and toggleable right-drag panning.
- [x] Preserve zoom and the centered canvas point through canvas sizing; hide
      scrollbar chrome and expose zoom percentage/reset controls.
- [x] Verify native image drops for the Background and Actor tools, including
  Redux history undo/redo coverage.
- [ ] Create an acceptance test matrix covering every item in
  `ACCEPTANCE.md`.
- [x] Verify every state-changing action type has an undo test.
  - Zone create/delete/reshape
  - Actor move
  - Engagement create/merge/split
  - Edge create/delete
  - Initiative reorder
- [x] Verify Redux history remains exact under rapid sequential actions.
- [x] Add responsive Undo/Redo controls and configurable shortcuts, preserving
      native editing and writer safeguards; verify active-operation blocking,
      stale-result rejection, selection cleanup, and exact mixed-action replay.
- [x] Verify no direct state mutation paths bypass Redux history.
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

## Expanded keyboard commands

- [x] Directional actor movement, candidate chooser, skill-check adjudication, and destination warning.
- [x] Bulk actor size shortcuts and source-zone-first paste.
- [x] Configurable chords, conflict overrides, pan presets, zoom/Library/audio shortcuts.
- [x] Heal/damage shortcut dialog and responsive settings.

## Encounter movement strategies and grid

- [x] Zone/Grid/Free strategy cycle, shared Background/Grid controls, and suspended Zone workflows.
- [x] Square and hex Grid Layer, manual settings, and three-click alignment.
- [x] Spatial actor placement, size-dependent snapping, keyboard/group movement, and history.
- [x] Schema 17 migration, persistence/cloud round trips, writer guards, and acceptance coverage.

## Grid alignment refinements

- [x] Vertex-based simple/four-quadrant alignment, explicit standard/warp choice, and bilinear movement geometry.
- [x] Local square/hex grid detection, Waypoints alignment icon, undimmed previews, percentage opacity, visibility switch, and whole-number stepping.
- [x] Symmetry-aware rotation wrapping and five-degree calibration tolerance.
- [x] Schema 18 warp persistence, migration, validation, undo/redo, cloud, and responsive coverage.

## Grid detection reliability

- [x] Preserve faint edges, check larger-resolution matches, and cancel worker analysis without stale previews.
- [x] Detect faint square grids over illustrated terrain with normalized ridge profiles.
- [x] Temporary maximum zoom for vertex alignment, restoring on close unless manual zoom takes over.
- [x] Hold movement keys to repeat Grid/Free steps with validation, writer guards, and individual undo/redo.
- [x] Share Grid Properties/Background settings controls, persist configurable repeat timing, and keep Free nudges at 10/64 of fixed rendered spacing.
- [x] Verify fully contained first/last square rows and columns through validation and browser dragging; refine detected periods to reduce boundary drift.


- [x] Automatically complete cells touching background/original canvas, preserve alignment with bounded margins, hide fragments, and retain history/persistence safeguards.

## Independent background sizing

- [x] Decouple all background sizing from grid/token scale and spatial placements; use unpadded coverage and an Interface overflow preference, with history and writer safeguards.

## Shared map sizing and stable actor footprints

- [x] Actor footprints stay identical across Zone/Grid/Free, tools, map sizing, and warped cells.
- [x] Cell-size edits resize coverage inversely with fixed 64-unit rendered spacing; background controls update the same scale value.
- [x] Detection/alignment normalize map coverage and preserve fitted geometry; previews cancel without durable mutations.
- [x] Grid settings remains inside the Grid subtool button group, matching Background on compact and desktop layouts.
- [x] Schema 21 preserves legacy map alignment and validates local/cloud round trips, history, overflow, and writer boundaries.


## Independent Zone/Grid rules

- [x] Separate Zone/Grid tools and independent actor/Zone snapping rules.
- [x] Reconcile existing Zone vertices before grid alignment fit checks, retaining invalid-geometry rejection and undo/redo.
- [x] Snap interactable polygon/rectangle corners and hexagon/circle bounding resize controls, retaining outline samples with rotated/warped grid and undo/redo coverage.
- [x] Merge consecutive coincident Polygon vertices during snapping with atomic undo/redo and invalid-geometry validation.
- [x] Grid-aware Zone packing, occupancy adjustments, and unlocked relationships.
- [x] Canvas defaults, membership policies, and ordered choice dialogs.
- [x] Cell Tracer with whole-segment removal and invalid-route policies.
- [x] Hex token Trim and complete history/persistence/validation coverage.
- [x] Grid appearance blur commits, collapsible Zone color fields, rigid snapped Zone moves, full-cell occupancy, and tracer closing previews.
- [x] Zone drops settle with the Actor movement spring, retaining the drop frame during validation and respecting reduced motion.
- [x] Hide the Zoneless panel during Zone drawing and support validated double-click polygon vertex edits with screen-based spacing.
- [x] Fade the Zoneless panel during Zone drawing, moving, and resizing while preserving panel state and respecting reduced motion.

Implementation plan: [Zone/Grid rules](plans/zone_grid_rules.md).

## 2:1 isometric grids

- [x] Projected Square topology, reservations, Zone interactions, rendering, alignment, and detection.
- [x] Browser-local token projection with upright names and unchanged logical placement.
- [x] Schema 23 migrations and synchronized local/Firebase validation.
- [x] Fractional rotation controls with accelerated holds and hundredth precision.

Implementation plan: [Isometric grids](plans/isometric_grid.md).

- [x] Navigate directly to each required quadrant during complex alignment, including the initial top-left corner, without changing zoom or encounter history.

- [x] Configurable 1–45° isometric angle, automatic angle detection, and schema 24 migration preserving prior geometry.

- [x] Transparent Actor shape uses SquareDashed controls with tooltips, keeps aspect-preserving unframed artwork and square placement, and supports history and schema 25 persistence.
- [x] Projected Actor names follow token size, angle, and rotation with a constant gap.
- [x] Manual grid rotation accepts a full turn and wraps 360° to 0° while retaining hundredth precision and fractional-to-whole held steps.

- [x] Actor Properties header mirrors the selected image with SquareCenterlineDashedHorizontal, tooltip and toggle feedback, preserving upright labels, placement, history, and local/cloud persistence.

## Zone Properties conversion and color controls (#85, #39)

- [x] Add manual shape conversion using current bounds, validated reshaping,
      first-selected-Zone semantics, and atomic shape/outline undo/redo.
- [x] Apply colors immediately to selected Zones when activating the paintbrush,
      retaining existing painting and export-all behavior with atomic history.
- [x] Keep Show border inline and place Match border color below its picker.
- [x] Add separate Canvas Actor/Zone selection outline modes and thickness
      preferences with persistence, cross-tab synchronization, reset, and
      reduced-motion coverage; expose Polygon editing help for keyboard/touch.

## Zone rotation

- [x] Rotate all Zone shapes using a stem/RotateCcw handle, signed degree labels,
      oriented resize/conversion, locked Actor previews and packing, vertex
      snapping, validated history, and schema 27 persistence.

- [x] Keep rotation controls attached during Zone dragging and preserve generated
      shapes when snapping to rotated, warped, hex, or isometric grids.
- [x] Jointly snap all four generated-shape bounds controls and every Polygon
      vertex, allowing size adjustment; synchronize rotation-control settling.

- [x] Settle rotated generated shapes onto nearby grid rectangles, allowing angle
      and independent width/height changes; persist and display the snapped angle.

Implementation plan: [Zone rotation](plans/zone_rotation.md).

## Ruler and grid styles (#26)

- [x] Solid, dashed, dotted and crosshair grid styles.
- [x] Ruler shapes, cell highlighting and independent map measurement scale.
- [x] Actor movement previews, advisory limits and optional turn/round accounting.
- [x] Schema 28 local/cloud persistence, history and acceptance verification.

Implementation plan: [Ruler, movement and grid styles](plans/ruler_movement_and_grid_styles.md).

- [x] Ruler interaction refinements: icon subtools, automatic three-corner highlighting, editable locked artifacts, Shift pivots, movement range glow and ruler color preferences.

- [x] Ruler polish: no drop-boundary flash, automatic outward cone origins, corner-or-center AoE inclusion, optional area values, bounded labels, angle editing and D/number shortcuts; R supports Zone rename.

- [x] Persist locked ruler artifacts in schema 29 with standard undo/redo, one-step edit locking, cancel/restore and fresh-history reload recovery.
- [x] State-aware ruler hints, endpoint pickup, Path defaults and clicked-waypoint-only locking; Canvas Ruler feel preference and white cursor preview.
- [x] Place through existing ruler artifacts, preserving idle context actions and suppressing artifact menus during creation/editing.

- [x] Canvas measurement cell-coverage preferences: corners-or-center, center only, strict majority area, and one/all forward cone-origin neighbor exceptions; square/isometric use 3 corners and hex uses 4.

- [x] Artifact color dialog uses a collapsible custom picker, Cancel/Save with deferred one-step history, and exact alpha support; ruler right-click backtracks one placed point during creation/editing.

- [x] Prevent original-position flashes on actor drop: retain the true pointer endpoint through validation and snap settling, including Strict Mode and existing return/cross-zone motion behavior.
