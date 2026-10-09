# Project Roadmap

This roadmap is derived from `DESIGN.md`, `ARCHITECTURE.md`, and
`ACCEPTANCE.md`. Work is ordered by dependency: shared state and Redux history
infrastructure must land before feature tools, and feature tools must land
before persistence and final MVP verification.

To reference completed items, see `ROADMAP_COMPLETE.md`.

After completing a numbered section (## X.), move the completed section to the end of `ROADMAP_COMPLETE.md`

## 15. MVP Acceptance Hardening

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
