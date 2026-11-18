import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { PreferenceSwitch } from "./PreferenceSwitch";
import { SettingsField, SettingsSection, SETTINGS_CONTROL } from "./SettingsLayout";
import { isClockStyle } from "@core/entity_resources/clockStyle";
import { useCombatPreferences } from "@ui/combat_preferences/CombatPreferenceProvider";
import { StatusVisibilitySettings } from "./StatusVisibilitySettings";

export function StatusInterfaceSettings() {
  const preferences = useInterfacePreferences();
  const { rules, visibility, saveRules } = useCombatPreferences();
  return <SettingsSection title="Status" titleSuffix="(Panel)">
    <PreferenceSwitch checked={preferences.reverseHealthStatusOrder} label="Reverse health status icon order" onChange={preferences.setReverseHealthStatusOrder} />
    <StatusVisibilitySettings value={visibility} onChange={(next) => saveRules(rules, next)} />
    <SettingsField label="Default clock style" description="Applied to new clocks created through the Status panel.">
      <select aria-label="Default clock style" className={SETTINGS_CONTROL} value={preferences.clockStyleDefault} onChange={(event) => { if (isClockStyle(event.currentTarget.value)) preferences.setClockStyleDefault(event.currentTarget.value); }}>
        <option value="box">Box</option><option value="row">Row</option><option value="stack">Stack</option><option value="traditional">Traditional</option>
      </select>
    </SettingsField>
  </SettingsSection>;
}
