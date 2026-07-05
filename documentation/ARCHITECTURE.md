## COMMAND OBJECT SCHEMA (locked)

Every state mutation in the system must be expressed as a command matching
the interface in `../src/core/commands/types.ts`

Rules:

- `inversePayload` is captured **before** `do()` runs, not derived after —
  this guarantees undo correctness even for destructive operations (e.g.
  deleting a Zone must snapshot the zone + its actors' prior state before
  removal).
- `do` and `undo` must be pure — no side effects, no direct mutation of
  passed-in state. This keeps Redux Toolkit's Immer-based updates and time
  travel debugging reliable.
- Every command flows through: **Tool Handler → Interaction Engine →
  Validation Pipeline → Command Creation → History Store → State Update →
  Layout Recalculation → Render** (per `DESIGN.md` §5, `AGENT.md` process
  rules below). No shortcuts that bypass the History Store, even for
  "trivial" mutations — this is what makes undo/redo reliable under rapid
  interaction, per the design doc's success criteria.
- The History Store holds an ordered list of executed `Command` objects plus
  a cursor; undo moves the cursor back and calls `undo()`, redo moves it
  forward and calls `do()`. Executing a new command while the cursor isn't
  at the end truncates the redo branch (standard linear undo/redo, no
  branching history in MVP).

If you need a command that doesn't cleanly fit this shape, ask before
inventing a variant schema.

## PROCESS RULES (from original constraints — retained, not duplicated from documentation/DESIGN.md)

- **No simulation logic.** Represent state and relationships only. Do not
  implement RPG rules engines, dice systems, or narrative generation.
- **GM authority is absolute outside Strict mode.** Validation is advisory
  unless Strict mode is explicitly enabled (see `documentation/DESIGN.md` §5.5 
  for the four validation levels). Never block a GM action in non-Strict modes.
- **Every mutation is a Command.** No direct state writes anywhere in the
  codebase, including "internal" or "derived" updates like layout
  recalculation after a move — if it changes `EncounterState`, it's a
  Command.  See `documentation/ARCHITECTURE.md` if more architecture information
  is needed.
- **Tool-driven UI, no global mode system.** Each tool in `interaction/tools/`
  owns its own selection rules, drag behavior, click behavior, and keyboard
  shortcuts. Do not introduce a global "mode" enum that tools all branch on.
- **Layout strategies are pluggable, not hardcoded.** FLEX / SEQUENTIAL /
  SPLIT_SEQUENTIAL live behind a shared strategy interface in
  `core/layout/`, used by both Zones and Engagements. Adding a new strategy
  should not require touching Zone or Engagement code.
- **Engagements are groups, never pairwise.** No participant should ever be
  linked only to one other participant — membership is transitive within
  the group.
- **Edges are graph objects, not geometry.** Do not derive edge validity or
  behavior from canvas coordinates or polygon adjacency — edges are
  explicit directional relationships with their own rules
  (`documentation/DESIGN.md` §4.5).