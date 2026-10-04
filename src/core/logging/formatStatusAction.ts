import type { EncounterState } from "@core/encounter/types";
import type { EncounterActionRecord } from "@core/history/types";

/** Describes short-term actor edits without exposing internal command names. */
export function formatStatusAction(action: EncounterActionRecord, snapshots: { before: EncounterState; after: EncounterState }): string | undefined {
  const ids = Array.isArray(action.payload.actorIds) ? action.payload.actorIds.filter((id): id is string => typeof id === "string") :
    typeof action.payload.actorId === "string" ? [action.payload.actorId] : [];
  const names = ids.map((id) => snapshots.after.actors.byId[id]?.name ?? snapshots.before.actors.byId[id]?.name ?? id).join(", ");
  switch (action.type) {
    case "actor.setStatus": {
      const labels = ["dead", "unconscious / severely injured", "injured", "healthy"];
      return `Set ${names} health to ${labels[Number(action.payload.status)] ?? "unknown"}.`;
    }
    case "actor.adjustHitPoints": {
      const amount = Number(action.payload.amount);
      return `${amount < 0 ? "Applied damage" : "Applied healing"} (${Math.abs(amount)}) to ${names}.`;
    }
    case "actor.setHitPoints": return `Updated hit points for ${names}.`;
    case "actor.editCounters": return `Updated counters for ${names}.`;
    case "actor.saveCounter": return `Saved a counter for ${names}.`;
    case "actor.adjustCounter": return `Adjusted a counter for ${names}.`;
    case "actor.removeCounter": return `Removed a counter from ${names}.`;
    case "actor.removeCondition": return `Removed ${String(action.payload.condition)} from ${names}.`;
    case "actor.toggleCondition": return `Updated conditions for ${names}.`;
    case "actor.toggleWeapon": return `Updated weapons for ${names}.`;
    case "actor.toggleArmor": return `Updated armor for ${names}.`;
    case "actor.recalculateHealth": return "Recalculated actor health from combat thresholds.";
    case "actor.applyCombatRules": return "Applied combat rules to the current encounter.";
    default: return undefined;
  }
}
