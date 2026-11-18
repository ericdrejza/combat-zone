import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { getDockablePanelDefinition } from "@ui/panels/dockablePanelMetadata";
import { ApplyPanelOrderButton } from "./ApplyPanelOrderButton";
import { PanelOrderSettings } from "./PanelOrderSettings";
import { PreferenceSwitch } from "./PreferenceSwitch";
import { SettingsSection, SettingsSubsection } from "./SettingsLayout";
import { VisibilityButton } from "./VisibilitySwitch";

/** Panel presentation stays independent of the storage provider owning each preference. */
export function PanelInterfaceSettings() {
  const preferences = useInterfacePreferences();
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
  </SettingsSection>;
}
