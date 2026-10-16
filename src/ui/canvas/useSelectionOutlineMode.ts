import type { SelectionOutlineMode } from "@core/rendering/SelectionOutline";
import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { readSelectionOutlineMode } from "@ui/interface_preferences/selectionOutlinePreferences";
import { useMotionPreference } from "@ui/motion_preferences/MotionPreferenceProvider";

/** Accessibility overrides animation without replacing either saved preference. */
export function useSelectionOutlineMode(entity: "actor" | "zone"): SelectionOutlineMode {
  const preferences = useInterfacePreferences();
  const { animationsDisabled } = useMotionPreference();
  if (animationsDisabled || !preferences.enableAssetAnimation) return "static";
  return readSelectionOutlineMode(entity === "actor"
    ? preferences.actorSelectionOutline
    : preferences.zoneSelectionOutline);
}
