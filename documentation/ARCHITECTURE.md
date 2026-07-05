## COMMAND OBJECT SCHEMA (locked)

Every state mutation in the system must be expressed as a command matching
this shape:

```typescript
interface Command<TPayload = unknown> {
  id: string; // uuid, generated at creation
  type: string; // e.g. "ACTOR_MOVE", "ZONE_CREATE", "ENGAGEMENT_MERGE"
  timestamp: number; // Date.now() at creation
  payload: TPayload; // data needed to apply the command
  inversePayload: TPayload; // data needed to undo the command (captured BEFORE apply)
  do(state: EncounterState): EncounterState; // pure function, returns new state
  undo(state: EncounterState): EncounterState; // pure function, returns new state
  validationResult?: ValidationResult; // attached by the validation pipeline before execution
}
```

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