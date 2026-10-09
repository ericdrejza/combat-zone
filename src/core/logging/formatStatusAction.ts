import type { EncounterState } from "@core/encounter/types";
import type { EncounterActionRecord } from "@core/history/types";

/** Describes short-term actor edits without exposing internal command names. */
export function formatStatusAction(action: EncounterActionRecord, snapshots: { before: EncounterState; after: EncounterState }): string | undefined {
  if (action.type.startsWith("zone.") || action.type.startsWith("encounter.")) {
    const id = String(action.payload.zoneId);
    const name = action.type.startsWith("encounter.") ? snapshots.after.name : snapshots.after.zones.byId[id]?.name ?? snapshots.before.zones.byId[id]?.name ?? id;
    const labels: Record<string, string> = { saveCounter: "Saved a counter", adjustCounter: "Adjusted a counter", editCounters: "Updated counters", saveClock: "Saved a clock", adjustClock: "Adjusted a clock", editClocks: "Updated clocks", setTags: "Updated tags", setNotes: "Updated notes" };
    const label = labels[action.type.split(".")[1]];
    if (label) return `${label} for ${name}.`;
  }
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
