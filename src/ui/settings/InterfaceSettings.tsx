import type { ToolMenu } from "@ui/interface_preferences/interfacePreferenceStorage";
import { ChatSettings } from "./ChatSettings";
import { ResetSettingsButton } from "./ResetSettingsButton";
import { useResetSettingsCategory } from "./useResetSettingsCategory";
import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { SettingsCategory, SettingsSection, SettingsField, SETTINGS_CONTROL } from "./SettingsLayout";
import { ThemeSettings } from "./ThemeSettings";
import { PreferenceSwitch } from "./PreferenceSwitch";
import { LibraryInterfaceSettings } from "./LibraryInterfaceSettings";
import { PanelInterfaceSettings } from "./PanelInterfaceSettings";
import { InitiativeInterfaceSettings } from "./InitiativeInterfaceSettings";
import { StatusInterfaceSettings } from "./StatusInterfaceSettings";
import { ZonelessInterfaceSettings } from "./ZonelessInterfaceSettings";

export function InterfaceSettings() {
  const resetCategory = useResetSettingsCategory("interface");
  const { expandZoomControlsOnStart, setExpandZoomControlsOnStart, toolMenu, setToolMenu, enableAssetAnimation, setEnableAssetAnimation } = useInterfacePreferences();
  return <SettingsCategory actions={<ResetSettingsButton category="Interface" onReset={resetCategory} />} title="Interface" description="Appearance, accessibility, Library browsing, and panel presentation.">
    <SettingsSection title="Appearance"><ThemeSettings /></SettingsSection>
    <SettingsSection title="Toolbar">
      <PreferenceSwitch label="Expand zoom controls on start" checked={expandZoomControlsOnStart}
        onChange={setExpandZoomControlsOnStart} />
      <SettingsField label="Tool Menu">
        <select aria-label="Tool Menu" className={SETTINGS_CONTROL} value={toolMenu}
          onChange={event => setToolMenu(event.currentTarget.value as ToolMenu)}>
          <option value="dropdown">Dropdown</option>
          <option value="dropdown_small_screen">Dropdown (small screen only)</option>
          <option value="expanded">Expanded</option>
        </select>
      </SettingsField>
    </SettingsSection>
    <SettingsSection title="Accessibility">
      <PreferenceSwitch checked={enableAssetAnimation} label="Enable animations" onChange={setEnableAssetAnimation} />
    </SettingsSection>
    <LibraryInterfaceSettings />
    <PanelInterfaceSettings />
    <InitiativeInterfaceSettings />
    <ChatSettings />
    <StatusInterfaceSettings />
    <ZonelessInterfaceSettings />
  </SettingsCategory>;
}
