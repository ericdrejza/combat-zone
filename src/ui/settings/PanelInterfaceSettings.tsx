import { isClockStyle } from "@core/entity_resources/clockStyle";
import { useCombatPreferences } from "@ui/combat_preferences/CombatPreferenceProvider";
import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { DOCKABLE_PANEL_DEFINITIONS } from "@ui/panels/dockablePanelMetadata";
import { ApplyPanelOrderButton } from "./ApplyPanelOrderButton";
import { PanelOrderSettings } from "./PanelOrderSettings";
import { PreferenceSwitch } from "./PreferenceSwitch";
import { SettingsField, SettingsSection, SettingsSubsection, SETTINGS_CONTROL } from "./SettingsLayout";
import { StatusVisibilitySettings } from "./StatusVisibilitySettings";
import { VisibilitySwitch } from "./VisibilitySwitch";

/** Panel presentation stays independent of the storage provider owning each preference. */
export function PanelInterfaceSettings() {
  const preferences = useInterfacePreferences();
  const { rules, visibility, saveRules } = useCombatPreferences();
  return <SettingsSection title="Panels" region>
    <SettingsSubsection title="Visibility" description="Choose which panels appear in the workspace.">
      {DOCKABLE_PANEL_DEFINITIONS.map((panel) => <VisibilitySwitch key={panel.id} label={panel.title}
        ariaLabel={`${panel.title} panel visibility`} tooltipLabel={`${panel.title} panel`}
        visible={preferences.panelVisibility[panel.id]} onChange={(visible) => preferences.setPanelVisible(panel.id, visible)} />)}
    </SettingsSubsection>
    <SettingsSubsection title="Default layout" description="Default sides and order for new encounters. Applying this layout below changes the current encounter and can be undone.">
      <PanelOrderSettings onChange={preferences.setPanelOrder} order={preferences.panelOrder} />
      <ApplyPanelOrderButton order={preferences.panelOrder} />
    </SettingsSubsection>
    <SettingsSubsection title="Zoneless">
      <PreferenceSwitch checked={preferences.zonelessHeaderClickExpansion} label="Click Zoneless header to expand or collapse" onChange={preferences.setZonelessHeaderClickExpansion} />
    </SettingsSubsection>
    <SettingsSubsection title="Initiative">
      <PreferenceSwitch checked={preferences.autoSelectActiveActorDefault} label="Auto-select active actor in initiative" onChange={preferences.setAutoSelectActiveActorDefault} />
      <PreferenceSwitch checked={preferences.strikethroughDeadInitiativeNames} label="Strikethrough dead actor names in initiative" onChange={preferences.setStrikethroughDeadInitiativeNames} />
    </SettingsSubsection>
    <SettingsSubsection title="Status">
      <PreferenceSwitch checked={preferences.reverseHealthStatusOrder} label="Reverse health status icon order" onChange={preferences.setReverseHealthStatusOrder} />
      <StatusVisibilitySettings value={visibility} onChange={(next) => saveRules(rules, next)} />
      <SettingsField label="Default clock style" description="Applied to new clocks created through the Status panel.">
        <select aria-label="Default clock style" className={SETTINGS_CONTROL} value={preferences.clockStyleDefault} onChange={(event) => { if (isClockStyle(event.currentTarget.value)) preferences.setClockStyleDefault(event.currentTarget.value); }}>
          <option value="box">Box</option><option value="row">Row</option><option value="stack">Stack</option><option value="traditional">Traditional</option>
        </select>
      </SettingsField>
    </SettingsSubsection>
  </SettingsSection>;
}
