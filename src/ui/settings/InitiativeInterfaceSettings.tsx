import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { PreferenceSwitch } from "./PreferenceSwitch";
import { SettingsSection } from "./SettingsLayout";

export function InitiativeInterfaceSettings() {
  const preferences = useInterfacePreferences();
  return <SettingsSection title="Initiative" titleSuffix="(Panel)">
    <PreferenceSwitch checked={preferences.autoSelectActiveActorDefault} label="Auto-select active actor in initiative" onChange={preferences.setAutoSelectActiveActorDefault} />
    <PreferenceSwitch checked={preferences.strikethroughDeadInitiativeNames} label="Strikethrough dead actor names in initiative" onChange={preferences.setStrikethroughDeadInitiativeNames} />
  </SettingsSection>;
}
