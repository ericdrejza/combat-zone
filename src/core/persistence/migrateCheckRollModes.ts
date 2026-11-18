type RecordValue = Record<string, unknown>;
const record = (value: unknown): value is RecordValue => !!value && typeof value === "object" && !Array.isArray(value);

/** Existing rolls used one check for the entire invocation; preserve saved outcomes. */
export function migrateCheckRollModes(state: RecordValue): void {
  if (record(state.actors) && record(state.actors.byId)) {
    for (const actor of Object.values(state.actors.byId)) {
      if (!record(actor) || !record(actor.rollables) || !record(actor.rollables.byId)) continue;
      for (const rollable of Object.values(actor.rollables.byId)) if (record(rollable)) rollable.checkRollMode = "shared";
    }
  }
  if (record(state.chatMessages) && record(state.chatMessages.byId)) {
    for (const message of Object.values(state.chatMessages.byId)) {
      if (!record(message) || !record(message.invocation)) continue;
      message.invocation.checkRollMode = "shared";
      if (record(message.invocation.rollable)) message.invocation.rollable.checkRollMode = "shared";
    }
  }
}
