## REDUX HISTORY SCHEMA (locked)

Every committed EncounterState mutation must flow through Redux history using
the serializable types in `../src/core/history/types.ts`.

Rules:

- History stores `past`, `present`, and `future` EncounterState snapshots.
  Undo restores the previous snapshot exactly; redo restores the next snapshot
  exactly.
- Each committed mutation includes a serializable action record containing
  `id`, `type`, `timestamp`, `payload`, and optional `validationResult`.
- Action records are metadata, not executable command objects. Do not store
  functions in Redux state.
- Destructive and cascading operations rely on snapshot history for exact
  undo/redo restoration. Feature-specific reducers may still prepare useful
  action payloads, but the historical truth is the stored EncounterState
  snapshot.
- Every committed mutation flows through: **Tool Handler → Interaction Engine
  → Validation Pipeline → Action Record Creation → Redux History Commit →
  Layout Recalculation → Render** (per `DESIGN.md` §5, `AGENT.md` process
  rules below). No shortcuts that bypass Redux history, even for
  "trivial" mutations — this is what makes undo/redo reliable under rapid
  interaction, per the design doc's success criteria.
- Executing a new committed action after undo truncates the redo branch
  (standard linear undo/redo, no branching history in MVP).

If you need history behavior that doesn't cleanly fit this shape, ask before
inventing a variant schema.

## PROCESS RULES (from original constraints — retained, not duplicated from documentation/DESIGN.md)

- **No simulation logic.** Represent state and relationships only. Do not
  implement RPG rules engines, dice systems, or narrative generation.
- **GM authority is absolute outside Strict mode except geometric fit.**
  Validation is advisory unless Strict mode is explicitly enabled (see
  `documentation/DESIGN.md` §5.5 for the four validation levels). The
  universal no-overlap and in-zone footprint invariant is the explicit
  exception and blocks invalid actor movement/creation in every mode.
- **Every committed mutation goes through Redux history.** No direct
  EncounterState writes may bypass the history reducer, including "internal"
  or "derived" updates like layout recalculation after a move. See
  `documentation/ARCHITECTURE.md` if more architecture information is needed.
- **Tool-driven UI, no global mode system.** Each tool in `interaction/tools/`
  owns its own selection rules, drag behavior, click behavior, and keyboard
  shortcuts. Do not introduce a global "mode" enum that tools all branch on.
- **Layout strategies are pluggable, not hardcoded.** FLEX / SEQUENTIAL /
  SPLIT_FLEX / SPLIT_SEQUENTIAL live behind a shared strategy interface in
  `core/layout/`, used by both Zones and Engagements. Adding a new strategy
  should not require touching Zone or Engagement code.
- **Engagements are groups, never pairwise.** No participant should ever be
  linked only to one other participant — membership is transitive within
  the group.
- **Edges are graph objects, not geometry.** Do not derive edge validity or
  behavior from canvas coordinates or polygon adjacency — edges are
  explicit directional relationships with their own rules
  (`documentation/DESIGN.md` §4.5).
