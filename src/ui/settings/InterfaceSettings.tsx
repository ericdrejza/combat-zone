import { ResetSettingsButton } from "./ResetSettingsButton";
import { useResetSettingsCategory } from "./useResetSettingsCategory";
import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { SettingsCategory, SettingsSection } from "./SettingsLayout";
import { ThemeSettings } from "./ThemeSettings";
import { PreferenceSwitch } from "./PreferenceSwitch";
import { LibraryInterfaceSettings } from "./LibraryInterfaceSettings";
import { PanelInterfaceSettings } from "./PanelInterfaceSettings";

export function InterfaceSettings() {
  const resetCategory = useResetSettingsCategory("interface");
  const { enableAssetAnimation, setEnableAssetAnimation } = useInterfacePreferences();
  return <SettingsCategory actions={<ResetSettingsButton category="Interface" onReset={resetCategory} />} title="Interface" description="Appearance, accessibility, Library browsing, and panel presentation.">
    <SettingsSection title="Appearance"><ThemeSettings /></SettingsSection>
    <SettingsSection title="Accessibility">
      <PreferenceSwitch checked={enableAssetAnimation} label="Enable animations" onChange={setEnableAssetAnimation} />
    </SettingsSection>
    <LibraryInterfaceSettings />
    <PanelInterfaceSettings />
  </SettingsCategory>;
}
