import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { ResourceBarColorSettings } from "./ResourceBarColorSettings";
import { SettingsSection } from "./SettingsLayout";

export function ResourceBarSettings() {
  const preferences = useInterfacePreferences();
  return <SettingsSection title="Token resource bars" description="Colors apply to all actor tokens. Map resources in the actor’s health and counter editors.">
    <ResourceBarColorSettings label="Resource 1" color={preferences.resourceBar1Color} defaultColor="#ef4444"
      gradient={preferences.resourceBar1Gradient} onColorChange={preferences.setResourceBar1Color} onGradientChange={preferences.setResourceBar1Gradient} />
    <ResourceBarColorSettings label="Resource 2" color={preferences.resourceBar2Color} defaultColor="#3b82f6"
      gradient={preferences.resourceBar2Gradient} onColorChange={preferences.setResourceBar2Color} onGradientChange={preferences.setResourceBar2Gradient} />
  </SettingsSection>;
}
