/*
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
*/
