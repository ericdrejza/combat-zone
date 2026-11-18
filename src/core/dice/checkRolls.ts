import type { CheckRollMode, DiceResult, RollInvocation } from "./types";

/** Targets are already deduplicated by reference resolution before applying this limit. */
export function checkRollSetup(invocation: RollInvocation, choice?: CheckRollMode) {
  const hasCheck = !!invocation.rollable.checkFormula;
  const mode: CheckRollMode = hasCheck && invocation.targets.length > 1
    ? choice ?? (invocation.rollable.checkRollMode === "perTarget" ? "perTarget" : "shared") : "shared";
  if (mode === "perTarget" && invocation.targets.length > 20) throw new Error("Per-target checks support at most 20 targets. Reduce targets or choose one check for all targets.");
  const formula = invocation.rollable.checkFormula || invocation.rollable.effectFormula;
  return { mode, formulas: Array.from({ length: mode === "perTarget" ? invocation.targets.length : 1 }, () => formula) };
}

/** A shared check summarizes decisions; independent checks report only their saved target. */
export function checkOutcome(invocation: RollInvocation | undefined, result: DiceResult): string | undefined {
  if (result.role !== "check" || !invocation || invocation.phase !== "resolved") return;
  const decisions = result.targetId ? [invocation.decisions[result.targetId]]
    : (invocation.targets.length ? invocation.targets.map(target => invocation.decisions[target.id]) : [invocation.decisions.untargeted]);
  if (!decisions.length || decisions.some(value => !value)) return;
  return decisions.every(value => value === "hit") ? "Success" : decisions.every(value => value === "miss") ? "Failure" : "Mixed";
}
