import { useEffect, useRef, useState } from "react";
import { validThresholds, type CombatRules } from "@entities/actor/actorResources";
import { recalculateHealthStatuses } from "@entities/actor/statusMutations";
import { useCombatPreferences } from "@ui/combat_preferences/CombatPreferenceProvider";
import { useStatusActions } from "@ui/status/useStatusActions";
import { StatusVisibilitySettings } from "./StatusVisibilitySettings";
import { HealthThresholdField } from "./HealthThresholdField";
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
    const saved = next;
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
      <PreferenceSwitch title="Recalculate health when hit points or cutoffs change" checked={draft.automaticHealth} label="Automatically update health status" onChange={(automaticHealth) => save({ ...rules, automaticHealth })} />
      {draft.automaticHealth ? <>
      <p className="text-sm text-canvas-muted">Set upper cutoffs for the statuses you want to automate. Leave a cutoff blank to control that status manually. Equal cutoffs use the most severe status.</p>
      <label className="block text-sm">Threshold units<select aria-label="Threshold units" className="ml-3 rounded border border-canvas-line bg-canvas p-2" value={draft.unit} onChange={(event) => save({ ...draft, unit: event.currentTarget.value as CombatRules["unit"] })}><option value="fixed">Fixed hit points</option><option value="percent">Percentage of maximum</option></select></label>
      {["Dead", "Unconscious / severely injured", "Injured"].map((label, index) => <HealthThresholdField key={label} label={label} value={draft.thresholds[index]} unit={draft.unit} onChange={(value) => {
        const thresholds = [...draft.thresholds] as CombatRules["thresholds"];
        thresholds[index] = value;
        setDraft({ ...draft, thresholds });
      }} onCommit={(value) => {
        const thresholds = [...draft.thresholds] as CombatRules["thresholds"];
        thresholds[index] = value;
        save({ ...draft, thresholds });
      }} onBlur={() => save(draft)} />)}
      {!valid ? <p role="alert" className="text-xs text-red-600 dark:text-red-500">Configured cutoffs must be ordered whole numbers (Dead ≤ Unconscious ≤ Injured){draft.unit === "percent" ? " from 0 to 100" : ""}. Changes will save when corrected.</p> : null}
      </> : null}
    </fieldset>
    <StatusVisibilitySettings value={visibility} onChange={(next) => saveRules(rules, next)} />
    <p className="text-sm text-canvas-muted">Settings save automatically. Cutoffs save when you leave the field. Automatic health changes update the current encounter and can be undone.</p>
  </section>;
}
