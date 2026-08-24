# Project Roadmap

This roadmap is derived from `DESIGN.md`, `ARCHITECTURE.md`, and
`ACCEPTANCE.md`. Work is ordered by dependency: shared state and Redux history
infrastructure must land before feature tools, and feature tools must land
before persistence and final MVP verification.

To reference completed items, see `ROADMAP_COMPLETE.md`.

After completing a numbered section (## X.), move the completed section to the end of `ROADMAP_COMPLETE.md`

## 15. MVP Acceptance Hardening

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
