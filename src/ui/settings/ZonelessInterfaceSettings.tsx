import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { PreferenceSwitch } from "./PreferenceSwitch";
import { SettingsField, SettingsSection, SETTINGS_CONTROL } from "./SettingsLayout";

export function ZonelessInterfaceSettings() {
  const preferences = useInterfacePreferences();
  return <SettingsSection title="Zoneless" titleSuffix="(Panel)">
    <SettingsField label="Zoneless panel location">
      <select aria-label="Zoneless panel location" className={SETTINGS_CONTROL}
        value={preferences.zonelessPanelPlacement}
        onChange={event => preferences.setZonelessPanelPlacement(event.target.value as "canvas" | "sidebar")}>
        <option value="canvas">On canvas</option><option value="sidebar">In sidebar</option>
      </select>
    </SettingsField>
    <PreferenceSwitch checked={preferences.zonelessHeaderClickExpansion} label="Click Zoneless header to expand or collapse" onChange={preferences.setZonelessHeaderClickExpansion} />
  </SettingsSection>;
}
