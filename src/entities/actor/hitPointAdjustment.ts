import type { Actor } from "./types";
import type { CombatRules } from "./actorResources";

/** Both HP entry points share eligibility and bound explanations. */
export function getHitPointAdjustment(actors: Actor[], amount: string, disabled: boolean, rules: CombatRules) {
  const eligible = actors.filter((actor) => actor.hitPoints);
  const skipped = actors.filter((actor) => !actor.hitPoints);
  const validAmount = amount.trim() !== "" && Number.isSafeInteger(Number(amount)) && Number(amount) > 0;
  const reason = disabled ? "Read-only encounter" : !eligible.length ? "Configure hit points for a selected actor first" : !validAmount ? "Enter a positive whole-number amount" : "";
  function disabledReason(sign: number): string {
    if (reason) return reason;
    if (sign < 0 && rules.limits === "bounded" && eligible.every((actor) => actor.hitPoints!.current <= 0)) return "All selected actors with hit points are at or below the minimum (0)";
    if (sign > 0 && rules.limits !== "unbounded" && eligible.every((actor) => actor.hitPoints!.current >= actor.hitPoints!.maximum)) return "All selected actors with hit points are at or above their maximum";
    return "";
  }
  return { eligible, skipped, disabledReason };
}
