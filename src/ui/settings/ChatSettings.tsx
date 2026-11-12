import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { HexColorInput } from "./HexColorInput";
import { PreferenceSwitch } from "./PreferenceSwitch";
import { SettingsSection } from "./SettingsLayout";

export function ChatSettings() {
  const { chatNameColor, setChatNameColor, chatMatchMessageColor, setChatMatchMessageColor } = useInterfacePreferences();
  return <SettingsSection title="Chat">
    <HexColorInput label="Chat name color" value={chatNameColor} placeholder="#64748b" onCommit={setChatNameColor} />
    <PreferenceSwitch label="Match message text to sender name color" checked={chatMatchMessageColor} onChange={setChatMatchMessageColor} />
  </SettingsSection>;
}
