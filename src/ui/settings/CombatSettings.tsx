import { useMovementPreferences } from '@ui/combat_preferences/useMovementPreferences';
import { DEFAULT_MOVEMENT_PREFERENCES } from '@core/measurement/types';
import { MovementMeasurementSettings } from './MovementMeasurementSettings';
import { ResetSettingsButton } from "./ResetSettingsButton";
import { useResetSettingsCategory } from "./useResetSettingsCategory";
import { useEffect, useId, useRef, useState } from "react";
import { validThresholds, type CombatRules } from "@entities/actor/actorResources";
import { recalculateHealthStatuses } from "@entities/actor/statusMutations";
import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { useCombatPreferences } from "@ui/combat_preferences/CombatPreferenceProvider";
import { useStatusActions } from "@ui/status/useStatusActions";
import { SettingsCategory, SettingsSection, SettingsSubsection, SettingsField, SETTINGS_CONTROL } from "./SettingsLayout";
import { HealthThresholdField } from "./HealthThresholdField";
import { MovementRepeatSettings } from "./MovementRepeatSettings";
import { PreferenceSwitch } from "./PreferenceSwitch";

export function CombatSettings() {
  const movement = useMovementPreferences();
  const resetCategory = useResetSettingsCategory("combat");
  const { rules, saveRules } = useCombatPreferences();
  const {
    warnActorDestinationsDiffer, setWarnActorDestinationsDiffer,
    keepHealDamageDialogOpen, setKeepHealDamageDialogOpen,
    healthCounterName, setHealthCounterName
  } = useInterfacePreferences();
  const cutoffHelpId = useId();
  const cutoffErrorId = useId();
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
  return <SettingsCategory actions={<ResetSettingsButton category="Combat" onReset={() => { generation.current += 1; resetCategory(); void movement.save({ ...DEFAULT_MOVEMENT_PREFERENCES }); }} />} title="Combat" description="Movement decisions, health behavior, and automatic health status.">
    <SettingsSection title="Movement">
    <PreferenceSwitch checked={warnActorDestinationsDiffer} label="Warn when actor destinations differ" onChange={setWarnActorDestinationsDiffer} />
    <MovementRepeatSettings />
    <MovementMeasurementSettings />
    </SettingsSection>
    <SettingsSection title="Health">
    <SettingsField label="Health counter name" description="Saves when you leave the field. A blank name restores Hit points.">
      <input aria-label="Health counter name" className={SETTINGS_CONTROL} defaultValue={healthCounterName} key={healthCounterName} onBlur={(event) => setHealthCounterName(event.currentTarget.value)} />
    </SettingsField>
    <PreferenceSwitch checked={keepHealDamageDialogOpen} label="Keep heal/damage dialog open after application" onChange={setKeepHealDamageDialogOpen} />
    <SettingsField label="Hit point limits">
      <select aria-label="Hit point limits" className={SETTINGS_CONTROL} value={draft.limits} onChange={(event) => save({ ...draft, limits: event.currentTarget.value as CombatRules["limits"] })}>
        <option value="bounded">Clamp at zero and maximum</option><option value="negative">Allow negative; cap healing at maximum</option><option value="unbounded">Allow negative and above maximum</option>
      </select>
    </SettingsField>
    <SettingsSubsection title="Automatic health status" description="Cutoffs save when you leave the field. Automatic health changes update the current encounter and can be undone.">
      <PreferenceSwitch title="Recalculate health when hit points or cutoffs change" checked={draft.automaticHealth} label="Automatically update health status" onChange={(automaticHealth) => save({ ...rules, automaticHealth })} />
      {draft.automaticHealth ? <>
      <p id={cutoffHelpId} className="text-xs text-canvas-muted">Set upper cutoffs for the statuses you want to automate. Leave a cutoff blank to control that status manually. Equal cutoffs use the most severe status.</p>
      <SettingsField label="Threshold units"><select aria-label="Threshold units" className={SETTINGS_CONTROL} value={draft.unit} onChange={(event) => save({ ...draft, unit: event.currentTarget.value as CombatRules["unit"] })}><option value="fixed">Fixed hit points</option><option value="percent">Percentage of maximum</option></select></SettingsField>
      {["Dead", "Unconscious / severely injured", "Injured"].map((label, index) => <HealthThresholdField key={label} label={label} value={draft.thresholds[index]} unit={draft.unit} describedBy={[cutoffHelpId, !valid ? cutoffErrorId : null].filter(Boolean).join(" ")} onChange={(value) => {
        const thresholds = [...draft.thresholds] as CombatRules["thresholds"];
        thresholds[index] = value;
        setDraft({ ...draft, thresholds });
      }} onCommit={(value) => {
        const thresholds = [...draft.thresholds] as CombatRules["thresholds"];
        thresholds[index] = value;
        save({ ...draft, thresholds });
      }} onBlur={() => save(draft)} />)}
      {!valid ? <p id={cutoffErrorId} role="alert" className="text-xs text-red-600 dark:text-red-500">Configured cutoffs must be ordered whole numbers (Dead ≤ Unconscious ≤ Injured){draft.unit === "percent" ? " from 0 to 100" : ""}. Changes will save when corrected.</p> : null}
      </> : null}
    </SettingsSubsection>
    </SettingsSection>
  </SettingsCategory>;
}
