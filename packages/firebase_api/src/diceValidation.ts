import { ApiContractValidationError } from "./errors.js";

type Obj = Record<string, unknown>;
const obj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === "string" && !!v.trim();
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const fail = (): never => { throw new ApiContractValidationError("Dice, Rollables, or application records are invalid."); };
function collection(v: unknown): Obj[] {
  if (!obj(v) || !obj(v.byId) || !Array.isArray(v.allIds) || v.allIds.some(id => !text(id)) || new Set(v.allIds).size !== v.allIds.length || Object.keys(v.byId).length !== v.allIds.length) return fail();
  return v.allIds.map(id => { const entry = (v.byId as Obj)[id as string]; if (!obj(entry) || entry.id !== id) return fail(); return entry; });
}
export function validRollable(v: unknown): boolean {
  return obj(v) && text(v.id) && text(v.name) && typeof v.checkFormula === "string" && text(v.effectFormula) &&
    ["shared", "perTarget", "ask"].includes(v.checkRollMode as string) && ["damage", "healing", "none"].includes(v.effectKind as string) && (v.audioGroupId === null || text(v.audioGroupId));
}
/** Older saved check-only definitions remain accepted only at their versioned boundary. */
function validStoredRollable(value: unknown, legacy: boolean, version: number): boolean {
  if (version < 37 && obj(value) && value.checkRollMode === undefined) value = { ...value, checkRollMode: "shared" };
  return validRollable(value) || legacy && obj(value) && typeof value.effectFormula === "string" && !value.effectFormula.trim() && text(value.checkFormula) &&
    validRollable({ ...value, effectFormula: value.checkFormula });
}
export function validateDiceMessages(value: unknown, legacy = false, version = 37): void {
  let budget = 500000;
  function node(v: unknown, depth = 0): void {
    if (--budget < 0 || depth > 64 || !obj(v) || !text(v.type) || !finite(v.value) || typeof v.valid !== "boolean") return fail();
    if (v.face !== undefined && !finite(v.face)) return fail();
    if (v.sides !== undefined && (!Number.isSafeInteger(v.sides) || (v.sides as number) <= 0)) return fail();
    for (const flag of ["dropped", "exploded", "rerolled", "matched", "capped"]) if (v[flag] !== undefined && typeof v[flag] !== "boolean") return fail();
    if (v.critical !== undefined && !["success", "failure"].includes(v.critical as string)) return fail();
    if (v.label !== undefined && typeof v.label !== "string") return fail();
    if (v.operators !== undefined && (!Array.isArray(v.operators) || v.operators.some(op => typeof op !== "string"))) return fail();
    if (v.parameters !== undefined) { if (!obj(v.parameters)) return fail(); for (const p of Object.values(v.parameters)) node(p, depth + 1); }
    if (v.children !== undefined) { if (!Array.isArray(v.children)) return fail(); v.children.forEach(child => node(child, depth + 1)); }
  }
  for (const message of collection(value)) {
    if (!text(message.message) || !finite(message.timestamp) || !obj(message.sender) || !text(message.sender.id) || !text(message.sender.name) ||
      !(message.sender.color === null || typeof message.sender.color === "string" && /^#[0-9a-f]{6}$/i.test(message.sender.color))) return fail();
    if (message.references !== undefined) {
      if (!Array.isArray(message.references)) return fail();
      let previousEnd = 0;
      for (const reference of message.references) {
        if (!obj(reference) || !Number.isSafeInteger(reference.start) || !Number.isSafeInteger(reference.end) ||
          (reference.start as number) < previousEnd || (reference.end as number) <= (reference.start as number) ||
          (reference.end as number) > (message.message as string).length || !text(reference.entityId) ||
          !["actor", "zone"].includes(reference.kind as string) || !(reference.color === null || typeof reference.color === "string" && /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(reference.color))) return fail();
        previousEnd = reference.end as number;
      }
    }
    if (message.rolls !== undefined) {
      if (!Array.isArray(message.rolls) || message.rolls.length > 22) return fail();
      const ids = new Set();
      for (const roll of message.rolls) {
        if (!obj(roll) || !text(roll.id) || ids.has(roll.id) || !text(roll.formula) || !["sum", "successes", "matches"].includes(roll.outcome as string) || typeof roll.capped !== "boolean" || roll.role !== undefined && !["check", "effect"].includes(roll.role as string)) return fail();
        if (roll.presentationNote !== undefined && typeof roll.presentationNote !== "string") return fail();
        if (roll.auxiliary !== undefined) { if (!Array.isArray(roll.auxiliary)) return fail(); roll.auxiliary.forEach(value => node(value)); }
        ids.add(roll.id); node(roll.node);
      }
    }
    if (message.invocation !== undefined) {
      const i = message.invocation;
      if (!obj(i) || !text(i.actorId) || typeof i.actorName !== "string" || !validStoredRollable(i.rollable, legacy, version) || !["pending", "resolved"].includes(i.phase as string) || !Array.isArray(i.targets) || !obj(i.decisions)) return fail();
      if (version >= 37 && !["shared", "perTarget"].includes(i.checkRollMode as string)) return fail();
      const ids = i.targets.map(t => { if (!obj(t) || !text(t.id) || typeof t.name !== "string") return fail(); return t.id; });
      if (new Set(ids).size !== ids.length || Object.entries(i.decisions).some(([id, v]) => ![...ids, "untargeted"].includes(id) || !["hit", "miss"].includes(v as string))) return fail();
    }
    const checks = Array.isArray(message.rolls) ? message.rolls.filter(roll => obj(roll) && roll.role === "check") as Obj[] : [];
    const invocation = obj(message.invocation) ? message.invocation : undefined;
    if (invocation?.checkRollMode === "perTarget") {
      const targets = invocation.targets as Obj[];
      if (targets.length < 2 || targets.length > 20 || checks.length !== targets.length || new Set(checks.map(roll => roll.targetId)).size !== checks.length || checks.some(roll => !targets.some(target => target.id === roll.targetId))) return fail();
    } else if (checks.some(roll => roll.targetId !== undefined)) return fail();
    if (Array.isArray(message.rolls) && message.rolls.some(roll => obj(roll) && roll.targetId !== undefined && (roll.role !== "check" || !text(roll.targetId)))) return fail();
  }
}
export function validateDiceState(state: Obj, legacy = false, version = 37): void {
  validateDiceMessages(state.chatMessages, legacy, version);
  const groups = obj(state.audioCueGroups) && obj(state.audioCueGroups.byId) ? state.audioCueGroups.byId : {};
  if (!obj(state.actors) || !obj(state.actors.byId)) return fail();
  for (const actor of Object.values(state.actors.byId)) {
    if (!obj(actor)) return fail();
    if (actor.rollables !== undefined) for (const rollable of collection(actor.rollables)) {
      if (!validStoredRollable(rollable, legacy, version)) return fail();
      if (rollable.audioGroupId !== null && (!obj(groups[rollable.audioGroupId as string]) || (groups[rollable.audioGroupId as string] as Obj).section !== "actor")) return fail();
    }
  }
  for (const application of collection(state.rollApplications)) if (!text(application.resultId) || !text(application.actorId) || !["damage", "healing"].includes(application.kind as string) || !Number.isSafeInteger(application.amount) || (application.amount as number) <= 0) return fail();
}
