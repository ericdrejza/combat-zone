import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { DEFAULT_COMBAT_RULES, validThresholds, type CombatRules } from "@entities/actor/actorResources";
import { LOCAL_PREFERENCES_RESET_EVENT } from "@ui/motion_preferences/MotionPreferenceProvider";

import { DEFAULT_STATUS_VISIBILITY, normalizeStatusVisibility, type StatusVisibility } from "./statusVisibility";

export const COMBAT_PREFERENCES_STORAGE_KEY = "combat-zone.combat-preferences";

export function readCombatPreferences(): CombatRules {
  try {
    const value = JSON.parse(localStorage.getItem(COMBAT_PREFERENCES_STORAGE_KEY) ?? "null") as Partial<CombatRules> | null;
    const rules: CombatRules = {
      limits: value?.limits === "negative" || value?.limits === "unbounded" ? value.limits : "bounded",
      unit: value?.unit === "percent" ? "percent" : "fixed",
      automaticHealth: false,
      thresholds: Array.isArray(value?.thresholds) && value.thresholds.length === 3
        ? value.thresholds.map((n) => Number.isSafeInteger(n) ? n : null) as CombatRules["thresholds"]
        : [null, null, null]
    };
    rules.automaticHealth = value?.automaticHealth === true && (rules.thresholds.every((value) => value === null) || validThresholds(rules));
    return rules;
  } catch { return { ...DEFAULT_COMBAT_RULES }; }
}

export function readStatusVisibility(): StatusVisibility {
  try { return normalizeStatusVisibility(JSON.parse(localStorage.getItem(COMBAT_PREFERENCES_STORAGE_KEY) ?? "null")?.visibility); }
  catch { return { ...DEFAULT_STATUS_VISIBILITY }; }
}
const Context = createContext({ rules: DEFAULT_COMBAT_RULES, visibility: DEFAULT_STATUS_VISIBILITY, saveRules: (_rules: CombatRules, _visibility?: StatusVisibility) => {} });

/** Durable global preferences; encounter recalculation remains a validated UI command. */
export function CombatPreferenceProvider({ children }: { children: ReactNode }) {
  const [rules, setRules] = useState(readCombatPreferences);
  const [visibility, setVisibility] = useState(readStatusVisibility);
  useEffect(() => {
    const reset = () => { setRules({ ...DEFAULT_COMBAT_RULES }); setVisibility({ ...DEFAULT_STATUS_VISIBILITY }); };
    const sync = (event: StorageEvent) => { if (event.key === COMBAT_PREFERENCES_STORAGE_KEY || event.key === null) { setRules(readCombatPreferences()); setVisibility(readStatusVisibility()); } };
    globalThis.addEventListener(LOCAL_PREFERENCES_RESET_EVENT, reset);
    globalThis.addEventListener("storage", sync);
    return () => {
      globalThis.removeEventListener(LOCAL_PREFERENCES_RESET_EVENT, reset);
      globalThis.removeEventListener("storage", sync);
    };
  }, []);
  function saveRules(next: CombatRules, nextVisibility = visibility) {
    if (next.thresholds.some((value) => value !== null) && !validThresholds(next)) return;
    setRules(next);
    const normalized = normalizeStatusVisibility(nextVisibility);
    setVisibility(normalized);
    try { localStorage.setItem(COMBAT_PREFERENCES_STORAGE_KEY, JSON.stringify({ ...next, visibility: normalized })); } catch { /* Retain session preferences if storage is unavailable. */ }
  }
  return <Context.Provider value={{ rules, visibility, saveRules }}>{children}</Context.Provider>;
}
export const useCombatPreferences = () => useContext(Context);
