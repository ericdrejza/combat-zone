type RecordValue = Record<string, unknown>;
const record = (value: unknown): value is RecordValue => !!value && typeof value === "object" && !Array.isArray(value);

/** Check-only definitions previously produced one non-applicable roll; preserve that behavior. */
export function migrateRollableEffects(state: RecordValue): void {
  function upgrade(value: unknown) {
    if (!record(value) || typeof value.effectFormula !== "string" || value.effectFormula.trim() ||
      typeof value.checkFormula !== "string" || !value.checkFormula.trim()) return;
    value.effectFormula = value.checkFormula;
    value.checkFormula = "";
    value.effectKind = "none";
  }
  if (record(state.actors) && record(state.actors.byId)) {
    for (const actor of Object.values(state.actors.byId)) {
      if (!record(actor) || !record(actor.rollables) || !record(actor.rollables.byId)) continue;
      Object.values(actor.rollables.byId).forEach(upgrade);
    }
  }
  // Historical sender/target/result snapshots stay intact; adapting their definition
  // makes the new shape valid without making old check results applicable.
  if (record(state.chatMessages) && record(state.chatMessages.byId)) {
    for (const message of Object.values(state.chatMessages.byId)) {
      if (record(message) && record(message.invocation)) upgrade(message.invocation.rollable);
    }
  }
}
