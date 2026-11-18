import type { EncounterState } from "@core/encounter/types";
import type { Rollable, RollApplication } from "@core/dice/types";
import { parseDiceFormula } from "@core/dice/parser";
import { validRollable } from "@combat-zone/firebase-api";
import { adjustHitPoints } from "./statusMutations";
import type { CombatRules } from "./actorResources";

export function saveRollables(state: EncounterState, actorId: string, entries: Rollable[]): EncounterState {
  const actor = state.actors.byId[actorId];
  if (!actor) return state;
  if (new Set(entries.map(r => r.id)).size !== entries.length || entries.some(r => !validRollable(r))) throw new Error("Rollables require a name and an effect roll.");
  for (const r of entries) {
    if (r.checkFormula) parseDiceFormula(r.checkFormula);
    parseDiceFormula(r.effectFormula);
    if (r.audioGroupId && state.audioCueGroups.byId[r.audioGroupId]?.section !== "actor") throw new Error("Choose an Actor audio group.");
  }
  const rollables = { allIds: entries.map(r => r.id), byId: Object.fromEntries(entries.map(r => [r.id, r])) };
  if (JSON.stringify(actor.rollables ?? { allIds: [], byId: {} }) === JSON.stringify(rollables)) return state;
  return { ...state, actors: { ...state.actors, byId: { ...state.actors.byId, [actorId]: { ...actor, rollables } } } };
}

/** HP and receipts share one snapshot, so undo cannot leave an already-applied marker behind. */
export function applyRollResult(state: EncounterState, applications: RollApplication[], rules: CombatRules): EncounterState {
  let next = state;
  for (const receipt of applications) {
    if (state.rollApplications.byId[receipt.id]) continue;
    if (!Number.isSafeInteger(receipt.amount) || receipt.amount <= 0) throw new Error("Enter a positive whole-number amount.");
    if (!state.actors.byId[receipt.actorId]?.hitPoints) continue;
    next = adjustHitPoints(next, [receipt.actorId], receipt.kind === "damage" ? -receipt.amount : receipt.amount, rules);
    if (next.actors.byId[receipt.actorId].hitPoints?.current === state.actors.byId[receipt.actorId].hitPoints?.current) continue;
    next = { ...next, rollApplications: { byId: { ...next.rollApplications.byId, [receipt.id]: receipt }, allIds: [...next.rollApplications.allIds, receipt.id] } };
  }
  return next;
}
