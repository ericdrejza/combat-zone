import { useEffect, useRef, useState } from "react";
import { validThresholds, type CombatRules } from "@entities/actor/actorResources";
import { recalculateHealthStatuses } from "@entities/actor/statusMutations";
import { useCombatPreferences } from "@ui/combat_preferences/CombatPreferenceProvider";
import { useStatusActions } from "@ui/status/useStatusActions";
import { StatusVisibilitySettings } from "./StatusVisibilitySettings";
import { PreferenceSwitch } from "./PreferenceSwitch";

export function CombatSettings() {
  const { rules, visibility, saveRules } = useCombatPreferences();
  const generation = useRef(0);
  const commit = useStatusActions();
  const [draft, setDraft] = useState(rules);
  useEffect(() => setDraft(rules), [rules]);
  const configured = validThresholds(draft);
  const valid = draft.thresholds.every((value) => value === null) || configured;
  function save(next: CombatRules) {
    setDraft(next);
    if (!validThresholds(next) && next.thresholds.some((value) => value !== null)) return;
    const firstThreshold = rules.thresholds.every((value) => value === null) && validThresholds(next);
    const saved = { ...next, automaticHealth: (next.automaticHealth || firstThreshold) && validThresholds(next) };
    saveRules(saved);
    if (!saved.automaticHealth) generation.current += 1;
    if (saved.automaticHealth && (!rules.automaticHealth || saved.unit !== rules.unit || JSON.stringify(saved.thresholds) !== JSON.stringify(rules.thresholds))) {
      const revision = ++generation.current;
      void commit("actor.recalculateHealth", { rules: saved }, (state) => recalculateHealthStatuses(state, saved), () => generation.current === revision);
    }
  }
  return <section aria-labelledby="settings-combat-heading" className="space-y-5 p-5">
    <h3 id="settings-combat-heading" className="font-display text-lg font-semibold">Combat</h3>
    <label className="block text-sm font-semibold">Hit point limits
      <select aria-label="Hit point limits" className="mt-2 w-full rounded-xl border border-canvas-line bg-canvas p-2 font-normal" value={draft.limits} onChange={(event) => save({ ...draft, limits: event.currentTarget.value as CombatRules["limits"] })}>
        <option value="bounded">Clamp at zero and maximum</option><option value="negative">Allow negative; cap healing at maximum</option><option value="unbounded">Allow negative and above maximum</option>
      </select>
    </label>
    <fieldset className="space-y-3 border-t border-canvas-line pt-4">
      <legend className="pr-3 text-sm font-semibold">Automatic health status</legend>
      <p className="text-sm text-canvas-muted">Set upper cutoffs for the statuses you want to automate. Leave a cutoff blank to control that status manually. Equal cutoffs use the most severe status.</p>
      <label className="block text-sm">Threshold units<select aria-label="Threshold units" className="ml-3 rounded border border-canvas-line bg-canvas p-2" value={draft.unit} onChange={(event) => save({ ...draft, unit: event.currentTarget.value as CombatRules["unit"] })}><option value="fixed">Fixed hit points</option><option value="percent">Percentage of maximum</option></select></label>
      {["Dead", "Unconscious / severely injured", "Injured"].map((label, index) => <label className="flex items-center justify-between gap-3 text-sm" key={label}>{label}<input aria-label={`${label} upper cutoff`} className="w-24 rounded border border-canvas-line bg-canvas p-2" type="number" step="1" min={draft.unit === "percent" ? 0 : undefined} max={draft.unit === "percent" ? 100 : undefined} value={draft.thresholds[index] ?? ""} onChange={(event) => {
        const thresholds = [...draft.thresholds] as CombatRules["thresholds"];
        thresholds[index] = event.currentTarget.value === "" ? null : Number(event.currentTarget.value);
        setDraft({ ...draft, thresholds });
      }} onBlur={() => save(draft)} /></label>)}
      {!valid ? <p role="alert" className="text-xs text-canvas-muted">Configured cutoffs must be ordered whole numbers (Dead ≤ Unconscious ≤ Injured){draft.unit === "percent" ? " from 0 to 100" : ""}. Changes will save when corrected.</p> : null}
      <PreferenceSwitch disabled={!configured} title={!configured ? "Set at least one valid cutoff first" : "Recalculate health when hit points or cutoffs change"} checked={draft.automaticHealth && configured} label="Automatically update health status" onChange={(automaticHealth) => save({ ...draft, automaticHealth })} />
    </fieldset>
    <StatusVisibilitySettings value={visibility} onChange={(next) => saveRules(rules, next)} />
    <p className="text-sm text-canvas-muted">Settings save automatically. Cutoffs save when you leave the field. Automatic health changes update the current encounter and can be undone.</p>
  </section>;
}
