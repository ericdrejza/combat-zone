import { isClockStyle } from "@core/entity_resources/clockStyle";
import { useCombatPreferences } from "@ui/combat_preferences/CombatPreferenceProvider";
import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { getDockablePanelDefinition } from "@ui/panels/dockablePanelMetadata";
import { ApplyPanelOrderButton } from "./ApplyPanelOrderButton";
import { PanelOrderSettings } from "./PanelOrderSettings";
import { PreferenceSwitch } from "./PreferenceSwitch";
import { SettingsField, SettingsSection, SettingsSubsection, SETTINGS_CONTROL } from "./SettingsLayout";
import { StatusVisibilitySettings } from "./StatusVisibilitySettings";
import { VisibilityButton } from "./VisibilitySwitch";

/** Panel presentation stays independent of the storage provider owning each preference. */
export function PanelInterfaceSettings() {
  const preferences = useInterfacePreferences();
  const { rules, visibility, saveRules } = useCombatPreferences();
  return <SettingsSection title="Panels" region>
    <PreferenceSwitch checked={preferences.panelTabMode} label="Panel Tabs"
      description="Use icon tabs in sidebar footers to switch panels."
      onChange={preferences.setPanelTabMode} />
    <SettingsSubsection title="Default layout and visibility" description="Layout sets the global default panel sides and order for new encounters. Visibility toggles apply globally and immediately affect the current encounter. Applying the default layout to the current encounter can be undone.">
      <PanelOrderSettings onChange={preferences.setPanelOrder} order={preferences.panelOrder}
        getReorderDisabledReason={(panelId) => panelId === "zoneless" && preferences.zonelessPanelPlacement === "canvas"
          ? "Set Zoneless panel location to In sidebar to reorder it." : undefined}
        renderPanelControl={(panelId) => {
          if (panelId === "zoneless") return null;
          const panel = getDockablePanelDefinition(panelId);
          return <VisibilityButton ariaLabel={`${panel.title} panel visibility`} tooltipLabel={`${panel.title} panel`}
            visible={preferences.panelVisibility[panelId]} onChange={(visible) => preferences.setPanelVisible(panelId, visible)} />;
        }} />
      <ApplyPanelOrderButton order={preferences.panelOrder} />
    </SettingsSubsection>
    <SettingsSubsection title="Zoneless">
      <SettingsField label="Zoneless panel location">
        <select aria-label="Zoneless panel location" className={SETTINGS_CONTROL}
          value={preferences.zonelessPanelPlacement}
          onChange={event => preferences.setZonelessPanelPlacement(event.target.value as "canvas" | "sidebar")}>
          <option value="canvas">On canvas</option><option value="sidebar">In sidebar</option>
        </select>
      </SettingsField>
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
