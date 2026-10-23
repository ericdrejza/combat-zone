import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import type { PreferenceCategory } from "@ui/interface_preferences/preferenceCategories";
import { DEFAULT_CANVAS_PREFERENCES } from "@ui/canvas_preferences/canvasPreferenceStorage";
import { useCanvasPreferences } from "@ui/canvas_preferences/useCanvasPreferences";
import { useCombatPreferences } from "@ui/combat_preferences/CombatPreferenceProvider";
import { DEFAULT_STATUS_VISIBILITY } from "@ui/combat_preferences/statusVisibility";
import { useTheme } from "@ui/theme/ThemeProvider";

/** Reset by UI category, including preferences owned by other providers. */
export function useResetSettingsCategory(category: PreferenceCategory) {
  const { resetCategory } = useInterfacePreferences();
  const canvas = useCanvasPreferences();
  const combat = useCombatPreferences();
  const { setTheme } = useTheme();
  return () => {
    resetCategory(category);
    if (category === "canvas") canvas.save(structuredClone(DEFAULT_CANVAS_PREFERENCES));
    if (category === "combat") combat.resetCombatPreferences();
    if (category === "interface") {
      setTheme("system");
      combat.saveRules(combat.rules, structuredClone(DEFAULT_STATUS_VISIBILITY));
    }
  };
}
