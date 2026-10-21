import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { HexColorInput } from "./HexColorInput";
import { SettingsSection } from "./SettingsLayout";

export function ResourceBarSettings() {
  const preferences = useInterfacePreferences();
  return <SettingsSection title="Token resource bars" description="Colors apply to all actor tokens. Map resources in the actor’s health and counter editors.">
    <HexColorInput label="Resource 1 fill color" value={preferences.resourceBar1Color} placeholder="#ef4444"
      onCommit={(color) => preferences.setResourceBar1Color(color ?? "#ef4444")} />
    <HexColorInput label="Resource 2 fill color" value={preferences.resourceBar2Color} placeholder="#3b82f6"
      onCommit={(color) => preferences.setResourceBar2Color(color ?? "#3b82f6")} />
  </SettingsSection>;
}
