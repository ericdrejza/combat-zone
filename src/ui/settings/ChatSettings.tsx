import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { HexColorInput } from "./HexColorInput";
import { PreferenceSwitch } from "./PreferenceSwitch";
import { SettingsSection, SettingsSubsection } from "./SettingsLayout";

export function ChatSettings() {
  const { chatNameColor, setChatNameColor, chatMatchMessageColor, setChatMatchMessageColor } = useInterfacePreferences();
  return <SettingsSection title="Log" titleSuffix="(Panel)">
    <SettingsSubsection title="Colors">
    <HexColorInput label="Sender name color" value={chatNameColor} placeholder="#64748b" onCommit={setChatNameColor} />
    <PreferenceSwitch label="Match message text to sender name color" checked={chatMatchMessageColor} onChange={setChatMatchMessageColor} />
    </SettingsSubsection>
    <SettingsSubsection title="Reference navigation">
    <p className="text-sm text-canvas-muted">Click a reference to select it. Double-click to select and navigate without changing zoom. Groups only move the viewport when all selected actors fit at the current zoom.</p>
    </SettingsSubsection>
  </SettingsSection>;
}
